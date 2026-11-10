import { render } from "@testing-library/react";
import { ToastProvider } from "@/components/ui";
import { Activity } from "react";
import { describe, expect, it, vi } from "vitest";
import StudentsPage from "@/app/(app)/students/page";
import * as admissionDocuments from "@/features/admissions/admissionDocuments";
import { blankAdmission } from "@/features/admissions/admissionDetails";
import { StudentDetailsView } from "./StudentDetailsView";
import { StudentsView } from "./StudentsView";
import { ADMIN_UID, authState, callableCalls, dialog, field, fieldError, getRow, renderUI, router, screen, seed, setUrl, userEvent, within, writes, writesTo } from "@/test/render";

type Row = Record<string, unknown>;
const aarav = { id: "stu_101", name: "Aarav Sharma", grn: "GIS-9200", grade: "10", section: "B", classId: "cls_10B", roll: 1, guardian: "Mr. Rahul Sharma", relation: "Father",
  phone: "+91 98100 00001", status: "Active", attendance: 95, guardianUids: [], busId: "bus_01", bus: "Bus 14", busStopId: "stp_01", busStop: "Sector 9" };
const ananya = { id: "stu_102", name: "Ananya Reddy", grn: "GIS-9201", grade: "10", section: "B", classId: "cls_10B", roll: 2, guardian: "Mrs. Reddy", phone: "+91 98100 00002", status: "Active", attendance: 90 };

async function openAdd() {
  const r = renderUI(<StudentsView />);
  await r.user.click(screen.getByRole("button", { name: /Add Student/ }));
  return r;
}
const save = () => within(dialog("Add Student")).getByRole("button", { name: /^Add Student(?: and enable parent access)?$/ });

