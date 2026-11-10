import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Applications } from "./Applications";
import { AdmissionsShell } from "./AdmissionsShell";
import { saveAdmission } from "./admissionSave";
import type { Application } from "./types";
import * as parentAccount from "@/lib/parentAccount";
import { OTHER_LOCATION } from "@/features/onboarding/locations";
import { Overview } from "./Overview";
import { callableCalls, dialog, field, getRow, renderUI, router, rowsOf, screen, seed, within, writes, writesTo } from "@/test/render";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const config = { id: "config", appFee: 2500, tokenAmount: 30000, offerValidityDays: 7, submissionCap: 500, safeguards: { razorpay: false, otp: false, dedupe: true, receipts: false }, marketingSpend: {}, stats: { scansToday: 0, visitors: 0, begun: 0, hourly: [] } };
const enquiry = { gender: "Female", id: "adm_enq_001", ref: "ENQ-2026-0001", name: "Samaira Kapoor", grade: "3", dob: "2018-06-12", prevSchool: "", guardian: "Dr. Kapoor", relation: "Father", phone: "9845231209", email: "k@x.in", area: "", source: "Walk-In", stage: "new", assignee: "", followUp: "", note: "", sibling: true, createdAt: "2026-10-30", applicationId: "", lostReason: "" };
const pendingDocs = { birth: "pending", idProof: "pending", immunisation: "pending", tc: "pending" };
const application = { id: "adm_app_001", ref: "APP-2026-0001", enquiryId: "adm_enq_001", name: "Samaira Kapoor", gender: "Female", dob: "2018-06-12", guardian: "Dr. Kapoor", phone: "9845231209", email: "k@x.in", grade: "3", tag: "general", status: "submitted", submittedAt: "2026-10-31", feePaid: false, feeMode: "", docs: pendingDocs, testSlotId: "", interviewSlotId: "", writtenScore: null, panelStatus: null, panelist: "", waitlistNo: 0, offerId: "", notes: "" };

async function fillRequiredAdmission(user: ReturnType<typeof renderUI>["user"], form: HTMLElement) {
  await user.selectOptions(field("Nationality", form), "IN");
  await user.type(field("Address line 1", form), "1 Main Road");
  await user.selectOptions(field("State", form), "IN.13");
  await user.selectOptions(field("District", form), "IN.13.595");
  await user.selectOptions(field("City", form), OTHER_LOCATION);
  await user.type(field("City name", form), "Kochi");
  await user.type(field("PIN code", form), "682001");
  await user.type(field("Academic year", form), "2026-27");
}

