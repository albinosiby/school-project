import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CycleForm } from "./CycleForm";
import { field, fieldError, getRow, renderUI, router, rowsOf, screen, seed, writes, writesTo } from "@/test/render";

const staff = [{ id: "stf_001", name: "Mrs. Sunita Verma", department: "Mathematics", status: "Active" }];
const students = [
  { id: "stu_1", name: "Kabir Nair", grn: "GIS-1", grade: "8", section: "A", roll: 1, status: "Active" },
  { id: "stu_2", name: "Myra Iyer", grn: "GIS-2", grade: "8", section: "A", roll: 2, status: "Active" },
  { id: "stu_3", name: "Aarav Sharma", grn: "GIS-3", grade: "10", section: "B", roll: 4, status: "Active" },
  { id: "stu_4", name: "Gone", grn: "GIS-4", grade: "8", section: "A", roll: 3, status: "Alumni" },
];
const classes = [{ id: "cls_8A", grade: "8", section: "A" }];
const change = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const schedule = () => screen.getByRole("button", { name: "Schedule & Publish Exam Cycle" });
/** the Step 4 paper-slot error line (the same text is also toasted) */
const slotError = (text: string) => screen.getAllByText(text).find((n) => n.tagName === "P");

function fillBasics(_user: unknown, d = { start: "2026-11-15", end: "2026-12-02", decl: "2026-12-18" }) {
  change(field("Exam Cycle Title"), "Term 2 Pre-Board Examinations 2026-27");
  change(field("Start Date"), d.start);
  change(field("End Date"), d.end);
  change(field("Target Declaration"), d.decl);
}
async function addSlot(user: ReturnType<typeof renderUI>["user"], p: { subject?: string; code?: string; date?: string; venue?: string; inv?: string } = {}) {
  await user.click(screen.getByRole("button", { name: /Add Subject Paper Slot/ }));
  if (p.subject !== "") change(field("Subject"), p.subject ?? "Mathematics");
  if (p.code !== "") change(field("Code"), p.code ?? "math-041");
  change(field("Date"), p.date ?? "2026-11-18");
  if (p.venue !== "") change(field("Venue / Room"), p.venue ?? "Exam Hall 1");
  if (p.inv !== "") await user.selectOptions(field("Chief Invigilator"), p.inv ?? "stf_001");
}