describe("Add / edit student validation", () => {
  it("offers only configured senior streams and saves Commerce A separately from Science A", async () => {
    seed({ classes: [{ id: "cls_11_science_A", grade: "11", section: "A", streamId: "science" }, { id: "cls_11_commerce_A", grade: "11", section: "A", streamId: "commerce" }] });
    const { user } = await openAdd();
    await user.type(field("Student name"), "Riya Sen");
    await user.type(field("Guardian name"), "Parent");
    await user.type(field("Phone"), "9810000001");
    await user.selectOptions(field("Grade", dialog("Add Student")), "11");
    await user.click(save());
    expect(fieldError("Stream")).toContain("Choose a stream");
    await user.selectOptions(field("Stream"), "commerce");
    expect(within(field("Stream")).queryByRole("option", { name: "Humanities" })).not.toBeInTheDocument();
    await user.selectOptions(field("Section", dialog("Add Student")), "A");
    await user.click(save());
    expect(writesTo("students")[0]?.data).toMatchObject({ grade: "11", section: "A", streamId: "commerce", stream: "Commerce", classId: "cls_11_commerce_A", roll: 0 });
  });

  it("shows the required-field errors and writes nothing", async () => {
    const { user } = await openAdd();
    await user.click(save());
    expect(fieldError("Student name")).toBe("Name is required");
    expect(fieldError("Guardian name")).toBe("Guardian name is required");
    expect(fieldError("Phone")).toBe("Enter a valid phone number");
    expect(writes).toHaveLength(0);
  });

  it("rejects a bad phone, emails, attendance, future DOB and duplicate GRN", async () => {
    seed({ students: [aarav] });
    const { user } = await openAdd();
    await user.type(field("Student name"), "Kabir Das");
    await user.type(field("Guardian name"), "Mr. Das");
    await user.type(field("Phone"), "+1234567");
    await user.type(field("Email"), "kabir@mail");
    await user.type(field("Parent app login email"), "das@");
    await user.clear(field("Attendance %")); await user.type(field("Attendance %"), "120");
    await user.type(field("Date of birth"), "2030-01-01");
    await user.type(field("General Register Number (GRN)"), "gis-9200");
    await user.selectOptions(field("Grade", dialog("Add Student")), "10"); await user.selectOptions(field("Section", dialog("Add Student")), "B");
    await user.click(save());
    expect(fieldError("Phone")).toBe("Enter a valid phone number");
    expect(fieldError("Email")).toBe("Enter a valid email");
    expect(fieldError("Parent app login email")).toBe("Enter a valid email");
    expect(fieldError("Attendance %")).toBe("0–100");
    expect(fieldError("Date of birth")).toBe("Date of birth cannot be in the future");
    expect(fieldError("General Register Number (GRN)")).toBe("GRN already exists");
    expect(writes).toHaveLength(0);

  });

  it("refuses a parent login email that belongs to a staff login", async () => {
    seed({ users: [{ id: "uid_anita", schoolId: "sch_test", role: "teacher", email: "anita@greenfield.edu" }] });
    const { user } = await openAdd();
    await user.type(field("Student name"), "Kabir Das");
    await user.type(field("Guardian name"), "Mr. Das");
    await user.type(field("Phone"), "9810000099");
    await user.type(field("Parent app login email"), "Anita@Greenfield.edu");
    await user.click(save());
    expect(fieldError("Parent app login email")).toBe("This email belongs to a staff or admin login");
    expect(writesTo("students")).toHaveLength(0);
  });

  it("adds a student and generates a school-managed password for the entered login email", async () => {
    seed({ students: [aarav, ananya, { ...ananya, id: "stu_150", grn: "GIS-1", roll: 9, deleted: true }] });
    const { user } = await openAdd();
    await user.type(field("Student name"), "  Kabir Das ");
    await user.type(field("Guardian name"), "Mr. Das");
    await user.type(field("Phone"), "+91 98100 00003");
    await user.type(field("Parent app login email"), " Das@Mail.com");
    await user.selectOptions(field("Grade", dialog("Add Student")), "10"); await user.selectOptions(field("Section", dialog("Add Student")), "B");
    await user.click(within(dialog("Add Student")).getByRole("button", { name: "Add Student and enable parent access" }));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: "set", coll: "students", id: "stu_151" });
    expect(getRow<Row>("students", "stu_151")).toMatchObject({ name: "Kabir Das", grade: "10", section: "B", classId: "cls_10B", roll: 0, guardian: "Mr. Das",
      phone: "+91 98100 00003", guardianEmail: "", guardianUids: [], status: "Active", attendance: 100, grn: "GIS-8804", updatedBy: ADMIN_UID });
    expect(await screen.findByText("Student added")).toBeInTheDocument();
    expect(callableCalls).toEqual([["setParentAppAccess", { studentId: "stu_151", enabled: true, email: "das@mail.com" }]]);
    const access = dialog("Parent app access");
    expect(within(access).getByText("024681")).toBeInTheDocument();
    await user.click(within(access).getByRole("button", { name: "Open Student Details" }));
    expect(router.push).toHaveBeenCalledWith("/students/stu_151");
  });

  it("edits only the form's fields: bus assignment and guardianUids are not written back", async () => {
    seed({ students: [{ ...aarav, guardianUids: ["uid_p1"] }, ananya] });
    const { user } = renderUI(<StudentDetailsView studentId={aarav.id} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByText("Roll number: 1. Assigned by the class teacher.")).toBeInTheDocument();
    await user.clear(field("Guardian name")); await user.type(field("Guardian name"), "Mr. R. Sharma");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    const w = writesTo("students");
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ op: "update", id: "stu_101" });
    expect(w[0]!.data).toMatchObject({ guardian: "Mr. R. Sharma", classId: "cls_10B", grn: "GIS-9200" });
    for (const k of ["roll", "guardianUids", "guardianEmail", "busId", "bus", "busStopId", "busStop", "id"]) expect(w[0]!.data).not.toHaveProperty(k);
    expect(getRow<Row>("students", "stu_101")).toMatchObject({ guardianUids: ["uid_p1"], busId: "bus_01" });
  });

  it("moving a student to another class clears the roll for the new class teacher", async () => {
    seed({ students: [aarav, ananya, { id: "stu_201", name: "Meera", grn: "GIS-8100", grade: "8", section: "A", classId: "cls_8A", roll: 4, guardian: "G", phone: "+91 98100 00009", status: "Active", attendance: 90 }] });
    const { user } = renderUI(<StudentDetailsView studentId={ananya.id} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(field("Grade"), "8"); await user.selectOptions(field("Section"), "A");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(getRow<Row>("students", "stu_102")).toMatchObject({ grade: "8", section: "A", classId: "cls_8A", roll: 0 });
  });

  it("links the directory rows to separate student details pages", async () => {
    seed({ students: [aarav, ananya] });
    const { user } = renderUI(<StudentsView />);
    const link = screen.getByRole("link", { name: ananya.name });
    expect(link).toHaveAttribute("href", "/students/stu_102");
    await user.click(link.closest("tr")!);
    expect(router.push).toHaveBeenCalledWith("/students/stu_102");
  });

  it("shows the exact student and their saved admission details even when names match", () => {
    const details = blankAdmission("2026-04-12", { firstName: "Ananya", gender: "Female" });
    seed({
      students: [aarav, { ...ananya, name: aarav.name, address: "14 Student Lane" }],
      adm_student_details: [
        { id: aarav.id, ...details, previousSchool: "Unrelated school" },
        {
          id: ananya.id, ...details, nationality: "IN", academicYear: "2026-27", admissionType: "Transfer",
          previousSchool: "Oak School", previousTcNo: "TC-404", bloodGroup: "O+",
          conditions: "Asthma", language: "Telugu",
          contacts: {
            ...details.contacts,
            father: { ...details.contacts.father, name: "Mr. Reddy", occupation: "Engineer" },
            guardian: { ...details.contacts.guardian, address: "22 Guardian Lane" },
          },
        },
      ],
    });
    renderUI(<StudentDetailsView studentId={ananya.id} />);
    expect(screen.getByRole("heading", { name: aarav.name })).toBeInTheDocument();
    expect(screen.getByText("Mrs. Reddy")).toBeInTheDocument();
    for (const value of ["Ananya", "India", "2026-27", "Oak School", "TC-404", "O+", "Asthma", "Telugu", "Engineer", "14 Student Lane", "22 Guardian Lane"]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    expect(screen.queryByText("Unrelated school")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to students" })).toHaveAttribute("href", "/students");
  });

  it("shows recorded attendance and leaves new students without marks unrated", () => {
    seed({
      students: [{ ...aarav, attendance: 100, admissionDate: "2026-10-01" }, { ...ananya, attendance: 100 }],
      par_attendance: [
        { id: "stu_101_2026-09", studentId: aarav.id, days: { "2026-09-30": "P" } },
        { id: "stu_101_2026-10", studentId: aarav.id, days: { "2026-10-02": "L", "2026-10-03": "A" } },
      ],
    });
    const directory = renderUI(<StudentsView />);
    expect(within(screen.getByRole("row", { name: /Aarav Sharma/ })).getByText("50%")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Ananya Reddy/ })).getByText("Not recorded")).toBeInTheDocument();
    directory.unmount();
    const profile = renderUI(<StudentDetailsView studentId={aarav.id} />);
    expect(screen.getByText("1 of 2 recorded days attended")).toBeInTheDocument();
    profile.unmount();
    renderUI(<StudentDetailsView studentId={ananya.id} />);
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });

  it("shows the student photograph and previews an uploaded PDF", async () => {
    const photoPath = "schools/sch_test/admission-documents/stu_101/photo/photo-file";
    const pdfPath = "schools/sch_test/admission-documents/stu_101/birth/birth-file";
    const uploads = {
      photo: { path: photoPath, name: "student.jpg", status: "verified", uploadedAt: "2026-10-05" },
      birth: { path: pdfPath, name: "birth.pdf", status: "pending", uploadedAt: "2026-10-05" },
    };
    seed({ students: [aarav], adm_documents: [{ id: aarav.id, expected: ["photo", "birth"], uploads }] });
    const read = vi.spyOn(admissionDocuments, "readAdmissionDocument").mockImplementation(async (path) =>
      new Blob(["test file"], { type: path === photoPath ? "image/jpeg" : "application/pdf" }));
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = (blob: Blob) => blob.type === "image/jpeg" ? "blob:student-photo" : "blob:birth-pdf";
      static revokeObjectURL = revokeObjectURL;
    });
    const profile = renderUI(<StudentDetailsView studentId={aarav.id} />);
    try {
      expect(await screen.findByRole("img", { name: `Photograph of ${aarav.name}` })).toHaveAttribute("src", "blob:student-photo");
      await profile.user.click(screen.getByRole("button", { name: "Preview Birth certificate" }));
      const preview = dialog("Preview Birth certificate");
      expect(await within(preview).findByTitle("Preview Birth certificate")).toHaveAttribute("src", "blob:birth-pdf");
      expect(read.mock.calls.map(([path]) => path)).toEqual([photoPath, pdfPath]);
      await profile.user.click(within(preview).getByRole("button", { name: "Done" }));
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:birth-pdf");
    } finally {
      profile.unmount();
      read.mockRestore();
      vi.unstubAllGlobals();
    }
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:student-photo");
  });

  it("closes delete confirmation when leaving and returning to a cached profile", async () => {
    seed({ students: [aarav] });
    const profile = (mode: "visible" | "hidden") => (
      <ToastProvider><Activity mode={mode}><StudentDetailsView studentId={aarav.id} /></Activity></ToastProvider>
    );
    const user = userEvent.setup();
    const { rerender } = render(profile("visible"));
    expect(screen.queryByRole("dialog", { name: "Delete student?" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete student?" })).toBeVisible();

    rerender(profile("hidden"));
    rerender(profile("visible"));

    expect(screen.getByRole("heading", { name: aarav.name })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Delete student?" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(within(dialog("Delete student?")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Delete student?" })).not.toBeInTheDocument();
    expect(writesTo("students")).toHaveLength(0);
  });

  it("redirects legacy student links to the new page", () => {
    setUrl("/students?student=stu_102");
    renderUI(<StudentsPage />);
    expect(router.replace).toHaveBeenCalledWith("/students/stu_102");
  });

  it("hides soft-deleted students", () => {
    seed({ students: [aarav, { ...ananya, deleted: true }] });
    renderUI(<StudentsView />);
    expect(screen.getByText("Aarav Sharma")).toBeInTheDocument();
    expect(screen.queryByText("Ananya Reddy")).toBeNull();
  });
});

