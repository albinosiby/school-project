import { expect, it } from "vitest";
import { authState, field, renderUI, screen } from "@/test/render";
import StaffAccessPage from "./page";

it("shows Vice Principal only the roles they are allowed to add", () => {
  authState.user = { ...authState.user!, role: "staff", staffRole: "vice_principal" };
  renderUI(<StaffAccessPage />);
  const role = field("Role") as unknown as HTMLSelectElement;
  expect(Array.from(role.options, (option) => option.text)).toEqual([
    "Select a role", "Office Administrator", "Office Staff", "HOD", "Teacher",
  ]);
});

it("gives an Accountant no staff invitation controls", () => {
  authState.user = { ...authState.user!, role: "staff", staffRole: "accountant" };
  renderUI(<StaffAccessPage />);
  expect(screen.getByText(/Signed in as/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add Staff" })).not.toBeInTheDocument();
});
