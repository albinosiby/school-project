import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicFormPortal } from "./PublicFormPortal";
import { Reenrolment } from "./Reenrol";
import { dialog, field, fieldError, getRow, renderUI, rowsOf, screen, seed, within, writes, writesTo } from "@/test/render";
import type { FormSection } from "./types";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

const sections: FormSection[] = [{ id: "s", title: "Candidate", description: "", mandatory: true, fields: [
  { id: "f1", key: "name", label: "Student Full Name", type: "text", required: true, core: true },
  { id: "f2", key: "dob", label: "Date of Birth (DOB)", type: "date", required: true, core: true },
  { id: "f3", key: "grade", label: "Applying For Grade", type: "select", required: true, core: true, options: ["Grade 1", "Grade 2"] },
  { id: "f4", key: "guardian", label: "Guardian Name", type: "text", required: true, core: true },
  { id: "f5", key: "phone", label: "WhatsApp Number", type: "tel", required: true, core: true },
  { id: "f6", key: "aadhaar", label: "Aadhaar", type: "text", required: false },
] }];
const form = { id: "form", name: "Sunrise Admission Form", version: 3, status: "published", publishedAt: "", publishedBy: "", sections, published: sections, history: [] };
const config = (p: Record<string, unknown> = {}) => ({ id: "config", appFee: 2500, tokenAmount: 50000, offerValidityDays: 7, submissionCap: 500, safeguards: { razorpay: false, otp: false, dedupe: true, receipts: true }, marketingSpend: {}, stats: { scansToday: 0, visitors: 0, begun: 0, hourly: Array(24).fill(0) }, ...p });
const webEnq = { id: "adm_enq_001", ref: "ENQ-2026-0001", name: "Riya Sen", grade: "1", dob: "2019-05-01", guardian: "Mr. Sen", phone: "+91 98100 00001", email: "", source: "Website Form", stage: "new", createdAt: "2026-11-03", applicationId: "", answers: { aadhaar: "123412341234" } };

async function openForm(extra: Record<string, Record<string, unknown>[]> = {}) {
  seed({ adm_form: [form], adm_config: [config()], school: [{ id: "school", name: "Sunrise Academy", short: "Sunrise", city: "Pune", academicYear: "2026-27" }], ...extra });
  const r = renderUI(<PublicFormPortal />);
  await r.user.click(screen.getByRole("button", { name: /Open live application form/ }));
  return { ...r, d: dialog("Sunrise Admission Form") };
}
async function fill(user: ReturnType<typeof renderUI>["user"], d: HTMLElement, v: { name: string; dob: string; phone: string; aadhaar?: string }) {
  await user.type(field("Student Full Name", d), v.name);
  await user.type(field("Date of Birth (DOB)", d), v.dob);
  await user.selectOptions(field("Applying For Grade", d), "Grade 2");
  await user.type(field("Guardian Name", d), "Mrs. Rao");
  await user.type(field("WhatsApp Number", d), v.phone);
  if (v.aadhaar) await user.type(field("Aadhaar", d), v.aadhaar);
}

describe("Public admission form", () => {
  it("shows the school's own name, not the demo school", () => {
    seed({ adm_form: [form], adm_config: [config()], school: [{ id: "school", name: "Sunrise Academy", city: "Pune", academicYear: "2026-27" }] });
    renderUI(<PublicFormPortal />);
    expect(screen.getByText("Sunrise Academy · Pune")).toBeInTheDocument();
    expect(screen.queryByText(/Greenfield/)).not.toBeInTheDocument();
  });
  it("requires the published form's required fields", async () => {
    const { user, d } = await openForm();
    await user.click(within(d).getByRole("button", { name: "Submit enquiry" }));
    expect(fieldError("Student Full Name", d)).toBe("Student Full Name is required");
    expect(fieldError("Date of Birth (DOB)", d)).toBe("Date of Birth (DOB) is required");
    expect(fieldError("Applying For Grade", d)).toBe("Applying For Grade is required");
    expect(fieldError("WhatsApp Number", d)).toBe("WhatsApp Number is required");
    expect(writes).toHaveLength(0);
  });
  it("creates a Website Form enquiry with the grade id, extra answers and a receipt", async () => {
    const { user, d } = await openForm();
    await fill(user, d, { name: " Tara Rao ", dob: "2019-02-01", phone: "9810000777", aadhaar: "1111 2222 3333" });
    await user.click(within(d).getByRole("button", { name: "Submit enquiry" }));
    const e = rowsOf<Record<string, unknown>>("adm_enquiries")[0]!;
    expect(e).toMatchObject({ ref: "ENQ-2026-0001", name: "Tara Rao", grade: "2", dob: "2019-02-01", guardian: "Mrs. Rao", phone: "9810000777", source: "Website Form", stage: "new", createdAt: "2026-11-03", answers: { aadhaar: "1111 2222 3333" } });
    expect(writesTo("adm_messages")[0]!.data).toMatchObject({ kind: "Acknowledgement receipt", to: "9810000777" });
    // the portal no longer bumps a stored "scans today" counter; it counts real submissions
    expect(writesTo("adm_config")).toHaveLength(0);
    expect(await screen.findByText("ENQ-2026-0001")).toBeInTheDocument();
  });
  it("blocks a duplicate child (same DOB + Aadhaar)", async () => {
    const { user, d } = await openForm({ adm_enquiries: [webEnq] });
    await fill(user, d, { name: "Someone", dob: "2019-05-01", phone: "9810000999", aadhaar: "1234 1234 1234" });
    await user.click(within(d).getByRole("button", { name: "Submit enquiry" }));
    expect(await within(d).findByRole("alert")).toHaveTextContent("An enquiry for this child already exists (ENQ-2026-0001).");
    expect(writesTo("adm_enquiries")).toHaveLength(0);
  });
  it("closes at the submission cap", async () => {
    seed({ adm_config: [config({ submissionCap: 1 })] });
    const { user, d } = await openForm({ adm_enquiries: [webEnq], adm_config: [config({ submissionCap: 1 })] });
    await fill(user, d, { name: "New Kid", dob: "2019-03-01", phone: "9810000888" });
    await user.click(within(d).getByRole("button", { name: "Submit enquiry" }));
    expect(await within(d).findByRole("alert")).toHaveTextContent("Online submissions are closed for now (cap reached). Please contact the admissions office.");
    expect(writesTo("adm_enquiries")).toHaveLength(0);
  });
});