describe("Parent login (contract 13.1)", () => {
  function openProfile() {
    return renderUI(<StudentDetailsView studentId={aarav.id} />);
  }
  function seedManagedParent(version = "managed") {
    seed({ students: [{ ...aarav, guardianEmail: "rahul@mail.com", guardianUids: ["uid_p1"] }],
      users: [{ id: "uid_p1", schoolId: "sch_test", role: "parent", email: "rahul@mail.com", parentCredentialVersion: version }] });
  }

  it("reveals and copies the password on demand, then masks it when the cached profile is hidden", async () => {
    seedManagedParent();
    const profile = (mode: "visible" | "hidden") => <ToastProvider>
      <Activity mode={mode}><StudentDetailsView studentId={aarav.id} /></Activity>
    </ToastProvider>;
    const user = userEvent.setup();
    const { rerender } = render(profile("visible"));
    expect(screen.getByLabelText("Parent password")).toHaveTextContent("••••••");
    expect(callableCalls).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Parent password")).toHaveTextContent("024681");
    expect(callableCalls).toEqual([["revealParentPassword", { studentId: aarav.id, version: "managed" }]]);
    await user.click(screen.getByRole("button", { name: "Copy password" }));
    expect(await navigator.clipboard.readText()).toBe("024681");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Parent password")).toHaveTextContent("••••••");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    rerender(profile("hidden"));
    rerender(profile("visible"));
    expect(screen.queryByText("024681")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Parent password")).toHaveTextContent("••••••");
  });

  it("shows the replacement instructions for an older password without changing it", async () => {
    seedManagedParent("hash-only");
    const { user } = openProfile();
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByText(/issued before viewing was available/)).toBeInTheDocument();
    expect(callableCalls).toEqual([["revealParentPassword", { studentId: aarav.id, version: "hash-only" }]]);
  });

  it("hides the password controls for staff who are not school admins", () => {
    seedManagedParent();
    authState.user = { ...authState.user!, role: "staff" };
    openProfile();
    expect(screen.queryByRole("button", { name: "Show password" })).not.toBeInTheDocument();
  });

  it("lets staff enter a separate login email and generate a school-managed password from Student Details", async () => {
    seed({ students: [{ ...aarav, email: "contact@example.com" }] });
    const { user } = openProfile();
    const access = screen.getByRole("switch", { name: "Enable parent app access" });
    expect(access).not.toBeChecked();
    await user.click(access);
    expect(field("Login email")).toHaveValue("");
    await user.type(field("Login email"), "login@example.com");
    await user.click(screen.getByRole("button", { name: "Enable parent app access" }));
    expect(callableCalls).toEqual([["setParentAppAccess", { studentId: aarav.id, enabled: true, email: "login@example.com" }]]);
    const result = dialog("Parent password");
    expect(within(result).getByText("024681")).toBeInTheDocument();
    await user.click(within(result).getByRole("button", { name: "Done" }));
    expect(screen.queryByText("024681")).not.toBeInTheDocument();
  });

  it("shows the saved username and prefills it when staff retry pending access", async () => {
    seed({ students: [{ ...aarav, pendingParentLoginEmail: "pending@example.com" }] });
    const { user } = openProfile();
    expect(screen.getByText("Parent username").nextElementSibling).toHaveTextContent("pending@example.com");
    expect(screen.getByText("Setup pending")).toBeInTheDocument();
    const access = screen.getByRole("switch", { name: "Enable parent app access" });
    expect(access).not.toBeChecked();
    await user.click(access);
    expect(field("Login email")).toHaveValue("pending@example.com");
    await user.click(screen.getByRole("button", { name: "Enable parent app access" }));
    expect(callableCalls).toEqual([["setParentAppAccess", { studentId: aarav.id, enabled: true, email: "pending@example.com" }]]);
  });

  it("confirms password replacement for an account shared by siblings", async () => {
    const link = { guardianEmail: "rahul@mail.com", emailGuardianUid: "uid_p1", guardianUids: ["uid_p1"] };
    seed({ students: [{ ...aarav, ...link }, { ...ananya, ...link }],
      users: [{ id: "uid_p1", schoolId: "sch_test", role: "parent", email: "rahul@mail.com", name: "Mr. Rahul Sharma", parentCredentialVersion: "managed" }] });
    const { user } = openProfile();
    expect(screen.getByText("Also linked to Ananya Reddy")).toBeInTheDocument();
    expect(screen.getByText("Parent username").nextElementSibling).toHaveTextContent("rahul@mail.com");
    await user.click(screen.getByRole("button", { name: "Replace parent password" }));
    const confirmation = dialog("Replace parent password?");
    expect(within(confirmation).getByText(/every student linked/)).toBeInTheDocument();
    expect(callableCalls).toHaveLength(0);
    await user.click(within(confirmation).getByRole("button", { name: "Replace password" }));
    expect(await screen.findByText("024681")).toBeInTheDocument();
    expect(callableCalls).toEqual([["setParentAppAccess", { studentId: "stu_101", enabled: true, email: "rahul@mail.com", regenerate: true }]]);
  });

  it("asks the server to unlink only the selected parent", async () => {
    seed({ students: [{ ...aarav, guardianEmail: "rahul@mail.com", emailGuardianUid: "uid_p1", guardianUids: ["uid_p1", "uid_p2"] }], users: [{ id: "uid_p1", schoolId: "sch_test", role: "parent", email: "rahul@mail.com" }] });
    const { user } = openProfile();
    await user.click(screen.getAllByRole("button", { name: "Unlink parent login" })[0]!);
    await user.click(within(dialog("Unlink parent login?")).getByRole("button", { name: "Unlink" }));
    expect(await screen.findByText("Parent login unlinked")).toBeInTheDocument();
    expect(callableCalls).toEqual([["setParentAppAccess", { studentId: "stu_101", enabled: false, unlinkUid: "uid_p1" }]]);
    expect(writes).toHaveLength(0);
    expect(getRow("users", "uid_p1")).toBeDefined();
  });

  it("shows consent given / withdrawn / pending per linked login", async () => {
    seed({ students: [{ ...aarav, guardianUids: ["uid_p1", "uid_p2", "uid_p3"] }],
      consents: [{ id: "uid_p1", uid: "uid_p1", version: 2, acceptedAt: "2026-10-01T10:00:00Z", items: { photos: true, notifications: false } }, { id: "uid_p2", uid: "uid_p2", withdrawn: true }] });
    openProfile();
    expect(screen.getAllByText("Given")).toHaveLength(1);
    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
    expect(screen.getAllByText("Pending")).toHaveLength(1);
  });
});

