import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tests } from "./Tests";
import { dialog, field, getRow, renderUI, rowsOf, screen, seed, within, writes } from "@/test/render";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

const docs = { birth: "verified", idProof: "verified", immunisation: "verified", tc: "verified" };
const base = { enquiryId: "", gender: "", dob: "", guardian: "G", phone: "9845231209", email: "", grade: "3", tag: "general", submittedAt: "2026-10-31", feePaid: true, feeMode: "UPI", docs, interviewSlotId: "", panelist: "", waitlistNo: 0, offerId: "", notes: "" };
const slot = { id: "adm_slot_1", batch: "BATCH #01", title: "Grade 3 diagnostic", type: "test", date: "2026-11-10", time: "09:30", venue: "Hall 1", capacity: 2, invigilator: "Mrs. Rao", status: "scheduled" };

describe("Schedule slot form", () => {
  async function openModal() {
    const r = renderUI(<Tests />);
    await r.user.click(screen.getByRole("button", { name: /Schedule slot/ }));
    return { ...r, d: dialog("Schedule test / interview slot") };
  }
  it("requires title, date and venue", async () => {
    const { user, d } = await openModal();
    await user.click(within(d).getByRole("button", { name: "Schedule" }));
    expect(within(d).getByText("Title, date and venue are required")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("refuses a past date and a capacity below 1", async () => {
    const { user, d } = await openModal();
    await user.type(field("Title", d), "Grade 3 diagnostic");
    await user.type(field("Venue", d), "Hall 1");
    await user.type(field("Date", d), "2026-11-02");
    await user.click(within(d).getByRole("button", { name: "Schedule" }));
    expect(within(d).getByText("Date cannot be in the past")).toBeInTheDocument();
    await user.clear(field("Date", d));
    await user.type(field("Date", d), "2026-11-10");
    await user.clear(field("Capacity", d));
    await user.type(field("Capacity", d), "0");
    await user.click(within(d).getByRole("button", { name: "Schedule" }));
    expect(within(d).getByText("Capacity must be a whole number of at least 1")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("creates the slot with the next batch label", async () => {
    seed({ adm_slots: [slot] });
    const { user, d } = await openModal();
    await user.type(field("Title", d), " Grade 5 diagnostic ");
    await user.type(field("Venue", d), "Lab A");
    await user.type(field("Date", d), "2026-11-12");
    await user.type(field("Invigilator / panel lead", d), "Mr. Das");
    await user.click(within(d).getByRole("button", { name: "Schedule" }));
    const created = rowsOf<Record<string, unknown>>("adm_slots").find((s) => s.id !== "adm_slot_1");
    expect(created).toMatchObject({ batch: "BATCH #02", title: "Grade 5 diagnostic", type: "test", date: "2026-11-12", time: "09:30", venue: "Lab A", capacity: 40, invigilator: "Mr. Das", status: "scheduled" });
  });
});

describe("Assign candidates", () => {
  it("lists only eligible applicants and refuses more than the free places", async () => {
    seed({ adm_slots: [slot], adm_applications: [
      { ...base, id: "a1", ref: "APP-2026-0001", name: "Riya", status: "verified", testSlotId: "", writtenScore: null, panelStatus: null },
      { ...base, id: "a2", ref: "APP-2026-0002", name: "Kabir", status: "verified", testSlotId: "", writtenScore: null, panelStatus: null },
      { ...base, id: "a3", ref: "APP-2026-0003", name: "Tara", status: "verified", testSlotId: "", writtenScore: null, panelStatus: null },
      { ...base, id: "a4", ref: "APP-2026-0004", name: "Unpaid", status: "verified", feePaid: false, testSlotId: "", writtenScore: null, panelStatus: null },
    ] });
    const { user } = renderUI(<Tests />);
    await user.click(screen.getByRole("button", { name: /Assign candidates/ }));
    const d = dialog("Assign candidates to a slot");
    await user.selectOptions(field("Slot", d), "adm_slot_1");
    expect(within(d).queryByText("Unpaid")).not.toBeInTheDocument();
    for (const n of ["Riya", "Kabir", "Tara"]) await user.click(within(d).getByRole("checkbox", { name: new RegExp(n) }));
    await user.click(within(d).getByRole("button", { name: /Assign 3/ }));
    expect(await screen.findByText("Only 2 places left in this slot")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await user.click(within(d).getByRole("checkbox", { name: /Tara/ }));
    await user.click(within(d).getByRole("button", { name: /Assign 2/ }));
    expect(getRow("adm_applications", "a1")).toMatchObject({ testSlotId: "adm_slot_1", status: "test_scheduled", panelStatus: "hall_ticket", panelist: "Mrs. Rao" });
  });
});

describe("Score entry", () => {
  const tested = { ...base, id: "a1", ref: "APP-2026-0001", name: "Riya", status: "test_scheduled", testSlotId: "adm_slot_1", writtenScore: null, panelStatus: "hall_ticket" };
  async function openScore(extra: Record<string, unknown>[] = []) {
    seed({ adm_slots: [slot], adm_applications: [tested, ...extra] });
    const r = renderUI(<Tests />);
    await r.user.click(screen.getByRole("button", { name: "Enter score" }));
    return { ...r, d: dialog("Enter result · Riya") };
  }
  it("bounds the score to 0–100 and keeps Save disabled until valid", async () => {
    const { user, d } = await openScore();
    const save = within(d).getByRole("button", { name: "Save result" });
    expect(save).toBeDisabled();
    await user.type(field("Written score (0–100)", d), "101");
    expect(within(d).getByText("Enter a number between 0 and 100")).toBeInTheDocument();
    expect(save).toBeDisabled();
    await user.clear(field("Written score (0–100)", d));
    await user.type(field("Written score (0–100)", d), "-3");
    expect(within(d).getByText("Enter a number between 0 and 100")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("cleared → shortlisted with the score", async () => {
    const { user, d } = await openScore();
    await user.type(field("Written score (0–100)", d), "86.5");
    await user.selectOptions(field("Panel outcome", d), "cleared");
    await user.click(within(d).getByRole("button", { name: "Save result" }));
    expect(getRow("adm_applications", "a1")).toMatchObject({ writtenScore: 86.5, panelStatus: "cleared", status: "shortlisted" });
  });
  it("waitlisted gets the next waitlist number in the grade", async () => {
    const { user, d } = await openScore([{ ...base, id: "w", ref: "APP-2026-0009", name: "W", status: "waitlisted", waitlistNo: 4, testSlotId: "", writtenScore: 60, panelStatus: "waitlisted" }]);
    await user.type(field("Written score (0–100)", d), "61");
    await user.selectOptions(field("Panel outcome", d), "waitlisted");
    await user.click(within(d).getByRole("button", { name: "Save result" }));
    expect(getRow("adm_applications", "a1")).toMatchObject({ status: "waitlisted", waitlistNo: 5 });
  });
});
