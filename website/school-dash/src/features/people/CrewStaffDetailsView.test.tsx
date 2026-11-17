import { expect, it, vi } from "vitest";
import { authState, renderUI, screen, seed, writes } from "@/test/render";
import { CrewStaffDetailsView } from "./CrewStaffDetailsView";
import { staffForCrew } from "./crewStaffProfile";
import type { Staff } from "./StaffView";
import type { Crew } from "@/features/transport/types";

vi.mock("./StaffDetailsView", () => ({ StaffDetailsView: ({ staffId }: { staffId: string }) => <div>Full staff profile: {staffId}</div> }));

const crew: Crew = { id: "crew_driver", name: "Saved Driver", empId: "TR-1001", role: "driver", status: "Active",
  phone: "9000000001", email: "driver@example.test", authUid: "driver_uid", address: "North road",
  licenseNo: "KL-LIC-1001", licenseExpiry: "2029-01-01", joined: "2025-01-01", emergencyName: "Emergency contact", emergencyPhone: "9000000002" };
const staff: Staff = { id: "staff_driver", name: crew.name, role: "Driver", department: "Transport", phone: crew.phone,
  status: "Active", empId: "EMP-001" };

it.each([
  { kind: "crew staff ID", crew: { ...crew, staffId: staff.id }, staff },
  { kind: "reverse crew ID", crew, staff: { ...staff, crewId: crew.id } },
  { kind: "unique login ID", crew, staff: { ...staff, authUid: crew.authUid } },
])("reuses the complete staff details through the $kind link", ({ crew, staff }) => {
  seed({ tr_crew: [crew], staff: [staff] });
  renderUI(<CrewStaffDetailsView crewId={crew.id} />);
  expect(screen.getByText(`Full staff profile: ${staff.id}`)).toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

it("shows the saved details of an older Transport-only driver without creating a staff profile", () => {
  seed({ tr_crew: [crew] });
  renderUI(<CrewStaffDetailsView crewId={crew.id} />);
  expect(screen.getByRole("heading", { level: 1, name: crew.name })).toBeInTheDocument();
  for (const value of [crew.licenseNo!, crew.address!, crew.emergencyName!, crew.emergencyPhone!]) expect(screen.getByText(value, { selector: "dd" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Attendance" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to drivers" })).toHaveAttribute("href", "/transport?tab=drivers");
  expect(writes).toHaveLength(0);
});

it("does not match names/emails, conflicting links or duplicate account identities", () => {
  expect(staffForCrew(crew, [{ ...staff, email: crew.email }])).toBeUndefined();
  expect(staffForCrew({ ...crew, staffId: staff.id }, [{ ...staff, crewId: "another_driver", authUid: crew.authUid }])).toBeUndefined();
  expect(staffForCrew(crew, [{ ...staff, crewId: crew.id, authUid: "another_login" }])).toBeUndefined();
  expect(staffForCrew(crew, [{ ...staff, authUid: crew.authUid }, { ...staff, id: "duplicate", authUid: crew.authUid }])).toBeUndefined();
});

it("handles a removed crew record and denies non-admin access to staff details", () => {
  const view = renderUI(<CrewStaffDetailsView crewId="removed" />);
  expect(screen.getByText("Staff record unavailable")).toBeInTheDocument();
  view.unmount();
  seed({ tr_crew: [crew], staff: [{ ...staff, crewId: crew.id }] });
  authState.user = { ...authState.user!, role: "staff" };
  renderUI(<CrewStaffDetailsView crewId={crew.id} />);
  expect(screen.getByText("Staff record unavailable")).toBeInTheDocument();
  expect(screen.queryByText(`Full staff profile: ${staff.id}`)).not.toBeInTheDocument();
});
