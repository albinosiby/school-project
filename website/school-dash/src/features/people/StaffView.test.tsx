import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Button, SlideOver } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { AddStaffFields } from "./AddStaffFields";
import { StaffView } from "./StaffView";
import { StaffDetailsView } from "./StaffDetailsView";
import * as staffInvitation from "@/lib/staffInvitation";
import * as staffProfiles from "./staffProfiles";
import * as staffFiles from "./staffFiles";
import * as staffPayroll from "./staffPayroll";
import { authState, callableCalls, dialog, field, fieldError, getRow, renderUI, router, rowsOf, screen, seed, sentInvites, within, writes, writesTo } from "@/test/render";

const anita = { id: "stf_025", name: "Mrs. Anita Sharma", empId: "EMP-1025", department: "Mathematics", role: "TGT", status: "Active", phone: "+91 98100 00025", email: "anita.sharma@greenfield.edu", authUid: "uid_anita" };

async function openAdd() {
  function LegacyInvite() {
    const [open, setOpen] = useState(false);
    const { rows } = useCollection<typeof anita>("staff");
    return <><Button onClick={() => setOpen(true)}>Add Staff</Button>
      <SlideOver open={open} title="Add Staff" onClose={() => setOpen(false)}>
        <AddStaffFields rows={rows} onAdded={() => setOpen(false)} buttonLabel="Add Staff & Create Login" />
      </SlideOver></>;
  }
  const r = renderUI(<LegacyInvite />);
  await r.user.click(screen.getByRole("button", { name: /Add Staff/ }));
  return r;
}

it("opens the staff details route from a directory row", async () => {
  const photo = "data:image/jpeg;base64,/9j/Af/Z";
  const withoutPhoto = { ...anita, id: "staff_without_photo", name: "Ravi Kumar" };
  seed({ staff: [{ ...anita, department: "Academics", subjects: "Mathematics, Science" }, withoutPhoto],
    staff_hr_photos: [{ id: anita.id, image: photo }] });
  const { user } = renderUI(<StaffView />);
  const name = screen.getByRole("link", { name: anita.name });
  expect(within(name.closest("tr")!).queryAllByRole("button")).toHaveLength(0);
  expect(within(name.closest("tr")!).getByText("Mathematics, Science")).toBeInTheDocument();
  expect(within(name.closest("tr")!).queryByText("Academics")).not.toBeInTheDocument();
  expect(await screen.findByRole("img", { name: `Profile photo of ${anita.name}` })).toHaveAttribute("src", photo);
  expect(within(screen.getByRole("link", { name: withoutPhoto.name }).closest("tr")!).getByText("RK")).toBeInTheDocument();
  expect(name).toHaveAttribute("href", `/staff/${anita.id}`);
  await user.click(name.closest("tr")!);
  expect(router.push).toHaveBeenCalledWith(`/staff/${anita.id}`);
});

it("shows assigned classes and the teacher's class-teacher responsibility", () => {
  seed({
    staff: [anita],
    classes: [
      { id: "class_eight", grade: "8", section: "A", classTeacherId: anita.id },
      { id: "class_eleven", grade: "11", section: "B", streamId: "course_home_science", stream: "Home Science" },
      { id: "other_class", grade: "9", section: "C", classTeacherId: "another_staff" },
    ],
    assignments: [
      { id: "math", classId: "class_eight", subject: "Mathematics", teacherId: anita.id },
      { id: "chemistry", classId: "class_eleven", subject: "Chemistry", teacherId: anita.id },
      { id: "duplicate", classId: "class_eleven", subject: "Chemistry", teacherId: anita.id },
      { id: "other", classId: "other_class", subject: "Physics", teacherId: "another_staff" },
    ],
  });
  renderUI(<StaffDetailsView staffId={anita.id} />);
  const card = screen.getByRole("heading", { name: "Assigned classes" }).closest("div")!;
  expect(screen.getByRole("heading", { name: "Teacher timetable" })).toBeInTheDocument();
  expect(within(card).getByText("Class teacher of")).toBeInTheDocument();
  expect(within(card).getByText("Grade 8 · A", { selector: "dd" })).toBeInTheDocument();
  const table = within(screen.getByRole("table", { name: "Teaching assignments" }));
  expect(table.getAllByRole("row")).toHaveLength(3);
  expect(table.getByText("Class teacher")).toBeInTheDocument();
  expect(table.getByText("Mathematics")).toBeInTheDocument();
  expect(table.getByText("Grade 11 · Home Science · B")).toBeInTheDocument();
  expect(table.getAllByText("Chemistry")).toHaveLength(1);
  expect(table.queryByText("Physics")).not.toBeInTheDocument();
});

it("shows a class-teacher class even when no subject assignment exists", () => {
  seed({ staff: [anita], classes: [{ id: "cls_10B", grade: "10", section: "B", classTeacherId: anita.id }] });
  renderUI(<StaffDetailsView staffId={anita.id} />);
  const table = within(screen.getByRole("table", { name: "Teaching assignments" }));
  expect(table.getByText("Grade 10 · B")).toBeInTheDocument();
  expect(table.getByText("Class teacher")).toBeInTheDocument();
});

