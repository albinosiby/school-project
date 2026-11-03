import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Applications } from "./Applications";
import { Overview } from "./Overview";
import { dialog, field, getRow, renderUI, rowsOf, screen, seed, within, writes, writesTo } from "@/test/render";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

const config = { id: "config", appFee: 2500, tokenAmount: 30000, offerValidityDays: 7, submissionCap: 500, safeguards: { razorpay: false, otp: false, dedupe: true, receipts: false }, marketingSpend: {}, stats: { scansToday: 0, visitors: 0, begun: 0, hourly: [] } };
const enquiry = { id: "adm_enq_001", ref: "ENQ-2026-0001", name: "Samaira Kapoor", grade: "3", dob: "2018-06-12", prevSchool: "", guardian: "Dr. Kapoor", relation: "Father", phone: "9845231209", email: "k@x.in", area: "", source: "Walk-In", stage: "new", assignee: "", followUp: "", note: "", sibling: true, createdAt: "2026-10-30", applicationId: "", lostReason: "" };
const pendingDocs = { birth: "pending", idProof: "pending", immunisation: "pending", tc: "pending" };
const application = { id: "adm_app_001", ref: "APP-2026-0001", enquiryId: "adm_enq_001", name: "Samaira Kapoor", gender: "Female", dob: "2018-06-12", guardian: "Dr. Kapoor", phone: "9845231209", email: "k@x.in", grade: "3", tag: "general", status: "submitted", submittedAt: "2026-10-31", feePaid: false, feeMode: "", docs: pendingDocs, testSlotId: "", interviewSlotId: "", writtenScore: null, panelStatus: null, panelist: "", waitlistNo: 0, offerId: "", notes: "" };

describe("Enquiry pipeline (Overview)", () => {
  it("issuing an application creates the application and links the enquiry", async () => {
    seed({ adm_config: [config], adm_enquiries: [enquiry] });
    const { user } = renderUI(<Overview />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Move Samaira Kapoor" }), "app_issued");
    const app = rowsOf<Record<string, unknown>>("adm_applications")[0]!;
    expect(app).toMatchObject({ ref: "APP-2026-0001", enquiryId: "adm_enq_001", status: "submitted", grade: "3", tag: "sibling", feePaid: false, docs: pendingDocs, writtenScore: null });
    expect(getRow("adm_enquiries", "adm_enq_001")).toMatchObject({ stage: "app_issued", applicationId: app.id });
  });

  it("moves an enquiry between open stages", async () => {
    seed({ adm_config: [config], adm_enquiries: [enquiry] });
    const { user } = renderUI(<Overview />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Move Samaira Kapoor" }), "contacted");
    expect(getRow("adm_enquiries", "adm_enq_001")).toMatchObject({ stage: "contacted", lostReason: "" });
    expect(writesTo("adm_applications")).toHaveLength(0);
  });

  it("edit modal saves the counsellor and closes as lost with the given or default reason", async () => {
    seed({ adm_config: [config], adm_enquiries: [enquiry, { ...enquiry, id: "adm_enq_002", ref: "ENQ-2026-0002", name: "Kabir Rao" }], staff: [{ id: "stf_001", name: "Meera Iyer", status: "Active" }] });
    const { user } = renderUI(<Overview />);
    await user.click(screen.getByRole("button", { name: "Samaira Kapoor" }));
    const d = dialog("Samaira Kapoor · ENQ-2026-0001");
    await user.selectOptions(field("Counsellor", d), "Meera Iyer");
    expect(getRow("adm_enquiries", "adm_enq_001")).toMatchObject({ assignee: "Meera Iyer" });
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

  it("refuses Test Scheduled without a slot and Shortlisted without a score", async () => {
    const { user, d } = await openDetail([{ ...application, status: "verified", docs: { birth: "verified", idProof: "verified", immunisation: "verified", tc: "verified" } }]);
    await user.selectOptions(field("Move stage", d), "test_scheduled");
    expect(await screen.findByText("Assign a test slot under Tests & Interviews first")).toBeInTheDocument();
    await user.selectOptions(field("Move stage", d), "shortlisted");
    expect(await screen.findByText("Enter the written score under Tests & Interviews first")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
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
  });
});
