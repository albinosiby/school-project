import { describe, expect, it } from "vitest";
import LoginPage from "./page";
import { authState, field, renderUI, router, screen } from "@/test/render";

const submit = () => screen.getByRole("button", { name: /Sign In/ });

describe("Login page validation", () => {
  it("asks for the email first, then a valid email, then the password, without calling login", async () => {
    authState.user = null;
    const { user } = renderUI(<LoginPage />);
    await user.click(submit());
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your email address.");
    await user.type(field("Email Address"), "principal@school");
    await user.click(submit());
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    await user.clear(field("Email Address"));
    await user.type(field("Email Address"), "principal@school.edu");
    await user.click(submit());
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your password.");
    expect(authState.login).not.toHaveBeenCalled();
  });

  it("signs in with the typed email and password", async () => {
    authState.user = null;
    const { user } = renderUI(<LoginPage />);
    await user.type(field("Email Address"), "principal@school.edu");
    await user.type(field("Password"), "secret12");
    await user.click(submit());
    expect(authState.login).toHaveBeenCalledWith("principal@school.edu", "secret12");
  });

  it("sends a signed-in admin to the dashboard and a product owner to the owner console", () => {
    const { unmount } = renderUI(<LoginPage />);
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    unmount();
    authState.user = { id: "own1", email: "owner@edvio.test", organizationName: "Edvio", schoolId: "", role: "owner" };
    renderUI(<LoginPage />);
    expect(router.replace).toHaveBeenLastCalledWith("/owner");
  });

  it("shows the message login() rejects with (wrong password)", async () => {
    authState.user = null;
    authState.login.mockRejectedValueOnce(new Error("Incorrect email or password."));
    const { user } = renderUI(<LoginPage />);
    await user.type(field("Email Address"), "principal@school.edu");
    await user.type(field("Password"), "wrong");
    await user.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows why a teacher / parent account was refused", () => {
    authState.user = null;
    authState.blockedMessage = "This account is not an administrator account. Teachers and parents must use the mobile app.";
    renderUI(<LoginPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("This account is not an administrator account. Teachers and parents must use the mobile app.");
  });

  it("password reset needs an email and reports success or failure", async () => {
    authState.user = null;
    const { user } = renderUI(<LoginPage />);
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your email above first.");
    expect(authState.resetPassword).not.toHaveBeenCalled();
    await user.type(field("Email Address"), "principal@school.edu");
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(authState.resetPassword).toHaveBeenCalledWith("principal@school.edu");
    expect(await screen.findByRole("status")).toHaveTextContent("Password reset email sent. Check your inbox.");
    authState.resetPassword.mockRejectedValueOnce(new Error("No account found for this email."));
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No account found for this email.");
  });

  it("sends a signed-in admin straight to the dashboard", () => {
    renderUI(<LoginPage />);
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
  });
});
