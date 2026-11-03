import { describe, expect, it } from "vitest";
import { AuthGuard } from "./AuthGuard";
import { OnboardingGate } from "@/features/onboarding/OnboardingGate";
import Home from "@/app/page";
import { redirect } from "next/navigation";
import { authState, renderUI, router, screen, seed } from "@/test/render";

describe("AuthGuard", () => {
  it("shows a loader while the session resolves", () => {
    authState.isLoading = true;
    renderUI(<AuthGuard><p>secret</p></AuthGuard>);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("sends a signed-out visitor to /login and renders nothing", () => {
    authState.user = null;
    renderUI(<AuthGuard><p>secret</p></AuthGuard>);
    expect(router.replace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });
  it("renders the console for a signed-in admin", () => {
    renderUI(<AuthGuard><p>secret</p></AuthGuard>);
    expect(screen.getByText("secret")).toBeInTheDocument();
  });
});

describe("OnboardingGate", () => {
  it("holds the console until setup is complete", () => {
    seed({ onboarding: [{ id: "state", complete: false, completed: [1] }] });
    renderUI(<OnboardingGate><p>console</p></OnboardingGate>);
    expect(router.replace).toHaveBeenCalledWith("/onboarding/setup");
    expect(screen.queryByText("console")).not.toBeInTheDocument();
  });
  it("treats a missing marker as not set up", () => {
    renderUI(<OnboardingGate><p>console</p></OnboardingGate>);
    expect(router.replace).toHaveBeenCalledWith("/onboarding/setup");
  });
  it("lets a finished school through", () => {
    seed({ onboarding: [{ id: "state", complete: true }] });
    renderUI(<OnboardingGate><p>console</p></OnboardingGate>);
    expect(screen.getByText("console")).toBeInTheDocument();
  });
});

describe("root page", () => {
  it("redirects to the dashboard", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