it("totals the missing documents of siblings in the guardian list", () => {
  const sharedContact = { guardian: "Shared parent", email: "shared@example.test" };
  seed({
    students: [{ ...aarav, ...sharedContact }, { ...ananya, ...sharedContact }],
    adm_documents: [
      { id: aarav.id, expected: ["photo"], uploads: {} },
      { id: ananya.id, expected: ["birth", "parentId", "photo"], uploads: {
        birth: { status: "pending" }, parentId: { status: "rejected" },
      } },
    ],
  });
  setUrl("/students?tab=guardians");
  renderUI(<StudentsView />);
  const row = screen.getByRole("row", { name: /Shared parent/ });
  expect(within(row).getByText("3 missing")).toBeInTheDocument();
  expect(within(row).getByRole("link", { name: aarav.name })).toHaveAttribute("href", "/students/stu_101");
  expect(within(row).getByRole("link", { name: ananya.name })).toHaveAttribute("href", "/students/stu_102");
});

it("lists only the designated guardian when another parent has app access", () => {
  seed({
    students: [{ ...aarav, guardian: "Designated guardian", guardianUids: ["uid_parent"] }],
    users: [{ id: "uid_parent", schoolId: "sch_test", role: "parent", name: "Other parent", email: "other@example.test" }],
  });
  setUrl("/students?tab=guardians");
  renderUI(<StudentsView />);
  expect(screen.getByRole("row", { name: /Designated guardian/ })).toBeInTheDocument();
  expect(screen.queryByRole("row", { name: /Other parent/ })).toBeNull();
});
