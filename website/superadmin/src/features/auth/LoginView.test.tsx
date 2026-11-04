import { beforeEach, describe, expect, it } from "vitest";
import { authState, renderUI, router, screen, userEvent, within } from "@/test/render";
import { LoginView } from "./LoginView";

beforeEach(() => { authState.user = null; });
const signIn = () => screen.getByRole("button", { name: "Sign in" });

describe("superadmin login", () => {
  it("validates required credentials and focuses the field that needs attention", async () => {
    renderUI(<LoginView />);
    await userEvent.click(signIn());
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your email address.");
    expect(screen.getByLabelText("Email address")).toHaveFocus();
    await userEvent.type(screen.getByLabelText("Email address"), "invalid");
    await userEvent.click(signIn());
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    await userEvent.clear(screen.getByLabelText("Email address"));
    await userEvent.type(screen.getByLabelText("Email address"), "owner@edvio.test");
    await userEvent.click(signIn());
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your password.");
    expect(screen.getByLabelText("Password", { exact: true })).toHaveFocus();
    expect(authState.login).not.toHaveBeenCalled();
  });

  it("reveals and hides the password without changing its value", async () => {
    renderUI(<LoginView />);
    const password = screen.getByLabelText("Password", { exact: true });
    await userEvent.type(password, "sample-pass");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("sample-pass");
    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("prevents duplicate submissions while login is pending and restores the form on failure", async () => {
    let rejectLogin: (error: Error) => void = () => {};
    authState.login.mockImplementation(() => new Promise((_, reject) => { rejectLogin = reject; }));
    renderUI(<LoginView />);
    await userEvent.type(screen.getByLabelText("Email address"), "owner@edvio.test");
    await userEvent.type(screen.getByLabelText("Password", { exact: true }), "sample-pass");
    await userEvent.click(signIn());
    const pending = screen.getByRole("button", { name: "Signing in…" });
    expect(pending).toBeDisabled();
    await userEvent.click(pending);
    expect(authState.login).toHaveBeenCalledTimes(1);
    expect(authState.login).toHaveBeenCalledWith("owner@edvio.test", "sample-pass");
    rejectLogin(new Error("Incorrect email or password."));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(signIn()).toBeEnabled();
  });

  it("checks the email before requesting a reset and announces the result", async () => {
    renderUI(<LoginView />);
    await userEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your email above first.");
    expect(authState.resetPassword).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Email address"), "owner@edvio.test");
    await userEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(authState.resetPassword).toHaveBeenCalledWith("owner@edvio.test");
    expect(await screen.findByRole("status")).toHaveTextContent("Password reset email sent. Check your inbox.");
  });

  it("shows an authorization error without offering self-registration", () => {
    authState.blockedMessage = "This account is not a platform owner.";
    renderUI(<LoginView />);
    expect(screen.getByRole("alert")).toHaveTextContent("This account is not a platform owner.");
    expect(screen.queryByRole("button", { name: /create account/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /school admin login/i })).toHaveAttribute("href", "http://localhost:3000/login");
  });

  it("routes a signed-in owner to the console", () => {
    authState.user = { id: "owner1", email: "owner@edvio.test", organizationName: "Edvio", schoolId: "", role: "owner" };
    renderUI(<LoginView />);
    expect(router.replace).toHaveBeenCalledWith("/owner");
    expect(within(screen.getByRole("main")).getByRole("heading", { name: "Welcome back." })).toBeInTheDocument();
  });
});