describe("Re-enrolment (derived from the students roster)", () => {
  const students = [
    { id: "stu_001", name: "Aarav Nair", grn: "GIS-8801", grade: "9", section: "A", guardian: "Mr. Nair", phone: "9810011223", status: "Active", bus: "Bus 14" },
    { id: "stu_002", name: "Diya Menon", grn: "GIS-8802", grade: "3", section: "B", guardian: "Mrs. Menon", phone: "9810011224", status: "Active" },
    { id: "stu_003", name: "Gone Kid", grn: "GIS-8803", grade: "3", section: "B", status: "Inactive" },
  ];
  const campaign = { id: "campaign", name: "AY 2027-28 Re-enrolment Drive", opensAt: "2026-11-01", closesAt: "2026-12-31", reenrolFee: 15000, noticesSent: 0, lastReminderAt: "" };
  it("lists every active student as pending and confirms into adm_reenrolment/{studentId}", async () => {
    seed({ students, adm_campaign: [campaign] });
    const { user } = renderUI(<Reenrolment />);
    expect(screen.getByText("Aarav Nair")).toBeInTheDocument();
    expect(screen.queryByText("Gone Kid")).not.toBeInTheDocument();
    await user.click(screen.getByText("Diya Menon"));
    const d = dialog("Diya Menon · GIS-8802");
    await user.click(within(d).getByRole("button", { name: "Confirm re-enrolment" }));
    expect(getRow("adm_reenrolment", "stu_002")).toMatchObject({ studentId: "stu_002", status: "confirmed", confirmedAt: "2026-11-03", fee: "due", reason: "" });
    expect(await screen.findByText("Diya Menon confirmed (AY 2027-28 Re-enrolment Drive)")).toBeInTheDocument();
  });
  it("exit needs a reason; transport choices come from the school's buses", async () => {
    seed({ students, adm_campaign: [campaign], tr_buses: [{ id: "bus_01", number: "14", status: "Active" }, { id: "bus_02", number: "7", status: "Active" }] });
    const { user } = renderUI(<Reenrolment />);
    await user.click(screen.getByText("Aarav Nair"));
    const d = dialog("Aarav Nair · GIS-8801");
    expect([...(field("Transport", d) as unknown as HTMLSelectElement).options].map((o) => o.text)).toEqual(["Bus 14", "Bus 7", "Self / Walker"]);
    const exit = within(d).getByRole("button", { name: "Mark exit" });
    expect(exit).toBeDisabled();
    await user.type(field("Record exit / TC request — reason", d), "  Relocating ");
    await user.click(exit);
    expect(getRow("adm_reenrolment", "stu_001")).toMatchObject({ status: "exit", reason: "Relocating", fee: "caution" });
  });
  it("campaign editor validates name, dates and fee", async () => {
    seed({ students, adm_campaign: [campaign] });
    const { user } = renderUI(<Reenrolment />);
    await user.click(screen.getByRole("button", { name: /Edit campaign/ }));
    const d = dialog("Edit campaign");
    await user.clear(field("Name", d));
    await user.clear(field("Re-enrolment fee (₹)", d));
    await user.clear(field("Closes", d));
    await user.type(field("Closes", d), "2026-10-01");
    await user.click(within(d).getByRole("button", { name: "Save" }));
    expect(fieldError("Name", d)).toBe("Required");
    expect(fieldError("Closes", d)).toBe("Must be after opening");
    expect(fieldError("Re-enrolment fee (₹)", d)).toBe("Enter a whole amount of 0 or more");
    expect(writes).toHaveLength(0);
    await user.type(field("Name", d), "Drive 2027");
    await user.type(field("Re-enrolment fee (₹)", d), "12000");
    await user.clear(field("Closes", d));
    await user.type(field("Closes", d), "2027-01-31");
    await user.click(within(d).getByRole("button", { name: "Save" }));
    expect(getRow("adm_campaign", "campaign")).toMatchObject({ name: "Drive 2027", closesAt: "2027-01-31", reenrolFee: 12000 });
  });
});
