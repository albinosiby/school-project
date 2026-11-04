import { describe, expect, it } from "vitest";
import SignUpPage from "./page";
import { authState, field, fieldError, renderUI, router, screen } from "@/test/render";

const create = () => screen.getByRole("button", { name: /Create Account/ });

describe("Sign-up page validation", () => {
  it("shows every required-field error and does not sign up", async () => {
    authState.user = null;
    const { user } = renderUI(<SignUpPage />);
    await user.click(create());
    expect(fieldError("Organization Name")).toBe("Organization name is required");
    expect(fieldError("Email Address")).toBe("Email is required");
    expect(fieldError("Password")).toBe("Password is required");
    expect(fieldError("Confirm Password")).toBe("Confirm your password");
    expect(authState.signup).not.toHaveBeenCalled();
  });

  it("checks name length, email format, password length and that the passwords match", async () => {
    authState.user = null;
    const { user } = renderUI(<SignUpPage />);
    await user.type(field("Organization Name"), "X");
    await user.type(field("Email Address"), "principal@school");
    await user.type(field("Password"), "12345");
    await user.type(field("Confirm Password"), "12345");
    await user.click(create());
    expect(fieldError("Organization Name")).toBe("Organization name must be at least 2 characters");
    expect(fieldError("Email Address")).toBe("Enter a valid email address");
    expect(fieldError("Password")).toBe("Password must be at least 6 characters");
    await user.clear(field("Password"));
    await user.type(field("Password"), "secret12");
    await user.click(create());
    expect(fieldError("Password")).toBe("");
    expect(fieldError("Confirm Password")).toBe("Passwords do not match");
    expect(authState.signup).not.toHaveBeenCalled();
  });

  it("creates the account and opens the setup wizard", async () => {
    authState.user = null;
    const { user } = renderUI(<SignUpPage />);
    await user.type(field("Organization Name"), "Sunrise Academy");
    await user.type(field("Email Address"), "principal@sunrise.in");
    await user.type(field("Password"), "secret12");
    await user.type(field("Confirm Password"), "secret12");
    await user.click(create());
    expect(authState.signup).toHaveBeenCalledWith("principal@sunrise.in", "secret12", "Sunrise Academy");
    expect(router.push).toHaveBeenCalledWith("/onboarding/setup");
  });

  it("shows the sign-up failure (email already used)", async () => {
    authState.user = null;
    authState.signup.mockRejectedValueOnce(new Error("An account with this email already exists. Sign in instead."));
    const { user } = renderUI(<SignUpPage />);
    await user.type(field("Organization Name"), "Sunrise Academy");
    await user.type(field("Email Address"), "principal@sunrise.in");
    await user.type(field("Password"), "secret12");
    await user.type(field("Confirm Password"), "secret12");
    await user.click(create());
    expect(await screen.findByRole("alert")).toHaveTextContent("An account with this email already exists. Sign in instead.");
    expect(router.push).not.toHaveBeenCalled();
  });
});
