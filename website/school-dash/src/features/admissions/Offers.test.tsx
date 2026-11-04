import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Offers } from "./Offers";
import { Seats } from "./Seats";
import { dialog, field, getRow, renderUI, rowsOf, screen, seed, within, writes, writesTo } from "@/test/render";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

const config = { id: "config", appFee: 2500, tokenAmount: 30000, offerValidityDays: 10, submissionCap: 500, safeguards: { razorpay: false, otp: false, dedupe: true, receipts: false }, marketingSpend: {}, stats: { scansToday: 0, visitors: 0, begun: 0, hourly: [] } };
const docs = { birth: "verified", idProof: "verified", immunisation: "verified", tc: "verified" };
const app = (p: Record<string, unknown> = {}) => ({ id: "adm_app_001", ref: "APP-2026-0001", enquiryId: "adm_enq_001", name: "Samaira Kapoor", gender: "Female", dob: "2018-06-12", guardian: "Dr. Kapoor", phone: "9845231209", email: "k@x.in", grade: "3", tag: "general", status: "offered", submittedAt: "2026-10-31", feePaid: true, feeMode: "UPI", docs, testSlotId: "", interviewSlotId: "", writtenScore: 80, panelStatus: "cleared", panelist: "", waitlistNo: 0, offerId: "adm_off_001", notes: "", ...p });
const offer = (p: Record<string, unknown> = {}) => ({ id: "adm_off_001", ref: "OFF-2026-0801", applicationId: "adm_app_001", name: "Samaira Kapoor", guardian: "Dr. Kapoor", phone: "9845231209", grade: "3", issuedAt: "2026-11-01", expiresAt: "2026-11-08", status: "pending", tokenPaid: 0, tokenPaidAt: "", studentId: "", reason: "", ...p });
const enquiry = { id: "adm_enq_001", ref: "ENQ-2026-0001", name: "Samaira Kapoor", grade: "3", dob: "2018-06-12", guardian: "Dr. Kapoor", relation: "Mother", phone: "9845231209", email: "k@x.in", source: "Walk-In", stage: "offered", createdAt: "2026-10-30", applicationId: "adm_app_001" };
const seat3 = { id: "adm_seat_3", grade: "3", group: "primary", capacity: 2, rteSeats: 1, block: "B" };

