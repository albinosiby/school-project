// Test helpers: render inside the app's providers and drive it with user-event.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/ui";

export * from "./fakeDb";
export { setUrl, router } from "./fakeNext";
export { authAccounts, authState, sentInvites, uploads } from "./fakeAuth";
export { screen, within, userEvent };

/** Renders `ui` inside ToastProvider (toasts are plain text in the DOM). Returns a user-event instance too. */
export function renderUI(ui: React.ReactElement) {
  const user = userEvent.setup();
  return { user, ...render(<ToastProvider>{ui}</ToastProvider>) };
}

/**
 * The input/select/textarea of a kit <Field label=…>. Matches the label caption exactly (a trailing required " *" is
 * ignored), so it keeps working while the field shows an error or hint. Pass `within` to search inside a dialog.
 */
export function field(label: string | RegExp, root: HTMLElement = document.body): HTMLInputElement {
  const norm = (t: string) => t.replace(/\s*\*$/, "").trim();
  const hit = (t: string) => (typeof label === "string" ? norm(t) === label : label.test(norm(t)));
  const caps = [...root.querySelectorAll("label > span:first-child")].filter((s) => hit(s.textContent ?? ""));
  const inputs = caps.map((s) => s.closest("label")!.querySelector("input, select, textarea")).filter(Boolean);
  if (inputs.length === 1) return inputs[0] as HTMLInputElement;
  if (inputs.length > 1) throw new Error(`field(${String(label)}): ${inputs.length} matches`);
  return screen.getByLabelText(label) as HTMLInputElement; // aria-label / plain <label for>
}

/** The error text shown under a kit <Field label=…> ("" when none). */
export function fieldError(label: string | RegExp, root: HTMLElement = document.body) {
  const lab = field(label, root).closest("label");
  return lab?.querySelector(":scope > span.text-error")?.textContent ?? "";
}

/** The open dialog (Modal / SlideOver). */
export const dialog = (name?: string | RegExp) => (name ? screen.getByRole("dialog", { name }) : screen.getByRole("dialog"));