describe("Enquiry pipeline (Overview)", () => {
  it("admits directly from an enquiry without a division, roll number or uploaded documents", async () => {
    seed({ adm_config: [config], adm_enquiries: [enquiry] });
    const { user } = renderUI(<Overview />);
    await user.click(screen.getByRole("button", { name: enquiry.name }));
    const detail = dialog(`${enquiry.name} · ${enquiry.ref}`);
    expect(within(detail).getByText("Female")).toBeInTheDocument();
    await user.click(within(detail).getByRole("button", { name: "Make Admission" }));
    const form = dialog("New Admission");
    expect(field("Admission number", form)).toHaveValue("FC20260001");
    expect(field("Admission number", form)).toHaveAttribute("readonly");
    expect(field("Student first name", form)).toHaveValue("Samaira");
    expect(field("Last name", form)).toHaveValue("Kapoor");
    expect(field("Date of birth", form)).toHaveValue(enquiry.dob);
    const fatherGuardian = within(form).getByRole("switch", { name: "Set father as guardian" });
    await user.click(fatherGuardian);
    expect(within(form).queryByRole("group", { name: /^(Guardian|Other contact) details$/ })).toBeNull();
    const access = within(form).getByRole("switch", { name: "Enable parent app access" });
    expect(access).not.toBeChecked();
    const father = within(form).getByRole("group", { name: "Father details" });
    await user.type(field("Full name", father), "Raj Kapoor");
    await user.type(field("Mobile number", father), enquiry.phone);
    await user.type(field("Email address", father), "raj@example.com");
    await user.click(access);
    expect(field("Login email", form)).toHaveValue("");
    await user.type(field("Login email", form), "parent@example.com");
    expect(field("Section", form)).toHaveValue("");
    await fillRequiredAdmission(user, form);
    vi.spyOn(parentAccount, "setParentAppAccess").mockRejectedValueOnce(new Error("internal [0]"));
    await user.click(within(form).getByRole("button", { name: "Admit Student and enable parent access" }));
    const passwordDialog = dialog("Parent app access");
    expect(within(passwordDialog).getByRole("alert")).toHaveTextContent("The student was saved, but the parent password could not be generated.");
    expect(router.push).not.toHaveBeenCalled();
    await user.click(within(passwordDialog).getByRole("button", { name: "Retry password setup" }));
    expect(writesTo("students")).toHaveLength(1);
    expect(getRow("students", "stu_001")).toMatchObject({
      name: enquiry.name, classId: "", section: "", roll: 0, admissionNumber: "FC20260001", email: "raj@example.com", guardianEmail: "", pendingParentLoginEmail: "parent@example.com",
    });
    expect(getRow("adm_enquiries", enquiry.id)).toMatchObject({ stage: "enrolled", studentId: "stu_001" });
    expect(screen.queryByRole("button", { name: enquiry.name })).not.toBeInTheDocument();
    expect(getRow("adm_documents", "stu_001")).toMatchObject({ uploads: {} });
    expect(writesTo("adm_applications")).toHaveLength(0);
    expect(callableCalls).toEqual([["setParentAppAccess", { studentId: "stu_001", enabled: true, email: "parent@example.com" }]]);
    expect(within(passwordDialog).getByText("024681")).toBeInTheDocument();
    await user.click(within(passwordDialog).getByRole("button", { name: "Open Student Details" }));
    expect(router.push).toHaveBeenCalledWith("/students/stu_001");
  });

  it("deletes an enquiry only after confirmation", async () => {
    seed({ adm_enquiries: [enquiry] });
    const { user } = renderUI(<Overview />);
    await user.click(screen.getByRole("button", { name: enquiry.name }));
    const detail = () => dialog(`${enquiry.name} · ${enquiry.ref}`);
    await user.click(within(detail()).getByRole("button", { name: "Delete enquiry" }));
    await user.click(within(dialog("Delete enquiry?")).getByRole("button", { name: "Cancel" }));
    expect(getRow("adm_enquiries", enquiry.id)).toBeDefined();
    await user.click(within(detail()).getByRole("button", { name: "Delete enquiry" }));
    await user.click(within(dialog("Delete enquiry?")).getByRole("button", { name: "Delete enquiry" }));
    expect(await screen.findByText("Enquiry deleted")).toBeInTheDocument();
    expect(getRow("adm_enquiries", enquiry.id)).toBeUndefined();
    expect(screen.queryByRole("button", { name: enquiry.name })).toBeNull();
  });

  it("hides admitted enquiries and retains the admission records", () => {
    const studentId = "stu_001";
    seed({
      adm_enquiries: [
        { ...enquiry, stage: "app_issued", applicationId: application.id },
        { ...enquiry, id: "adm_enq_002", name: "Admitted directly", stage: "enrolled", studentId },
        { ...enquiry, id: "adm_enq_003", name: "Still enquiring" },
      ],
      adm_applications: [{ ...application, status: "enrolled", studentId }],
      students: [{ id: studentId, name: enquiry.name }],
    });
    renderUI(<Overview />);
    expect(screen.queryByRole("button", { name: enquiry.name })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Admitted directly" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Admitted" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Still enquiring" })).toBeInTheDocument();
    expect(getRow("adm_enquiries", enquiry.id)).toMatchObject({ applicationId: application.id });
    expect(getRow("adm_applications", application.id)).toMatchObject({ enquiryId: enquiry.id, status: "enrolled", studentId });
    expect(getRow("students", studentId)).toMatchObject({ name: enquiry.name });
  });

  it("moves an enquiry between open stages", async () => {
    seed({ adm_config: [config], adm_enquiries: [enquiry] });
    const { user } = renderUI(<Overview />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Move Samaira Kapoor" }), "contacted");
    expect(getRow("adm_enquiries", "adm_enq_001")).toMatchObject({ stage: "contacted", lostReason: "" });
    expect(writesTo("adm_applications")).toHaveLength(0);
  });

  it("edit modal saves the follow-up date and closes as lost with the given or default reason", async () => {
    seed({ adm_config: [config], adm_enquiries: [enquiry, { ...enquiry, id: "adm_enq_002", ref: "ENQ-2026-0002", name: "Kabir Rao" }], staff: [{ id: "stf_001", name: "Meera Iyer", status: "Active" }] });
    const { user } = renderUI(<Overview />);
    await user.click(screen.getByRole("button", { name: "Samaira Kapoor" }));
    const d = dialog("Samaira Kapoor · ENQ-2026-0001");
    await user.type(field("Follow-up date", d), "2026-11-08");
    expect(getRow("adm_enquiries", "adm_enq_001")).toMatchObject({ followUp: "2026-11-08" });
    await user.type(field("Close as lost — reason", d), "  Chose another school ");
    await user.click(within(d).getByRole("button", { name: "Mark lost" }));
    expect(getRow("adm_enquiries", "adm_enq_001")).toMatchObject({ stage: "lost", lostReason: "Chose another school" });

    await user.click(screen.getByRole("button", { name: "Kabir Rao" }));
    await user.click(within(dialog("Kabir Rao · ENQ-2026-0002")).getByRole("button", { name: "Mark lost" }));
    expect(getRow("adm_enquiries", "adm_enq_002")).toMatchObject({ stage: "lost", lostReason: "Closed by admissions desk" });
  });
});

describe("Application stage moves", () => {
  async function openDetail(rows: Record<string, unknown>[], extra: Record<string, Record<string, unknown>[]> = {}) {
    seed({ adm_config: [config], adm_enquiries: [enquiry], adm_applications: rows, ...extra });
    const r = renderUI(<Applications />);
    await r.user.click(screen.getByText("APP-2026-0001"));
    return { ...r, d: dialog("Samaira Kapoor · APP-2026-0001") };
  }

  it("refuses Verified while documents are pending and writes nothing", async () => {
    const { user, d } = await openDetail([application]);
    await user.selectOptions(field("Move stage", d), "verified");
    expect(await screen.findByText("Verify every required document first")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("allows staff to waitlist or reject without setting up assessments", async () => {
    const { user, d } = await openDetail([application]);
    await user.selectOptions(field("Move stage", d), "waitlisted");
    expect(getRow("adm_applications", "adm_app_001")).toMatchObject({ status: "waitlisted" });
    expect(within(d).queryByRole("option", { name: "Test Scheduled" })).not.toBeInTheDocument();
    await user.selectOptions(field("Move stage", d), "rejected");
    expect(getRow("adm_applications", "adm_app_001")).toMatchObject({ status: "rejected" });
  });

  it("verifying the documents moves submitted → documents pending → verified", async () => {
    const { user, d } = await openDetail([application]);
    await user.selectOptions(within(d).getByRole("combobox", { name: "Birth Certificate" }), "verified");
    expect(getRow("adm_applications", "adm_app_001")).toMatchObject({ status: "docs_pending" });
    for (const k of ["Aadhaar / Passport ID", "Immunisation Record", "Previous TC / Report"]) await user.selectOptions(within(d).getByRole("combobox", { name: k }), "verified");
    expect(getRow("adm_applications", "adm_app_001")).toMatchObject({ status: "verified", docs: { birth: "verified", idProof: "verified", immunisation: "verified", tc: "verified" } });
  });

  it("generate offer needs a seat matrix and a free seat", async () => {
    const verified = { ...application, status: "verified", docs: { birth: "verified", idProof: "verified", immunisation: "verified", tc: "verified" } };
    const { user, d } = await openDetail([verified]);
    await user.click(within(d).getByRole("button", { name: "Generate offer" }));
    expect(await screen.findByText("No seat matrix configured for this grade")).toBeInTheDocument();
    expect(writesTo("adm_offers")).toHaveLength(0);
  });

  it("generates the offer (OFF-2026-0801, 7-day expiry) and marks the application offered", async () => {
    const verified = { ...application, status: "verified", docs: { birth: "verified", idProof: "verified", immunisation: "verified", tc: "verified" } };
    const { user, d } = await openDetail([verified], { adm_seats: [{ id: "adm_seat_3", grade: "3", group: "primary", capacity: 1, rteSeats: 0, block: "B" }] });
    await user.click(within(d).getByRole("button", { name: "Generate offer" }));
    const o = rowsOf<Record<string, unknown>>("adm_offers")[0]!;
    expect(o).toMatchObject({ ref: "OFF-2026-0801", applicationId: "adm_app_001", grade: "3", status: "pending", issuedAt: "2026-11-03", expiresAt: "2026-11-10", tokenPaid: 0 });
    expect(getRow("adm_applications", "adm_app_001")).toMatchObject({ status: "offered", offerId: o.id });
    expect(getRow("adm_enquiries", "adm_enq_001")).toMatchObject({ stage: "offered" });
    await user.click(within(d).getByRole("button", { name: "Record acceptance" }));
    expect(getRow("adm_offers", String(o.id))).toMatchObject({ status: "accepted", tokenPaid: 0 });
    await user.click(within(d).getByRole("button", { name: "Enrol student" }));
    const form = dialog("Enrol Student");
    expect(field("Email address", within(form).getByRole("group", { name: "Guardian details" }))).toHaveValue(application.email);
    await fillRequiredAdmission(user, form);
    await user.selectOptions(field("Section", form), "B");
    await user.click(within(form).getByRole("button", { name: "Enrol Student" }));
    expect(rowsOf("students")[0]).toMatchObject({ name: "Samaira Kapoor", email: "k@x.in", guardianEmail: "", grade: "3", section: "B" });
    expect(callableCalls).toHaveLength(0);
    expect(getRow("adm_applications", "adm_app_001")).toMatchObject({ status: "enrolled", feePaid: false, studentId: "stu_001" });
    expect(getRow("adm_offers", String(o.id))).toMatchObject({ status: "enrolled", studentId: "stu_001" });
    expect(router.push).toHaveBeenCalledWith("/students/stu_001");
  });

  it("enrols an approved application without generating an offer or copying details by hand", async () => {
    const docs = { birth: "verified", idProof: "verified", immunisation: "verified", tc: "verified" };
    const { user, d } = await openDetail([{ ...application, status: "verified", docs }]);
    await user.selectOptions(field("Move stage", d), "approved");
    await user.click(within(d).getByRole("button", { name: "Enrol student" }));
    const form = dialog("Enrol Student");
    expect(field("Student first name", form)).toHaveValue("Samaira");
    expect(field("Guardian name", form)).toHaveValue(application.guardian);
    expect(field("Relationship with student", form)).toHaveValue(enquiry.relation);
    await fillRequiredAdmission(user, form);
    await user.selectOptions(field("Section", form), "A");
    await user.click(within(form).getByRole("button", { name: "Enrol Student" }));
    expect(getRow("adm_applications", application.id)).toMatchObject({ status: "enrolled", studentId: "stu_001" });
    expect(getRow("adm_enquiries", enquiry.id)).toMatchObject({ stage: "enrolled" });
    expect(writesTo("adm_offers")).toHaveLength(0);
    expect(router.push).toHaveBeenCalledWith("/students/stu_001");
  });
});


it("admits a walk-in from the hub and honours the selected course's reserved seats", async () => {
  const streamId = "course_home_science";
  seed({
    adm_config: [{ id: "numbering", mode: "automatic", template: "W{YEAR}{SEQ:3}", start: 10, next: 25 }],
    classes: [
      { id: "cls_11_course_home_science_A", grade: "11", section: "A", streamId, capacity: 1 },
      { id: "cls_12_course_home_science_A", grade: "12", section: "A", streamId, capacity: 1 },
    ],
    adm_seats: [
      { id: "seat_11", grade: "11-course_home_science", streamId, capacity: 1 },
      { id: "seat_12", grade: "12-course_home_science", streamId, capacity: 1 },
    ],
    adm_offers: [{ id: "off_11", grade: "11-course_home_science", status: "accepted" }],
  });
  const { user } = renderUI(<AdmissionsShell><div /></AdmissionsShell>);
  await user.click(screen.getByRole("button", { name: "New Admission" }));
  const form = dialog("New Admission");
  expect(screen.getByRole("navigation", { name: "Admissions sections" }).querySelectorAll("a")).toHaveLength(2);
  expect(field("Admission number", form)).toHaveValue("W2026025");
  await user.clear(field("Admission date", form));
  await user.type(field("Admission date", form), "2027-01-01");
  expect(field("Admission number", form)).toHaveValue("W2027025");
  await user.type(field("Student first name", form), "Kabir");
  await user.type(field("Last name", form), "Rao");
  await user.type(field("Date of birth", form), "2010-06-12");
  await user.selectOptions(field("Gender", form), "Male");
  await fillRequiredAdmission(user, form);
  await user.type(field("Guardian name", form), "Mrs. Rao");
  await user.type(field("Mobile number", within(form).getByRole("group", { name: "Guardian details" })), "9845231209");
  await user.selectOptions(field("Grade", form), "11");
  await user.selectOptions(field("Stream", form), streamId);
  await user.selectOptions(field("Section", form), "A");
  const submit = within(form).getByRole("button", { name: "Admit Student" });
  await user.click(submit);
  expect(await within(form).findByRole("alert")).toHaveTextContent("occupied or reserved");
  expect(writesTo("students")).toHaveLength(0);
  await user.selectOptions(field("Grade", form), "12");
  await user.selectOptions(field("Stream", form), streamId);
  await user.selectOptions(field("Section", form), "A");
  await user.click(submit);
  expect(getRow("students", "stu_001")).toMatchObject({ name: "Kabir Rao", grade: "12", streamId, section: "A", admissionNumber: "W2027025", guardianEmail: "" });
  expect(writesTo("adm_enquiries")).toHaveLength(0);
  expect(writesTo("adm_applications")).toHaveLength(0);
  expect(writesTo("adm_offers")).toHaveLength(0);
  expect(router.push).toHaveBeenCalledWith("/students/stu_001");
});

it("returns the same student when enrolment is retried with the original application snapshot", async () => {
  const approved: Application = {
    ...application, tag: "general", status: "approved",
    docs: { birth: "verified", idProof: "verified", immunisation: "verified", tc: "verified" },
  };
  seed({ adm_applications: [approved], adm_enquiries: [enquiry] });
  const values = {
    name: application.name, guardian: application.guardian, phone: application.phone,
    email: "", guardianEmail: application.email, relation: "Father", dob: application.dob, address: "",
    grn: "GIS-8801", grade: "3", section: "A", classId: "cls_3A", roll: 1, status: "Active", attendance: 100,
  };
  const data = { application: approved, students: [], applications: [approved], offers: [], classes: [], seats: [], recordAdmission: true };
  const id = await saveAdmission(values, data);
  await expect(saveAdmission(values, data)).resolves.toBe(id);
  expect(writesTo("students")).toHaveLength(1);
  expect(getRow("adm_applications", approved.id)).toMatchObject({ studentId: id, status: "enrolled" });
});

it("rejects a duplicate manual admission number even after the original admission is retried", async () => {
  seed({ adm_config: [{ id: "numbering", mode: "manual", template: "ADM-{SEQ:4}", start: 1 }] });
  const values = {
    name: application.name, guardian: application.guardian, phone: application.phone,
    email: "", guardianEmail: "", relation: "Father", dob: application.dob, address: "",
    grn: "GIS-8801", grade: "3", section: "", classId: "", roll: 0, status: "Active", attendance: 100,
    requestedAdmissionNumber: "Adm-100",
  };
  const data = { students: [], applications: [], offers: [], classes: [], seats: [], recordAdmission: true };
  const id = await saveAdmission(values, { ...data, requestId: "original-request" });
  await expect(saveAdmission(values, { ...data, requestId: "original-request" })).resolves.toBe(id);
  await expect(saveAdmission({ ...values, requestedAdmissionNumber: "ADM-100" }, {
    ...data, students: [{ id, name: values.name, grade: "3", section: "" }], requestId: "second-request",
  })).rejects.toThrow("This admission number is already in use.");
  expect(rowsOf("students")).toHaveLength(1);
});
