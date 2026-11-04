import { describe, expect, it, vi } from "vitest";
import { sendPasswordResetEmail } from "firebase/auth";
import { StudentsView } from "./StudentsView";
import { ADMIN_UID, authAccounts, dialog, field, fieldError, getRow, renderUI, screen, seed, sentInvites, within, writes, writesTo } from "@/test/render";

type Row = Record<string, unknown>;
const aarav = { id: "stu_101", name: "Aarav Sharma", grn: "GIS-9200", grade: "10", section: "B", classId: "cls_10B", roll: 1, guardian: "Mr. Rahul Sharma", relation: "Father",
  phone: "+91 98100 00001", status: "Active", attendance: 95, guardianUids: [], busId: "bus_01", bus: "Bus 14", busStopId: "stp_01", busStop: "Sector 9" };
const ananya = { id: "stu_102", name: "Ananya Reddy", grn: "GIS-9201", grade: "10", section: "B", classId: "cls_10B", roll: 2, guardian: "Mrs. Reddy", phone: "+91 98100 00002", status: "Active", attendance: 90 };

async function openAdd() {
  const r = renderUI(<StudentsView />);
  await r.user.click(screen.getByRole("button", { name: /Add Student/ }));
  return r;
}
const save = () => within(dialog("Add Student")).getByRole("button", { name: "Add Student" });