describe("Offer acceptance and enrolment", () => {
  it("accepting records the configured token", async () => {
    seed({ adm_config: [config], adm_seats: [seat3], adm_applications: [app()], adm_offers: [offer()], adm_enquiries: [enquiry] });
    const { user } = renderUI(<Offers />);
    await user.click(screen.getByRole("button", { name: "Accept" }));
    expect(getRow("adm_offers", "adm_off_001")).toMatchObject({ status: "accepted", tokenPaid: 30000, tokenPaidAt: "2026-11-03" });
  });

  it("enrolling creates a contract-shaped student in the least-filled section and closes the pipeline", async () => {
    seed({
      adm_config: [config], adm_seats: [seat3], adm_applications: [app()], adm_offers: [offer({ status: "accepted", tokenPaid: 30000, tokenPaidAt: "2026-11-02" })], adm_enquiries: [enquiry],
      classes: [{ id: "cls_3A", grade: "3", section: "A", classTeacherId: "stf_001" }, { id: "cls_3B", grade: "3", section: "B", classTeacherId: "" }],
      students: [{ id: "stu_012", name: "X", grn: "GIS-8812", grade: "3", section: "A", classId: "cls_3A", roll: 1, status: "Active" },
        { id: "stu_013", name: "Y", grn: "GIS-8813", grade: "3", section: "B", classId: "cls_3B", roll: 3, status: "Active" },
        { id: "stu_014", name: "Z", grn: "GIS-8814", grade: "3", section: "A", classId: "cls_3A", roll: 2, status: "Active" }],
    });
    const { user } = renderUI(<Offers />);
    await user.click(screen.getByRole("button", { name: "Enrol student" }));
    expect(getRow("students", "stu_015")).toMatchObject({
      name: "Samaira Kapoor", grn: "GIS-8815", grade: "3", section: "B", classId: "cls_3B", roll: 4, guardian: "Dr. Kapoor", phone: "9845231209",
      status: "Active", dob: "2018-06-12", gender: "Female", relation: "Mother", guardianEmail: "k@x.in", admissionDate: "2026-11-03", offerId: "adm_off_001",
    });
    expect(getRow("adm_offers", "adm_off_001")).toMatchObject({ status: "enrolled", studentId: "stu_015" });
    expect(getRow("adm_applications", "adm_app_001")).toMatchObject({ status: "enrolled" });
    expect(getRow("adm_enquiries", "adm_enq_001")).toMatchObject({ stage: "enrolled" });
    expect(writesTo("classes")).toHaveLength(0);
    expect(await screen.findByText("Samaira Kapoor enrolled — GRN GIS-8815 added to Students")).toBeInTheDocument();
  });

  it("creates the class doc when the grade has no class yet", async () => {
    seed({ adm_config: [config], adm_seats: [seat3], adm_applications: [app()], adm_offers: [offer({ status: "accepted" })] });
    const { user } = renderUI(<Offers />);
    await user.click(screen.getByRole("button", { name: "Enrol student" }));
    expect(getRow("classes", "cls_3A")).toMatchObject({ grade: "3", section: "A", classTeacherId: "" });
    expect(getRow("students", "stu_001")).toMatchObject({ classId: "cls_3A", roll: 1, grade: "3", section: "A" });
  });

  it("declining records the reason and releases the seat", async () => {
    seed({ adm_config: [config], adm_seats: [seat3], adm_applications: [app()], adm_offers: [offer()], adm_enquiries: [enquiry] });
    const { user } = renderUI(<Offers />);
    await user.click(screen.getByRole("button", { name: "Decline" }));
    const d = dialog("Decline offer");
    await user.selectOptions(field("Reason", d), "Relocating");
    await user.click(within(d).getByRole("button", { name: "Confirm decline" }));
    expect(getRow("adm_offers", "adm_off_001")).toMatchObject({ status: "declined", reason: "Relocating" });
    expect(getRow("adm_applications", "adm_app_001")).toMatchObject({ status: "withdrawn" });
    expect(getRow("adm_enquiries", "adm_enq_001")).toMatchObject({ stage: "lost", lostReason: "Offer declined" });
  });

  it("generate offer: lists offerable candidates and refuses a full grade", async () => {
    seed({ adm_config: [config], adm_seats: [{ ...seat3, capacity: 1 }], adm_applications: [app({ id: "a_enr", ref: "APP-2026-0005", status: "enrolled", offerId: "" }), app({ id: "a_short", ref: "APP-2026-0006", name: "Kabir Rao", status: "shortlisted", offerId: "" })], adm_offers: [] });
    const { user } = renderUI(<Offers />);
    await user.click(screen.getByRole("button", { name: /Generate offer/ }));
    const d = dialog("Generate offer");
    const opts = [...(field("Candidate", d) as unknown as HTMLSelectElement).options].map((o) => o.value);
    expect(opts).toEqual(["", "a_short"]);
    await user.selectOptions(field("Candidate", d), "a_short");
    await user.click(within(d).getByRole("button", { name: "Generate" }));
    expect(await screen.findByText("No free seat in Grade 3 — increase capacity or release an offer")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("generate offer uses the configured validity", async () => {
    seed({ adm_config: [config], adm_seats: [seat3], adm_applications: [app({ id: "a_short", ref: "APP-2026-0006", name: "Kabir Rao", status: "shortlisted", offerId: "" })], adm_offers: [] });
    const { user } = renderUI(<Offers />);
    await user.click(screen.getByRole("button", { name: /Generate offer/ }));
    const d = dialog("Generate offer");
    await user.selectOptions(field("Candidate", d), "a_short");
    await user.click(within(d).getByRole("button", { name: "Generate" }));
    expect(rowsOf("adm_offers")[0]).toMatchObject({ ref: "OFF-2026-0801", applicationId: "a_short", issuedAt: "2026-11-03", expiresAt: "2026-11-13", status: "pending" });
  });
});

describe("Seat capacity editor", () => {
  async function openEditor() {
    seed({ adm_seats: [seat3, { id: "adm_seat_5", grade: "5", group: "primary", capacity: 30, rteSeats: 5, block: "B" }], adm_applications: [app({ status: "enrolled" }), app({ id: "a2", status: "offered" })], adm_offers: [offer({ applicationId: "a2" })] });
    const r = renderUI(<Seats />);
    await r.user.click(screen.getByRole("button", { name: /Edit capacity/ }));
    return { ...r, d: dialog("Edit seat capacity") };
  }
  it("refuses capacity below enrolled + live offers and RTE seats above capacity", async () => {
    const { user, d } = await openEditor();
    const cap = within(d).getByLabelText("Grade 3 capacity"), rte = within(d).getByLabelText("Grade 3 RTE seats");
    await user.clear(cap); await user.type(cap, "1");
    expect(within(d).getByText("Capacity cannot be below 2 (enrolled + live offers)")).toBeInTheDocument();
    expect(within(d).getByRole("button", { name: "Save" })).toBeDisabled();
    await user.clear(cap); await user.type(cap, "4");
    await user.clear(rte); await user.type(rte, "5");
    expect(within(d).getByText("RTE seats cannot exceed capacity")).toBeInTheDocument();
    await user.clear(rte); await user.type(rte, "-1");
    expect(within(d).getByText("RTE seats must be a whole number")).toBeInTheDocument();
    await user.clear(cap);
    expect(within(d).getByText("Capacity must be a whole number")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("saves whole-number capacities", async () => {
    const { user, d } = await openEditor();
    const cap = within(d).getByLabelText("Grade 3 capacity");
    await user.clear(cap); await user.type(cap, "6");
    await user.click(within(d).getByRole("button", { name: "Save" }));
    expect(getRow("adm_seats", "adm_seat_3")).toMatchObject({ capacity: 6, rteSeats: 1 });
    expect(getRow("adm_seats", "adm_seat_5")).toMatchObject({ capacity: 30, rteSeats: 5 });
  });
});