describe("Exam cycle form validation", () => {
  it("shows the required errors and writes nothing", async () => {
    seed({ staff });
    const { user } = renderUI(<CycleForm />);
    await user.click(schedule());
    expect(fieldError("Exam Cycle Title")).toBe("Title is required");
    expect(fieldError("Start Date")).toBe("Required");
    expect(fieldError("End Date")).toBe("Required");
    expect(fieldError("Target Declaration")).toBe("Required");
    expect(slotError("Add at least one subject paper slot")).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it("checks the date order", async () => {
    seed({ staff });
    const { user } = renderUI(<CycleForm />);
    fillBasics(user, { start: "2026-11-20", end: "2026-11-10", decl: "2026-11-01" });
    await user.click(schedule());
    expect(fieldError("End Date")).toBe("End must be after start");
    expect(fieldError("Target Declaration")).toBe("Must be on/after end date");
    expect(writes).toHaveLength(0);
  });

  it("needs at least one grade", async () => {
    seed({ staff });
    const { user } = renderUI(<CycleForm />);
    for (const g of ["8", "9", "10"]) await user.click(screen.getByRole("button", { name: new RegExp(`^Grade ${g}\\b`) }));
    await user.click(schedule());
    expect(screen.getAllByText("Select at least one grade").length).toBeGreaterThan(0);
    expect(writes).toHaveLength(0);
  });

  it("needs positive theory max marks", async () => {
    seed({ staff });
    const { user } = renderUI(<CycleForm />);
    fillBasics(user);
    await addSlot(user);
    change(screen.getByLabelText("Theory max marks"), "0");
    await user.click(schedule());
    expect(screen.getAllByText("Theory max marks must be above 0").length).toBeGreaterThan(0);
    expect(writes).toHaveLength(0);
  });

  it("needs every paper slot field, including the invigilator", async () => {
    seed({ staff });
    const { user } = renderUI(<CycleForm />);
    fillBasics(user);
    await addSlot(user, { inv: "" });
    await user.click(schedule());
    expect(slotError("Complete all paper slot fields")).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it("keeps paper dates inside the cycle window", async () => {
    seed({ staff });
    const { user } = renderUI(<CycleForm />);
    fillBasics(user);
    await addSlot(user, { date: "2026-12-05" });
    await user.click(schedule());
    expect(slotError("Paper dates must fall within the cycle window")).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it("needs a paper duration (start < end)", async () => {
    seed({ staff });
    const { user } = renderUI(<CycleForm />);
    fillBasics(user);
    await addSlot(user);
    change(field("Hours"), "0");
    await user.click(schedule());
    expect(slotError("Paper duration must be between 0.5 and 6 hours")).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it("refuses two overlapping papers of the same grade", async () => {
    seed({ staff: [...staff, { id: "stf_002", name: "Dr. Manoj Kaushik", department: "Science", status: "Active" }] });
    const { user } = renderUI(<CycleForm />);
    fillBasics(user);
    await addSlot(user);
    await user.click(screen.getByRole("button", { name: /Add Subject Paper Slot/ }));
    const subj = screen.getAllByText("Subject").map((s) => s.closest("label")!.querySelector("input")!);
    change(subj[1], "Science");
    const code = screen.getAllByText("Code").map((s) => s.closest("label")!.querySelector("input")!);
    change(code[1], "SCI-086");
    change(screen.getAllByText("Date").map((s) => s.closest("label")!.querySelector("input")!)[1], "2026-11-18");
    change(screen.getAllByText("Start").map((s) => s.closest("label")!.querySelector("input")!)[1], "10:00");
    change(screen.getAllByText("Venue / Room").map((s) => s.closest("label")!.querySelector("input")!)[1], "Hall 2");
    await user.selectOptions(screen.getAllByText("Chief Invigilator").map((s) => s.closest("label")!.querySelector("select")!)[1], "stf_002");
    expect(screen.getByText(/2 slot\(s\) have a cohort, room or invigilator clash/)).toBeInTheDocument();
    await user.click(schedule());
    expect(slotError("Resolve schedule clashes before saving")).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it("a draft needs only a title", async () => {
    const { user } = renderUI(<CycleForm />);
    await user.click(screen.getByRole("button", { name: "Save as Draft" }));
    expect(fieldError("Exam Cycle Title")).toBe("Title is required");
    expect(writes).toHaveLength(0);
    await user.type(field("Exam Cycle Title"), "Annual 2027");
    await user.click(screen.getByRole("button", { name: "Save as Draft" }));
    expect(rowsOf("exm_cycles")[0]).toMatchObject({ title: "Annual 2027", status: "Draft" });
    expect(writesTo("exm_candidates")).toHaveLength(0);
  });
});

describe("Exam cycle save", () => {
  it("writes the cycle, its papers with classIds + invigilatorId, and the candidates of the cycle's grades", async () => {
    seed({ staff, students, classes });
    const { user } = renderUI(<CycleForm />);
    fillBasics(user);
    await addSlot(user);
    await user.click(schedule());
    const c = rowsOf<Record<string, unknown>>("exm_cycles")[0];
    expect(c).toMatchObject({ title: "Term 2 Pre-Board Examinations 2026-27", short: "Term 2 Pre-Board", status: "Scheduled", start: "2026-11-15", end: "2026-12-02", grades: ["8", "9", "10"], theoryMax: 80, internalMax: 20 });
    expect(rowsOf("exm_papers")[0]).toMatchObject({
      cycleId: c.id, grade: "8", subject: "Mathematics", code: "MATH-041", date: "2026-11-18", start: "09:00", duration: 2.5, theory: 80, internal: 20,
      venue: "Exam Hall 1", invigilator: "Mrs. Sunita Verma", invigilatorId: "stf_001", classIds: ["cls_8A"], status: "Scheduled", marksEntered: false, published: [],
    });
    expect(rowsOf("exm_candidates").map((x) => x.id).sort()).toEqual(["cand_stu_1", "cand_stu_2", "cand_stu_3"]);
    expect(getRow("exm_candidates", "cand_stu_1")).toMatchObject({ studentId: "stu_1", name: "Kabir Nair", roll: "#8A-01", grn: "GIS-1", cls: "8-A", grade: "8", section: "A" });
    expect(getRow("exm_candidates", "cand_stu_3")).toMatchObject({ roll: "#10B-04", cls: "10-B" });
    expect(router.push).toHaveBeenCalledWith("/exams");
  });

  it("editing a Live cycle keeps it Live and only writes changed candidates", async () => {
    const cyc = { id: "cyc_2", title: "Term 2 Pre-Board Examinations 2026-27", short: "Term 2 Pre-Board", term: "Term 2 (Spring) · AY 2026-27", category: "CBSE Board", start: "2026-11-15", end: "2026-12-02", declaration: "2026-12-18", instructions: "", circular: "", grades: ["8"], sections: "all", enforceAttendance: true, theoryMax: 80, internalMax: 20, internalParts: [5, 5, 5, 5], scale: "CBSE 9-Point Scale (A1 to E2)", passRule: "Min 33% aggregate", grace: "No grace marks", qr: true, sealed: true, biometric: true, status: "Live" };
    const pap = { id: "pap_1", cycleId: "cyc_2", grade: "8", subject: "Mathematics", code: "MATH-041", date: "2026-11-18", start: "09:00", duration: 2.5, theory: 80, internal: 20, internalType: "Internal", venue: "Hall 1", invigilator: "Mrs. Sunita Verma", invigilatorId: "stf_001", status: "Scheduled", marksEntered: false, published: [], classIds: ["cls_8A"] };
    const cand1 = { id: "cand_stu_1", studentId: "stu_1", name: "Kabir Nair", roll: "#8A-01", grn: "GIS-1", cls: "8-A", grade: "8", section: "A" };
    seed({ staff, students, classes, exm_cycles: [cyc], exm_papers: [pap], exm_candidates: [cand1] });
    const { user } = renderUI(<CycleForm cycleId="cyc_2" />);
    change(field("Exam Cycle Title"), "Term 2 Pre-Board 2026-27");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(getRow("exm_cycles", "cyc_2")).toMatchObject({ title: "Term 2 Pre-Board 2026-27", status: "Live" });
    expect(writesTo("exm_papers").map((w) => w.op)).toEqual(["update"]);
    expect(writesTo("exm_candidates").map((w) => w.id)).toEqual(["cand_stu_2"]);
  });
});