describe("Add / edit student validation", () => {
  it("shows the required-field errors and writes nothing", async () => {
    const { user } = await openAdd();
    await user.click(save());
    expect(fieldError("Student name")).toBe("Name is required");
    expect(fieldError("Guardian name")).toBe("Guardian name is required");
    expect(fieldError("Phone")).toBe("Enter a valid phone number");
    expect(writes).toHaveLength(0);
  });

  it("rejects a bad phone, emails, attendance, future DOB, duplicate GRN and taken roll", async () => {
    seed({ students: [aarav] });
    const { user } = await openAdd();
    await user.type(field("Student name"), "Kabir Das");
    await user.type(field("Guardian name"), "Mr. Das");
    await user.type(field("Phone"), "+1234567");
    await user.type(field("Email"), "kabir@mail");
    await user.type(field("Parent app login email"), "das@");
    await user.clear(field("Attendance %")); await user.type(field("Attendance %"), "120");
    await user.type(field("Date of birth"), "2030-01-01");
    await user.type(field("GRN"), "gis-9200");
    await user.selectOptions(field("Grade"), "10"); await user.selectOptions(field("Section"), "B");
    await user.type(field("Roll no."), "1");
    await user.click(save());
    expect(fieldError("Phone")).toBe("Enter a valid phone number");
    expect(fieldError("Email")).toBe("Enter a valid email");
    expect(fieldError("Parent app login email")).toBe("Enter a valid email");
    expect(fieldError("Attendance %")).toBe("0–100");
    expect(fieldError("Date of birth")).toBe("Date of birth cannot be in the future");
    expect(fieldError("GRN")).toBe("GRN already exists");
    expect(fieldError("Roll no.")).toBe("Roll 1 is already used in 10-B");
    expect(writes).toHaveLength(0);

    await user.clear(field("Roll no.")); await user.type(field("Roll no."), "1.5");
    await user.click(save());
    expect(fieldError("Roll no.")).toBe("Enter a whole number from 1 to 999");
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

  it("creates stu_{next} with classId, next free roll, auto GRN and empty guardianUids", async () => {
    seed({ students: [aarav, ananya, { ...ananya, id: "stu_150", grn: "GIS-1", roll: 9, deleted: true }] });
    const { user } = await openAdd();
    await user.type(field("Student name"), "  Kabir Das ");
    await user.type(field("Guardian name"), "Mr. Das");
    await user.type(field("Phone"), "+91 98100 00003");
    await user.type(field("Parent app login email"), " Das@Mail.com");
    await user.selectOptions(field("Grade"), "10"); await user.selectOptions(field("Section"), "B");
    await user.click(save());
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: "set", coll: "students", id: "stu_151" });
    expect(getRow<Row>("students", "stu_151")).toMatchObject({ name: "Kabir Das", grade: "10", section: "B", classId: "cls_10B", roll: 3, guardian: "Mr. Das",
      phone: "+91 98100 00003", guardianEmail: "das@mail.com", guardianUids: [], status: "Active", attendance: 100, grn: "GIS-8804", updatedBy: ADMIN_UID });
    expect(await screen.findByText("Student added")).toBeInTheDocument();
  });

  it("edits only the form's fields: bus assignment and guardianUids are not written back", async () => {
    seed({ students: [{ ...aarav, guardianUids: ["uid_p1"] }, ananya] });
    const { user } = renderUI(<StudentsView />);
    await user.click(screen.getByText("Aarav Sharma"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(field("Roll no.")).toHaveValue("1");
    await user.clear(field("Guardian name")); await user.type(field("Guardian name"), "Mr. R. Sharma");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    const w = writesTo("students");
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ op: "update", id: "stu_101" });
    expect(w[0]!.data).toMatchObject({ guardian: "Mr. R. Sharma", classId: "cls_10B", roll: 1, grn: "GIS-9200" });
    for (const k of ["guardianUids", "busId", "bus", "busStopId", "busStop", "id"]) expect(w[0]!.data).not.toHaveProperty(k);
    expect(getRow<Row>("students", "stu_101")).toMatchObject({ guardianUids: ["uid_p1"], busId: "bus_01" });
  });

  it("moving a student to another class gives the next free roll there", async () => {
    seed({ students: [aarav, ananya, { id: "stu_201", name: "Meera", grn: "GIS-8100", grade: "8", section: "A", classId: "cls_8A", roll: 4, guardian: "G", phone: "+91 98100 00009", status: "Active", attendance: 90 }] });
    const { user } = renderUI(<StudentsView />);
    await user.click(screen.getByText("Ananya Reddy"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(field("Grade"), "8"); await user.selectOptions(field("Section"), "A");
    expect(field("Roll no.")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(getRow<Row>("students", "stu_102")).toMatchObject({ grade: "8", section: "A", classId: "cls_8A", roll: 5 });
  });

  it("hides soft-deleted students", () => {
    seed({ students: [aarav, { ...ananya, deleted: true }] });
    renderUI(<StudentsView />);
    expect(screen.getByText("Aarav Sharma")).toBeInTheDocument();
    expect(screen.queryByText("Ananya Reddy")).toBeNull();
  });
});

describe("Parent login (contract 13.1)", () => {
  async function openProfile(stu: Row = aarav) {
    const r = renderUI(<StudentsView />);
    await r.user.click(screen.getByText(String(stu.name)));
    return r;
  }
  const emailBox = () => screen.getByLabelText("Guardian email");
  const createBtn = () => screen.getByRole("button", { name: /Create & invite/ });

  it("rejects an invalid email", async () => {
    seed({ students: [aarav] });
    const { user } = await openProfile();
    await user.type(emailBox(), "rahul@");
    await user.click(createBtn());
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address");
    expect(writes).toHaveLength(0);
  });

  it("refuses an email used by a staff or admin login of the school", async () => {
    seed({ students: [aarav], users: [{ id: "uid_anita", schoolId: "sch_test", role: "teacher", email: "anita@greenfield.edu" }] });
    authAccounts.set("anita@greenfield.edu", "uid_anita");
    const { user } = await openProfile();
    await user.type(emailBox(), "Anita@Greenfield.edu");
    await user.click(createBtn());
    expect(await screen.findByRole("alert")).toHaveTextContent("This email is already used by a staff or admin login of this school. Use a different email.");
    expect(writes).toHaveLength(0);
    expect(sentInvites).toEqual([]);
  });

  it("refuses an email whose login belongs to another school", async () => {
    seed({ students: [aarav] });
    authAccounts.set("other@school.org", "uid_other");
    const { user } = await openProfile();
    await user.type(emailBox(), "other@school.org");
    await user.click(createBtn());
    expect(await screen.findByRole("alert")).toHaveTextContent(/already has a login that is not a parent login of this school/);
    expect(writes).toHaveLength(0);
  });

  it("links an existing parent login (a sibling's) without creating an account", async () => {
    seed({ students: [aarav, { ...ananya, guardianUids: ["uid_p1"] }], users: [{ id: "uid_p1", schoolId: "sch_test", role: "parent", email: "rahul@mail.com", name: "Mr. Rahul Sharma" }] });
    authAccounts.set("rahul@mail.com", "uid_p1");
    const { user } = await openProfile();
    await user.type(emailBox(), " Rahul@Mail.com ");
    await user.click(createBtn());
    expect(await screen.findByText("Linked the existing parent login rahul@mail.com")).toBeInTheDocument();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: "update", coll: "students", id: "stu_101" });
    expect(getRow<Row>("students", "stu_101")).toMatchObject({ guardianUids: ["uid_p1"], guardianEmail: "rahul@mail.com" });
    expect(getRow("users", "uid_new_1")).toBeUndefined();
    expect(sentInvites).toEqual([]);
    expect(await screen.findByText("Also linked to Ananya Reddy")).toBeInTheDocument();
  });

  it("creates a new parent login, links it and sends the invite", async () => {
    seed({ students: [aarav] });
    const { user } = await openProfile();
    await user.type(emailBox(), "rahul.sharma@mail.com");
    await user.click(createBtn());
    expect(await screen.findByText("Parent login created. Password email sent to rahul.sharma@mail.com")).toBeInTheDocument();
    expect(getRow("users", "uid_new_1")).toMatchObject({ schoolId: "sch_test", role: "parent", email: "rahul.sharma@mail.com", name: "Mr. Rahul Sharma", studentIds: [], classIds: [], grns: [] });
    expect(getRow<Row>("students", "stu_101")).toMatchObject({ guardianUids: ["uid_new_1"], guardianEmail: "rahul.sharma@mail.com" });
    expect(sentInvites).toEqual(["rahul.sharma@mail.com"]);
  });

  it("reports a failed invite but keeps the new login", async () => {
    seed({ students: [aarav] });
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error("network"));
    const { user } = await openProfile();
    await user.type(emailBox(), "rahul.sharma@mail.com");
    await user.click(createBtn());
    expect(await screen.findByText("Parent login created, but the password email could not be sent. Use Resend invite.")).toBeInTheDocument();
    expect(getRow<Row>("students", "stu_101")).toMatchObject({ guardianUids: ["uid_new_1"] });
  });

  it("deletes the new Auth account when the Firestore writes fail", async () => {
    seed({ students: [aarav] });
    const { user } = await openProfile();
    const { failNextWrite } = await import("@/test/render");
    failNextWrite();
    await user.type(emailBox(), "rahul.sharma@mail.com");
    await user.click(createBtn());
    expect(await screen.findByRole("alert")).toHaveTextContent("permission-denied");
    expect(authAccounts.has("rahul.sharma@mail.com")).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it("does not link the same login twice", async () => {
    seed({ students: [{ ...aarav, guardianUids: ["uid_p1"] }], users: [{ id: "uid_p1", schoolId: "sch_test", role: "parent", email: "rahul@mail.com" }] });
    const { user } = await openProfile();
    await user.clear(emailBox()); await user.type(emailBox(), "rahul@mail.com");
    await user.click(createBtn());
    expect(screen.getByRole("alert")).toHaveTextContent("This parent login is already linked");
    expect(writes).toHaveLength(0);
  });

  it("unlinks a parent login (arrayRemove) and keeps the login", async () => {
    seed({ students: [{ ...aarav, guardianUids: ["uid_p1", "uid_p2"] }], users: [{ id: "uid_p1", schoolId: "sch_test", role: "parent", email: "rahul@mail.com" }] });
    const { user } = await openProfile();
    await user.click(screen.getAllByRole("button", { name: "Unlink parent login" })[0]!);
    await user.click(within(dialog("Unlink parent login?")).getByRole("button", { name: "Unlink" }));
    expect(await screen.findByText("Parent login unlinked")).toBeInTheDocument();
    expect(getRow<Row>("students", "stu_101")?.guardianUids).toEqual(["uid_p2"]);
    expect(writes).toHaveLength(1);
    expect(getRow("users", "uid_p1")).toBeDefined();
  });

  it("shows consent given / withdrawn / pending per linked login", async () => {
    seed({ students: [{ ...aarav, guardianUids: ["uid_p1", "uid_p2", "uid_p3"] }],
      consents: [{ id: "uid_p1", uid: "uid_p1", version: 2, acceptedAt: "2026-10-01T10:00:00Z", items: { photos: true, notifications: false } }, { id: "uid_p2", uid: "uid_p2", withdrawn: true }] });
    await openProfile();
    expect(screen.getAllByText("Given")).toHaveLength(1);
    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
    // uid_p3 has no consent; the directory column counts the student as given (uid_p1)
    expect(screen.getAllByText("Pending")).toHaveLength(1);
    expect(screen.getAllByText("Consent given").length).toBeGreaterThan(0);
  });
});
