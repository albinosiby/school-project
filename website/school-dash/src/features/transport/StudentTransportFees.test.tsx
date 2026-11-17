import { expect, it } from "vitest";
import { getRow, renderUI, screen, seed, within, writes } from "@/test/render";
import { BusDetailsView } from "./BusDetailsView";
import type { Student } from "@/features/people/StudentsView";
import type { Bus } from "./types";

const bus: Bus = { id: "bus_a", number: "14", regNo: "KL-07-AB-1234", capacity: 40, routeName: "North", status: "Active",
  studentCount: 2, stops: [], pickupStart: "", dropStart: "", monthlyFee: 9999 };
const kids: Student[] = ["Aarav", "Ananya"].map((name, index) => ({ id: String(index), name, grn: `GRN-${index}`,
  grade: "5", section: "A", guardian: "Parent", phone: "9000000000", status: "Active", attendance: 100, busId: bus.id }));
const feeRow = (name: string) => within(screen.getByRole("row", { name: new RegExp(name) }));

it("shows student fees as read-only values without fee-edit controls", async () => {
  seed({ tr_buses: [bus], students: kids, student_transport_fees: [
    { id: "0", studentId: "0", busId: bus.id, monthlyAmount: 600.25, revision: 1, busAssignmentRevision: 0 },
  ] });
  const { user } = renderUI(<BusDetailsView busId={bus.id} />);
  await user.click(screen.getByRole("tab", { name: /^Students/ }));
  expect(feeRow("Aarav").getByText("₹600.25")).toBeInTheDocument();
  expect(feeRow("Ananya").getByText("Not configured")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Edit fee/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: /Monthly transport fee/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add students" })).toBeInTheDocument();
  expect(feeRow("Aarav").getByRole("button", { name: /Remove/ })).toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

it("sets separate amounts when adding students and keeps drafts across roster filters", async () => {
  const newKids = kids.map((student) => ({ ...student, busId: undefined }));
  seed({ tr_buses: [{ ...bus, studentCount: 0 }], students: newKids });
  const { user } = renderUI(<BusDetailsView busId={bus.id} />);
  await user.click(screen.getByRole("tab", { name: /^Students/ }));
  await user.click(screen.getByRole("button", { name: "Add students" }));
  const panel = screen.getByRole("dialog", { name: "Add students" });
  await user.click(within(panel).getByLabelText("Select Aarav"));
  await user.click(within(panel).getByLabelText("Select Ananya"));
  await user.type(within(panel).getByLabelText("Fee amount for Aarav (₹)"), "1000");
  await user.type(within(panel).getByLabelText("Fee amount for Ananya (₹)"), "650.25");
  await user.type(within(panel).getByPlaceholderText("Search name, GRN, guardian…"), "no match");
  expect(within(panel).getByLabelText("Fee amount for Aarav (₹)")).toHaveValue("1000");
  await user.click(within(panel).getByRole("button", { name: "Add 2 students" }));
  expect(getRow("student_transport_fees", "0")).toMatchObject({ amount: 1000, busId: bus.id, busAssignmentRevision: 1 });
  expect(getRow("student_transport_fees", "1")).toMatchObject({ amount: 650.25, busId: bus.id, busAssignmentRevision: 1 });
  expect(feeRow("Aarav").getByText("₹1,000")).toBeInTheDocument();
  expect(feeRow("Ananya").getByText("₹650.25")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Edit fee/ })).not.toBeInTheDocument();
});