it("shows an empty class assignment state for a teacher and hides it for a driver", () => {
  seed({ staff: [anita] });
  const { unmount } = renderUI(<StaffDetailsView staffId={anita.id} />);
  expect(screen.getByText("No classes assigned.")).toBeInTheDocument();
  expect(screen.getByText("Not assigned", { selector: "dd" })).toBeInTheDocument();
  unmount();

  seed({ staff: [{ ...anita, role: "Driver", staffRole: "driver" }] });
  renderUI(<StaffDetailsView staffId={anita.id} />);
  expect(screen.queryByRole("heading", { name: "Assigned classes" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Teacher timetable" })).not.toBeInTheDocument();
});

it("shows monthly attendance for the selected staff member only", async () => {
  seed({ staff: [anita], staff_attendance: [
    { id: "mine", staffId: anita.id, date: "2025-01-09", in: "08:03", out: "16:05", status: "Present" },
    { id: "other", staffId: "another_staff", date: "2025-01-09", in: "08:55", status: "Late" },
  ] });
  renderUI(<StaffDetailsView staffId={anita.id} />);
  const month = screen.getByLabelText("Attendance month");
  fireEvent.change(month, { target: { value: "2025-01" } });
  const table = within(await screen.findByRole("table", { name: "Monthly attendance" }));
  expect(table.getByText("08:03 AM")).toBeInTheDocument();
  expect(table.getByText("04:05 PM")).toBeInTheDocument();
  expect(table.queryByText("Late")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Assigned bus" })).not.toBeInTheDocument();
  fireEvent.change(month, { target: { value: "2025-02" } });
  expect(screen.getByText("No attendance recorded for this month.")).toBeInTheDocument();
});

it("shows the driver's transport attendance, assigned bus and current student count", async () => {
  const driver = { ...anita, id: "driver_staff", role: "Driver", staffRole: "driver" };
  seed({
    staff: [driver],
    tr_crew: [{ id: "driver_crew", staffId: driver.id, role: "driver" }],
    tr_crew_attendance: [
      { id: "driver_day", crewId: "driver_crew", date: "2025-01-09", in: "06:43", out: "16:05", status: "Late" },
    ],
    staff_leaves: [{ id: "old_leave", staffId: driver.id, type: "Casual Leave", from: "2025-01-07", days: 1, status: "Approved" }],
    tr_crew_leaves: [
      { id: "crew_leave", crewId: "driver_crew", type: "Sick Leave", from: "2025-01-10", days: 1, status: "Pending" },
      { id: "other_leave", crewId: "other_crew", type: "Unrelated leave", from: "2025-01-10", days: 1, status: "Pending" },
    ],
    tr_buses: [{ id: "bus_14", number: "14", routeName: "Route 4B", driverId: "driver_crew", studentCount: 99 }],
    students: [
      { id: "assigned", busId: "bus_14" }, { id: "deleted", busId: "bus_14", deleted: true },
      { id: "elsewhere", busId: "bus_15" },
    ],
  });
  renderUI(<StaffDetailsView staffId={driver.id} />);
  fireEvent.change(screen.getByLabelText("Attendance month"), { target: { value: "2025-01" } });
  const table = within(await screen.findByRole("table", { name: "Monthly attendance" }));
  expect(table.getByText("06:43 AM")).toBeInTheDocument();
  expect(table.getByText("Late")).toBeInTheDocument();
  expect(screen.getByText("Bus 14")).toBeInTheDocument();
  expect(screen.getByText("Route 4B")).toBeInTheDocument();
  expect(screen.getByText("1 student assigned")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Leave history" })).toBeInTheDocument();
  expect(screen.getByText("Sick Leave")).toBeInTheDocument();
  expect(screen.getByText("Casual Leave")).toBeInTheDocument();
  expect(screen.queryByText("Unrelated leave")).not.toBeInTheDocument();
});

it("saves payroll bank details, masks the account number and records a payment from Staff Details", async () => {
  seed({ staff: [anita] });
  const bank = { bank: "Test Bank", branch: "", accountHolder: "Anita Sharma", ifsc: "TEST0001234", lastFour: "7890" };
  const number = "001234567890";
  const account = vi.spyOn(staffPayroll, "saveStaffPayrollAccount").mockResolvedValueOnce({ account: bank });
  vi.spyOn(staffPayroll, "revealStaffPayrollAccount").mockResolvedValueOnce({ accountNumber: number });
  const payment = vi.spyOn(staffPayroll, "recordStaffPayrollPayment").mockResolvedValueOnce({
    payment: { month: "2025-01", paidOn: "2025-02-01", grossPaise: 1500000, deductionsPaise: 10000, netPaise: 1490000, reference: "PAY-1" },
  });
  const { user } = renderUI(<StaffDetailsView staffId={anita.id} />);
  await user.click(await screen.findByRole("button", { name: "Add bank details" }));
  const bankEditor = dialog("Payroll bank details");
  await user.type(field("Account holder", bankEditor), bank.accountHolder);
  await user.type(field("Bank name", bankEditor), bank.bank);
  await user.type(field("IFSC", bankEditor), bank.ifsc);
  await user.type(field("Account number", bankEditor), number);
  await user.click(within(bankEditor).getByRole("button", { name: "Save" }));
  expect(account).toHaveBeenCalledWith(anita.id, {
    bank: bank.bank, branch: "", accountHolder: bank.accountHolder, ifsc: bank.ifsc, accountNumber: number,
  });
  expect(await screen.findByText("•••• 7890")).toBeInTheDocument();
  expect(screen.queryByText(number)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Show account number" }));
  expect(await screen.findByText(number)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Hide account number" }));
  expect(screen.queryByText(number)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Record payment" }));
  const payEditor = dialog("Record payroll payment");
  fireEvent.change(field("Payroll month", payEditor), { target: { value: "2025-01" } });
  fireEvent.change(field("Payment date", payEditor), { target: { value: "2025-02-01" } });
  await user.type(field("Gross pay (₹)", payEditor), "15000");
  await user.clear(field("Deductions (₹)", payEditor));
  await user.type(field("Deductions (₹)", payEditor), "100");
  await user.type(field("Payment reference", payEditor), "PAY-1");
  await user.click(within(payEditor).getByRole("button", { name: "Save" }));
  expect(payment).toHaveBeenCalledWith(anita.id, { month: "2025-01", paidOn: "2025-02-01", gross: "15000", deductions: "100", reference: "PAY-1" });
  expect(await screen.findByText("₹14,900.00")).toBeInTheDocument();
});

it("shows the selected staff member's full saved profile and lets the admin reveal the password", async () => {
  const driver = { ...anita, id: "stf_driver", name: "Sample Driver", department: "Transport", role: "Driver", profileVersion: 1 };
  seed({ staff: [anita, driver] });
  vi.spyOn(staffProfiles, "loadStaffProfile").mockResolvedValueOnce({ profile: {
    category: "Non-Teaching", designation: "Driver", birthDate: "1992-04-12", nationality: "IN", employmentType: "Contract",
    contractStart: "2026-01-01", contractEnd: "2026-12-31", licenseNumber: "TEST-4321", licenseExpiry: "2030-01-01",
    currentAddress: { ...staffProfiles.blankAddress, line1: "12 Example Lane", country: "IN", state: "Kerala" }, sameAddress: true,
    emergency: { ...staffProfiles.blankEmergency, name: "Emergency Contact" },
    qualifications: [{ ...staffProfiles.blankQualification, course: "Driver training" }],
  }, photo: null });
  vi.spyOn(staffFiles, "listStaffDocuments").mockResolvedValueOnce({ documents: [
    { id: "older", generation: "1", category: "education", name: "Older certificate.pdf", uploadedAt: "2026-11-10T12:00:00Z" },
  ] });
  const { user } = renderUI(<StaffDetailsView staffId={driver.id} />);
  expect(screen.getByRole("heading", { name: driver.name })).toBeInTheDocument();
  expect(screen.queryByText(anita.name)).not.toBeInTheDocument();
  expect(await screen.findByText("TEST-4321")).toBeInTheDocument();
  expect(screen.getAllByText("12 Example Lane")).toHaveLength(2);
  expect(screen.getByText("Emergency Contact")).toBeInTheDocument();
  expect(screen.getByText("Driver training")).toBeInTheDocument();
  expect(screen.getByText("2026-12-31")).toBeInTheDocument();
  const documents = within(screen.getByRole("region", { name: "Staff documents" }));
  expect(await documents.findByLabelText("Upload Driving licence or professional certificate")).toBeInTheDocument();
  expect(documents.queryByLabelText("Upload Educational certificate")).not.toBeInTheDocument();
  expect(documents.queryByLabelText("Upload Resume / CV")).not.toBeInTheDocument();
  expect(documents.getByRole("button", { name: "Preview Older certificate.pdf" })).toBeInTheDocument();
  expect(documents.queryByLabelText("Replace Older certificate.pdf")).not.toBeInTheDocument();
  expect(screen.queryByText("024681")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Show password" }));
  expect(callableCalls.at(-1)).toEqual(["revealStaffAppPassword", { staffId: driver.id }]);
  expect(screen.getByLabelText("App password")).toHaveTextContent("024681");
});

it("uploads a photo and replaces a categorized document directly from staff details", async () => {
  seed({ staff: [{ ...anita, designation: "Senior Faculty" }] });
  vi.spyOn(staffProfiles, "loadStaffProfile").mockResolvedValueOnce({ profile: null, photo: null });
  vi.spyOn(staffFiles, "listStaffDocuments").mockResolvedValueOnce({ documents: [] });
  const photo = "data:image/jpeg;base64,/9j/Af/Z";
  const savePhoto = vi.spyOn(staffFiles, "uploadStaffPhoto").mockResolvedValueOnce({ photo });
  const document: staffFiles.StaffDocument = {
    id: "doc_1", generation: "1", category: "education", name: "Certificate.pdf", uploadedAt: "2026-11-10T12:00:00Z",
  };
  const upload = vi.spyOn(staffFiles, "uploadStaffDocument")
    .mockResolvedValueOnce({ document })
    .mockResolvedValueOnce({ document: { ...document, generation: "2", name: "Replacement.pdf" } });
  const { user } = renderUI(<StaffDetailsView staffId={anita.id} />);

  const picture = new File(["picture"], "portrait.png", { type: "image/png" });
  const documents = screen.getByRole("region", { name: "Staff documents" });
  await user.upload(within(documents).getByLabelText("Upload profile photo"), picture);
  expect(savePhoto).toHaveBeenCalledWith(anita.id, picture);
  expect(await screen.findByRole("img", { name: `Profile photo of ${anita.name}` })).toHaveAttribute("src", photo);

  const certificate = new File(["%PDF-1.7"], document.name, { type: "application/pdf" });
  expect(await within(documents).findByLabelText("Upload Professional certificate")).toBeInTheDocument();
  expect(within(documents).queryByLabelText("Upload Driving licence or professional certificate")).not.toBeInTheDocument();
  await user.upload(await within(documents).findByLabelText("Upload Educational certificate"), certificate);
  expect(upload).toHaveBeenCalledWith(anita.id, "education", certificate, undefined);
  expect(await screen.findByRole("button", { name: "Preview Certificate.pdf" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Download Certificate.pdf" })).toBeInTheDocument();

  const replacement = new File(["%PDF-1.7"], "Replacement.pdf", { type: "application/pdf" });
  await user.upload(screen.getByLabelText("Replace Certificate.pdf"), replacement);
  expect(upload).toHaveBeenLastCalledWith(anita.id, "education", replacement, document);
  expect(await within(documents).findByRole("button", { name: "Preview Replacement.pdf" })).toBeInTheDocument();
  expect(within(documents).queryByRole("button", { name: "Preview Certificate.pdf" })).not.toBeInTheDocument();
});

it("sets up a driver app login from the Add Staff form", async () => {
  seed({ staff: [{ ...anita, empId: "fc-0028" }], set_config: [{ id: "staff_numbering", template: "FC-{SEQ:4}", start: 10, next: 28 }],
    school: [{ id: "school", state: "IN.13", district: "IN.13.595", city: "Kochi" }] });
  const { user } = renderUI(<StaffView />);
  await user.click(screen.getByRole("button", { name: "Add Staff" }));
  const add = dialog("Add Staff");
  expect(within(add).queryByLabelText(/Login email/)).not.toBeInTheDocument();
  await user.click(within(add).getByRole("switch", { name: "Enable app access" }));
  await user.type(field("Login email", add), "driver@example.test");
  await user.click(within(add).getByRole("button", { name: "Generate password" }));
  const generatedPassword = field("Password", add).value;
  expect(generatedPassword).toMatch(/^\d{6}$/);
  expect(field("Employee ID", add)).toHaveValue("FC-0029");
  expect(field("Employee ID", add)).toHaveAttribute("readonly");
  await user.click(within(add).getByRole("checkbox", { name: "Enter employee ID manually" }));
  await user.type(field("Employee ID", add), "MANUAL-1");
  expect(field("Employee ID", add)).toHaveValue("MANUAL-1");
  await user.click(within(add).getByRole("checkbox", { name: "Enter employee ID manually" }));
  expect(field("Employee ID", add)).toHaveValue("FC-0029");
  await user.type(field("First name", add), "Ravi");
  await user.type(field("Last name", add), "Kumar");
  fireEvent.change(field("Date of birth", add), { target: { value: "1990-04-10" } });
  await user.selectOptions(field("Gender", add), "Male");
  await user.selectOptions(field("Nationality", add), "IN");
  await user.type(field("Mobile number", add), "9000000001");
  const current = within(add).getByRole("group", { name: "Current address" });
  expect(field("State", current)).toBeDisabled();
  await user.selectOptions(field("Country", current), "IN");
  await user.selectOptions(field("State", current), "IN.13");
  await user.selectOptions(field("District", current), "IN.13.595");
  await user.selectOptions(field("City", current), "Kochi");
  await user.click(within(add).getByRole("checkbox", { name: "Permanent address is the same as current address" }));
  const permanent = within(add).getByRole("group", { name: "Permanent address" });
  await user.selectOptions(field("Country", permanent), "IN");
  await user.selectOptions(field("State", permanent), "IN.13");
  await user.selectOptions(field("District", permanent), "other");
  await user.type(field("District name", permanent), "Example district");
  await user.selectOptions(field("City", permanent), "other");
  await user.type(field("City name", permanent), "Example city");
  await user.selectOptions(field("Staff category", add), "Non-Teaching");
  await user.type(field("Relevant skills", add), "Office administration");
  expect(within(add).queryByRole("combobox", { name: "Department" })).not.toBeInTheDocument();
  await user.selectOptions(field("Designation", add), "Driver");
  expect(within(add).getByRole("heading", { name: "Driver details" })).toBeInTheDocument();
  expect(within(add).queryByRole("heading", { name: "Non-teaching details" })).not.toBeInTheDocument();
  expect(within(add).queryByLabelText("Relevant skills")).not.toBeInTheDocument();
  expect(within(add).queryByRole("combobox", { name: /Department/ })).not.toBeInTheDocument();
  fireEvent.change(field("Joining date", add), { target: { value: "2026-01-01" } });
  await user.selectOptions(field("Employment type", add), "Permanent");
  await user.type(field("Driving licence number", add), "TEST-0001");
  expect(within(add).queryByLabelText("Licence type")).not.toBeInTheDocument();
  fireEvent.change(field("Licence expiry date", add), { target: { value: "2030-01-01" } });
  expect(within(add).queryByLabelText("Vehicle category")).not.toBeInTheDocument();
  await user.type(field("Contact person name", add), "Example Contact");
  await user.type(field("Relationship", add), "Sibling");
  await user.type(field("Emergency mobile number", add), "9000000002");
  await user.click(within(add).getByRole("button", { name: "Save profile and enable app access" }));
  expect(callableCalls[0]).toEqual(["saveStaffProfile", expect.objectContaining({ profile: expect.objectContaining({
    empId: "", contactEmail: "", designation: "Driver", department: "Transport", skills: "",
    licenseNumber: "TEST-0001", licenseExpiry: "2030-01-01",
    currentAddress: expect.objectContaining({ country: "IN", state: "Kerala", district: "Ernakulam", city: "Kochi" }),
    permanentAddress: expect.objectContaining({ country: "IN", state: "Kerala", district: "Example district", city: "Example city" }),
  }) })]);
  expect(callableCalls[0]?.[1]).not.toHaveProperty("password");
  expect(within(add).getByText("Employee ID EMP-1001")).toBeInTheDocument();
  expect(callableCalls.at(-1)).toEqual(["setStaffAppLogin", { staffId: "stf_new_profile", email: "driver@example.test", role: "driver", password: generatedPassword }]);
  expect(within(add).getByLabelText("App password")).toHaveTextContent(generatedPassword);
  await user.click(within(add).getByRole("button", { name: "Hide password" }));
  expect(within(add).queryByText(generatedPassword)).not.toBeInTheDocument();
});

it("retries app access without saving a second profile", async () => {
  const login = vi.spyOn(staffProfiles, "setStaffAppLogin").mockRejectedValueOnce(new Error("This email is already linked."));
  const { user } = renderUI(<StaffView />);
  await user.click(screen.getByRole("button", { name: "Add Staff" }));
  const add = dialog("Add Staff");
  await user.selectOptions(field("Staff category", add), "Non-Teaching");
  await user.selectOptions(field("Designation", add), "Driver");
  await user.click(within(add).getByRole("switch", { name: "Enable app access" }));
  await user.type(field("Login email", add), "driver@example.test");
  await user.click(within(add).getByRole("button", { name: "Save profile and enable app access" }));
  expect(await within(add).findByText("Staff profile saved. This email is already linked.")).toBeInTheDocument();
  expect(field("Login email", add)).toHaveValue("driver@example.test");
  await user.clear(field("Login email", add));
  await user.type(field("Login email", add), "new-driver@example.test");
  await user.click(within(add).getByRole("button", { name: "Save app login" }));
  expect(login).toHaveBeenLastCalledWith("stf_new_profile", { email: "new-driver@example.test", role: "driver" });
  expect(callableCalls.filter(([name]) => name === "saveStaffProfile")).toHaveLength(1);
  expect(within(add).getByLabelText("App password")).toHaveTextContent("024681");
});

it("offers only active catalog subjects when adding a teacher", async () => {
  seed({ classes: [{ id: "1A", subjects: ["Science", "English"] }], set_config: [{ id: "subjects", subjects: [
    { name: "Science", active: false }, { name: "Computing", active: true }, { name: "Mathematics", active: true },
  ] }] });
  const { user } = renderUI(<StaffView />);
  await user.click(screen.getByRole("button", { name: "Add Staff" }));
  const staff = dialog("Add Staff");
  await user.selectOptions(field("Staff category", staff), "Teaching");
  const designations = within(field("Designation", staff));
  expect(designations.getByRole("option", { name: "Teacher" })).toBeInTheDocument();
  expect(designations.queryByRole("option", { name: /^(PGT|TGT|PRT)$/ })).not.toBeInTheDocument();
  expect(designations.queryByRole("option", { name: "Head of Department" })).not.toBeInTheDocument();
  expect(within(staff).queryByRole("combobox", { name: "Department" })).not.toBeInTheDocument();
  await user.selectOptions(field("Subject", staff), within(field("Subject", staff)).getByRole("option", { name: "Computing" }));
  const additional = within(staff).getByRole("group", { name: "Additional subjects" });
  const math = within(additional).getByRole("checkbox", { name: "Mathematics" });
  await user.click(math);
  expect(math).toBeChecked();
  expect(within(additional).queryByRole("checkbox", { name: "Science" })).not.toBeInTheDocument();
  expect(within(additional).queryByRole("checkbox", { name: "English" })).not.toBeInTheDocument();
  expect(within(additional).queryByRole("checkbox", { name: "Computing" })).not.toBeInTheDocument();
  expect(within(staff).queryByLabelText("Teaching level")).not.toBeInTheDocument();

  await user.selectOptions(field("Subject", staff), within(field("Subject", staff)).getByRole("option", { name: "Mathematics" }));
  expect(within(additional).queryByRole("checkbox", { name: "Mathematics" })).not.toBeInTheDocument();
  await user.selectOptions(field("Subject", staff), within(field("Subject", staff)).getByRole("option", { name: "Computing" }));
  expect(within(additional).getByRole("checkbox", { name: "Mathematics" })).not.toBeChecked();
});

it("offers a shared subject once without department names when adding a teacher", async () => {
  seed({ set_config: [{ id: "subjects",
    departments: [{ id: "science", name: "Science" }, { id: "home", name: "Home Science" }],
    subjects: [
      { id: "chemistry", name: "Chemistry", active: true },
      { id: "chem_science", name: "Chemistry", active: true, departmentId: "science" },
      { id: "chem_home", name: "Chemistry", active: true, departmentId: "home" },
    ],
  }] });
  const { user } = renderUI(<StaffView />);
  await user.click(screen.getByRole("button", { name: "Add Staff" }));
  const staff = dialog("Add Staff");
  await user.selectOptions(field("Staff category", staff), "Teaching");
  const primary = field("Subject", staff);
  const chemistryLabel = "Chemistry";
  expect(within(primary).getAllByRole("option", { name: chemistryLabel })).toHaveLength(1);
  const additionalBeforeSelection = within(staff).getByRole("group", { name: "Additional subjects" });
  await user.click(within(additionalBeforeSelection).getByRole("checkbox", { name: chemistryLabel }));
  expect(within(additionalBeforeSelection).getByRole("checkbox", { name: chemistryLabel })).toBeChecked();
  expect(within(primary).queryByRole("option", { name: /Chemistry ·/ })).not.toBeInTheDocument();
  await user.selectOptions(primary, within(primary).getByRole("option", { name: chemistryLabel }));
  const additional = within(staff).getByRole("group", { name: "Additional subjects" });
  expect(within(additional).queryByRole("checkbox", { name: /Chemistry/ })).not.toBeInTheDocument();
  expect(primary).toHaveDisplayValue(chemistryLabel);
});

it("opens and saves older department-specific teacher subjects as one subject", async () => {
  seed({ staff: [{ ...anita, profileVersion: 1 }], set_config: [{ id: "subjects",
    departments: [{ id: "science", name: "Science" }, { id: "home", name: "Home Science" }],
    subjects: [
      { id: "chemistry", name: "Chemistry", active: true },
      { id: "chem_science", name: "Chemistry", active: true, departmentId: "science" },
      { id: "chem_home", name: "Chemistry", active: true, departmentId: "home" },
    ],
  }] });
  vi.spyOn(staffProfiles, "loadStaffProfile").mockResolvedValue({ profile: {
    category: "Teaching", designation: "Teacher", primarySubject: "Chemistry · Science", primarySubjectId: "chem_science",
    additionalSubjects: ["Chemistry · Home Science"], additionalSubjectIds: ["chem_home"],
  }, photo: null });
  const save = vi.spyOn(staffProfiles, "saveStaffProfile").mockResolvedValue({ staffId: anita.id, empId: anita.empId });
  const { user } = renderUI(<StaffDetailsView staffId={anita.id} />);
  expect(await screen.findByText("Chemistry", { selector: "dd" })).toBeInTheDocument();
  expect(screen.queryByText("Chemistry · Science")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Edit" }));
  const staff = dialog("Staff profile");
  expect(await within(staff).findByRole("combobox", { name: /^Subject/ })).toHaveDisplayValue("Chemistry");
  expect(within(staff).queryByRole("checkbox", { name: /Chemistry/ })).not.toBeInTheDocument();
  await user.click(within(staff).getByRole("button", { name: "Save staff profile" }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ profile: expect.objectContaining({
    primarySubject: "Chemistry", primarySubjectId: "chemistry", additionalSubjects: [], additionalSubjectIds: [],
  }) }));
});

it("shows configured departments for teachers and requires one for HOD", async () => {
  seed({ set_config: [{ id: "subjects", subjects: [{ name: "Science", active: true }],
    departments: [{ id: "dept_science", name: "Science Department" },
      { id: "old_science", name: "Science" }, { id: "science", name: "science" }, { id: "science", name: "Science" }] }] });
  const { user } = renderUI(<StaffView />);
  await user.click(screen.getByRole("button", { name: "Add Staff" }));
  const staff = dialog("Add Staff");
  await user.selectOptions(field("Staff category", staff), "Teaching");
  await user.selectOptions(field("Designation", staff), "Teacher");
  await user.click(within(staff).getByRole("switch", { name: "Enable app access" }));
  expect(field("Login email", staff)).toBeInTheDocument();
  expect(within(staff).queryByLabelText("App access role")).not.toBeInTheDocument();
  await user.click(within(staff).getByRole("switch", { name: "Enable app access" }));
  const department = field("Department", staff);
  expect(department).toHaveValue("");
  expect(department).not.toBeRequired();
  expect(within(department).getAllByRole("option", { name: "Science" })).toHaveLength(1);
  expect(within(department).getByRole("option", { name: "Science" })).toHaveValue("science");
  expect(within(department).getByRole("option", { name: "No department" })).toBeInTheDocument();
  await user.selectOptions(field("Designation", staff), "Head of Department");
  expect(department).toBeRequired();
  await user.click(within(staff).getByRole("button", { name: "Save staff profile" }));
  expect(fieldError("Department", staff)).toBe("Choose a department for the Head of Department.");
  await user.selectOptions(department, "dept_science");
  expect(department).toHaveValue("dept_science");
  await user.selectOptions(field("Staff category", staff), "Non-Teaching");
  expect(within(staff).queryByRole("combobox", { name: "Department" })).not.toBeInTheDocument();
});

it("reveals a saved app password when an admin reopens the staff profile", async () => {
  seed({ staff: [{ ...anita, profileVersion: 1 }], set_config: [{ id: "subjects", subjects: [{ name: "Mathematics", active: false }] }] });
  const saved = { profile: { category: "Teaching", designation: "Teacher", workShift: "Morning", teachingLevel: "Primary", primarySubject: "Mathematics", additionalSubjects: ["Science"] }, photo: null };
  vi.spyOn(staffProfiles, "loadStaffProfile").mockResolvedValueOnce(saved).mockResolvedValueOnce(saved);
  const { user } = renderUI(<StaffDetailsView staffId={anita.id} />);
  expect(await screen.findByText("Teaching", { selector: "dd" })).toBeInTheDocument();
  expect(screen.queryByText("Work shift", { selector: "dt" })).not.toBeInTheDocument();
  expect(screen.queryByText("Teaching level", { selector: "dt" })).not.toBeInTheDocument();
  expect(screen.getByText("Subject", { selector: "dt" })).toBeInTheDocument();
  expect(screen.getByText("Mathematics", { selector: "dd" })).toBeInTheDocument();
  expect(screen.queryByText("Department", { selector: "dt" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Edit" }));
  const staff = dialog("Staff profile");
  const appLogin = await within(staff).findByRole("button", { name: "App login" });
  expect(within(staff).queryByLabelText("Work shift")).not.toBeInTheDocument();
  expect(field("Subject", staff)).toHaveDisplayValue("Mathematics");
  expect(within(staff).getByRole("checkbox", { name: "Science" })).toBeChecked();
  expect(within(staff).queryByRole("combobox", { name: /Department/ })).not.toBeInTheDocument();
  await user.click(appLogin);
  expect(within(staff).queryByText("024681")).not.toBeInTheDocument();
  await user.click(await within(staff).findByRole("button", { name: "Show password" }));
  expect(callableCalls.at(-1)).toEqual(["revealStaffAppPassword", { staffId: anita.id }]);
  expect(within(staff).getByLabelText("App password")).toHaveTextContent("024681");
});

it("opens a saved text address with known locations selected and a custom city preserved", async () => {
  seed({ staff: [{ ...anita, profileVersion: 1 }] });
  const saved = { profile: {
    currentAddress: { ...staffProfiles.blankAddress, country: "IN", state: "Kerala", district: "Ernakulam", city: "Saved locality" },
  }, photo: null };
  vi.spyOn(staffProfiles, "loadStaffProfile").mockResolvedValueOnce(saved).mockResolvedValueOnce(saved);
  const { user } = renderUI(<StaffDetailsView staffId={anita.id} />);
  await user.click(screen.getByRole("button", { name: "Edit" }));
  const current = await screen.findByRole("group", { name: "Current address" });
  expect(field("State", current)).toHaveValue("IN.13");
  expect(field("District", current)).toHaveValue("IN.13.595");
  expect(field("City", current)).toHaveValue("other");
  expect(field("City name", current)).toHaveValue("Saved locality");
});

describe("Staff form validation", () => {
  it("requires only name, email and role before provisioning", async () => {
    const { user } = await openAdd();
    const add = dialog("Add Staff");
    expect(add.querySelectorAll("input, select")).toHaveLength(3);
    await user.click(within(add).getByRole("button", { name: "Add Staff & Create Login" }));
    expect(fieldError("Name", add)).toBe("Enter a name from 2 to 120 characters.");
    expect(fieldError("Email", add)).toBe("Enter a valid email address.");
    expect(fieldError("Role", add)).toBe("Choose a role.");
    expect(callableCalls).toHaveLength(0);
  });

  it("checks for a directory email already in use", async () => {
    seed({ staff: [anita] });
    const { user } = await openAdd();
    await user.type(field("Name"), "Ravi Kumar");
    await user.type(field("Email"), "Anita.Sharma@greenfield.edu");
    await user.selectOptions(field("Role"), "teacher");
    await user.click(screen.getByRole("button", { name: "Add Staff & Create Login" }));
    expect(fieldError("Email")).toBe("Another staff member already uses this email.");
    expect(callableCalls).toHaveLength(0);
  });

  it("provisions a Principal and reports the server's invitation result", async () => {
    const { user } = await openAdd();
    await user.type(field("Name"), "  Ravi Kumar ");
    await user.type(field("Email"), "RAVI@greenfield.edu");
    await user.selectOptions(field("Role"), "principal");
    await user.click(screen.getByRole("button", { name: "Add Staff & Create Login" }));
    expect(callableCalls).toEqual([["createSchoolStaff", { name: "Ravi Kumar", email: "ravi@greenfield.edu", role: "principal", invitationId: expect.any(String) }]]);
    expect(sentInvites).toEqual([]);
    expect(await screen.findByText("Login created. Password email sent to ravi@greenfield.edu")).toBeInTheDocument();
  });

  it("resends a role-based staff invitation through the server using the staff ID", async () => {
    seed({ staff: [{ ...anita, staffRole: "teacher" }] });
    const { user } = renderUI(<StaffDetailsView staffId={anita.id} />);
    await user.click(screen.getByRole("button", { name: "Resend invite" }));
    expect(callableCalls.filter(([name]) => name === "resendSchoolStaffInvite")).toEqual([["resendSchoolStaffInvite", { staffId: anita.id }]]);
    expect(sentInvites).toEqual([]);
    expect(await screen.findByText(`Password email sent to ${anita.email}`)).toBeInTheDocument();
  });

  it("completes Add Staff when the account is created without an invitation email", async () => {
    vi.spyOn(staffInvitation, "createStaffInvitation").mockResolvedValueOnce(false);
    const { user } = await openAdd();
    await user.type(field("Name"), "Ravi Kumar");
    await user.type(field("Email"), "ravi@greenfield.edu");
    await user.selectOptions(field("Role"), "principal");
    await user.click(screen.getByRole("button", { name: "Add Staff & Create Login" }));
    expect(await screen.findByText("Staff account created.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Add Staff" })).not.toBeInTheDocument();
  });

  it("does not show Add Staff to the platform owner", () => {
    authState.user = { ...authState.user!, role: "owner" };
    renderUI(<StaffView />);
    expect(screen.queryByRole("button", { name: "Add Staff" })).not.toBeInTheDocument();
  });

  it("locks the email of a staff member whose login exists", async () => {
    seed({ staff: [anita] });
    const { user } = renderUI(<StaffDetailsView staffId={anita.id} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(field("Email (teacher login)")).toBeDisabled();
  });
});

describe("Staff edit", () => {
  it("saves trimmed fields on the existing doc and keeps the login email", async () => {
    seed({ staff: [anita] });
    const { user } = renderUI(<StaffDetailsView staffId={anita.id} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(field("Designation"));
    await user.type(field("Designation"), "  Senior Faculty ");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(getRow("staff", "stf_025")).toMatchObject({ designation: "Senior Faculty", email: "anita.sharma@greenfield.edu", authUid: "uid_anita", updatedBy: "admin_uid" });
    expect(writesTo("users")).toHaveLength(0);
    expect(await screen.findByText("Staff updated")).toBeInTheDocument();
  });

  it("refuses a joining date in the future", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 4, 10));
    seed({ staff: [anita] });
    const { user } = renderUI(<StaffDetailsView staffId={anita.id} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(field("Joined"), { target: { value: "2026-12-01" } });
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(fieldError("Joined")).toBe("The joining date cannot be in the future");
    expect(writes).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe("Record leave (office)", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 4, 10)); }); // Wed 4 Nov 2026
  afterEach(() => { vi.useRealTimers(); });

  async function openLeave() {
    seed({ staff: [anita] });
    const r = renderUI(<StaffDetailsView staffId={anita.id} />);
    await r.user.click(screen.getByRole("button", { name: "Record leave" }));
    return { ...r, dlg: dialog("Record leave") };
  }

  it("refuses an end date before the start and writes nothing", async () => {
    const { user, dlg } = await openLeave();
    fireEvent.change(field("To", dlg), { target: { value: "2026-11-03" } });
    expect(fieldError("To", dlg)).toBe("End date is before start");
    await user.click(within(dlg).getByRole("button", { name: "Mark on leave" }));
    expect(writes).toHaveLength(0);
  });

  it("refuses a range of only Sundays", async () => {
    const { user, dlg } = await openLeave();
    fireEvent.change(field("From", dlg), { target: { value: "2026-11-08" } });
    fireEvent.change(field("To", dlg), { target: { value: "2026-11-08" } });
    await user.click(within(dlg).getByRole("button", { name: "Mark on leave" }));
    expect(fieldError("To", dlg)).toBe("The selected dates only include Sundays");
    expect(writes).toHaveLength(0);
  });

  it("refuses dates overlapping another leave of the same teacher", async () => {
    seed({ staff_leaves: [{ id: "lv1", staffId: "stf_025", type: "Casual Leave", from: "2026-11-04", to: "2026-11-05", days: 2, reason: "", status: "Pending" }] });
    const { user, dlg } = await openLeave();
    await user.click(within(dlg).getByRole("button", { name: "Mark on leave" }));
    expect(fieldError("From", dlg)).toBe("This staff member already has leave on these dates");
    expect(writes).toHaveLength(0);
  });

  it("writes an Approved staff_leaves doc and marks the teacher On leave when it includes today", async () => {
    const { user, dlg } = await openLeave();
    fireEvent.change(field("To", dlg), { target: { value: "2026-11-06" } });
    await user.selectOptions(field("Leave type", dlg), "Medical Leave");
    await user.type(field("Reason", dlg), "Viral fever");
    await user.click(within(dlg).getByRole("button", { name: "Mark on leave" }));
    expect(getRow("staff_leaves", "sl_stf_025_2026-11-04")).toMatchObject({ staffId: "stf_025", type: "Medical Leave", from: "2026-11-04", to: "2026-11-06", days: 3, reason: "Viral fever", status: "Approved", decidedBy: "admin_uid", source: "admin" });
    expect(getRow("staff", "stf_025")).toMatchObject({ status: "On leave", leaveFrom: "2026-11-04", leaveTo: "2026-11-06", leaveReason: "Viral fever" });
    expect(await screen.findByText("Mrs. Anita Sharma marked on leave")).toBeInTheDocument();
    expect(rowsOf("approvals")).toHaveLength(0); // already decided: no inbox row
  });

  it("a future leave is recorded without changing today's status", async () => {
    const { user, dlg } = await openLeave();
    fireEvent.change(field("From", dlg), { target: { value: "2026-11-09" } });
    fireEvent.change(field("To", dlg), { target: { value: "2026-11-10" } });
    await user.click(within(dlg).getByRole("button", { name: "Mark on leave" }));
    expect(getRow("staff_leaves", "sl_stf_025_2026-11-09")).toMatchObject({ days: 2, status: "Approved" });
    expect(getRow("staff", "stf_025")).toMatchObject({ status: "Active" });
    expect(await screen.findByText("Leave recorded for Mrs. Anita Sharma")).toBeInTheDocument();
  });

  it("Mark returned clears the office leave", async () => {
    seed({ staff: [{ ...anita, status: "On leave", leaveFrom: "2026-11-03", leaveTo: "2026-11-06", leaveReason: "Training" }] });
    const { user } = renderUI(<StaffDetailsView staffId={anita.id} />);
    await user.click(screen.getByRole("button", { name: "Mark returned" }));
    expect(getRow("staff", "stf_025")).toMatchObject({ status: "Active", leaveFrom: "", leaveTo: "", leaveReason: "" });
  });
});

describe("Staff delete", () => {
  it("removes the staff doc and revokes the users/{uid} mapping", async () => {
    seed({ staff: [anita], users: [{ id: "uid_anita", schoolId: "sch_test", role: "teacher", staffId: "stf_025" }] });
    const { user } = renderUI(<StaffDetailsView staffId={anita.id} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(within(dialog("Delete staff member?")).getByRole("button", { name: "Delete" }));
    expect(getRow("staff", "stf_025")).toBeUndefined();
    expect(getRow("users", "uid_anita")).toBeUndefined();
  });
});
