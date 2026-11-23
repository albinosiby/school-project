import { beforeEach, describe, expect, it } from "vitest";
import { DutiesView } from "./DutiesView";
import { authState, getRow, renderUI, screen, seed, writes } from "@/test/render";

const teacher = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher" as const, staffId: "stf_1", staffRole: "teacher", name: "Anita" };
const base = () => seed({
  staff: [{ id: "stf_1", name: "Anita Rao" }],
  exm_cycles: [{ id: "c1", title: "Annual Examination", short: "Annual" }],
  exm_papers: [
    { id: "p1", cycleId: "c1", grade: "10", subject: "Mathematics", code: "MAT", date: "2099-12-01", start: "09:00", duration: 3, venue: "Hall A", classIds: ["cls_10B"] },
    { id: "p2", cycleId: "c1", grade: "9", subject: "Science", code: "SCI", date: "2020-01-05", start: "10:30", duration: 2, venue: "Hall B", invigilatorId: "stf_1" },
  ],
  exm_duties: [
    { id: "dut_1", paperId: "p1", cycleId: "c1", staffId: "stf_1", role: "Invigilator", hall: "Hall C", date: "2099-12-01", start: "09:00", end: "12:00", grade: "10", subject: "Mathematics", code: "MAT", classIds: ["cls_10B"], status: "upcoming", note: "Set A" },
    { id: "dut_2", paperId: "p1", cycleId: "c1", staffId: "stf_2", role: "Chief Invigilator", hall: "Hall C", date: "2099-12-01", start: "09:00", end: "12:00", grade: "10", subject: "Mathematics" },
  ],
  exm_candidates: [
    { id: "cand_s2", studentId: "s2", name: "Bina Das", roll: "#10B-02", grn: "GIS-2", cls: "10-B", grade: "10", section: "B" },
    { id: "cand_s1", studentId: "s1", name: "Aarav Sharma", roll: "#10B-01", grn: "GIS-1", cls: "10-B", grade: "10", section: "B" },
    { id: "cand_s9", studentId: "s9", name: "Other Class", roll: "#10A-01", grn: "GIS-9", cls: "10-A", grade: "10", section: "A" },
  ],
});

describe("DutiesView", () => {
  beforeEach(() => { authState.user = teacher; });

  it("shows an empty state for non-teaching staff", () => {
    authState.user = { ...teacher, role: "staff" };
    renderUI(<DutiesView />);
    expect(screen.getByText("Only teachers have exam duties")).toBeInTheDocument();
  });

  it("lists own upcoming duties (not other teachers') and chief papers under Past", async () => {
    base();
    const { user } = renderUI(<DutiesView />);
    expect(screen.getByText("Mathematics — Class 10")).toBeInTheDocument();
    expect(screen.getByText("Annual • MAT • Set A")).toBeInTheDocument();
    expect(screen.getByText("Hall C")).toBeInTheDocument();
    expect(screen.getByText("09:00 – 12:00")).toBeInTheDocument();
    expect(screen.getByText("08:30 · Exam Control Room")).toBeInTheDocument();
    expect(screen.getByText("Invigilator")).toBeInTheDocument();
    expect(screen.queryByText("Science — Class 9")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Past/ }));
    expect(screen.getByText("Science — Class 9")).toBeInTheDocument();
    expect(screen.getByText("Chief Invigilator")).toBeInTheDocument();
    expect(screen.getByText("Hall B")).toBeInTheDocument();
  });

  it("opens the hall with the paper's candidates and stores attendance ticks in ed_cand_state", async () => {
    base();
    const { user } = renderUI(<DutiesView />);
    await user.click(screen.getByRole("button", { name: "Open hall for Mathematics" }));
    expect(screen.getByText("2 present · 0 absent of 2")).toBeInTheDocument();
    expect(screen.queryByText("Other Class")).not.toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("D-01");
    expect(rows[0]).toHaveTextContent("Aarav Sharma");
    await user.selectOptions(screen.getByLabelText("Attendance for Aarav Sharma"), "absent");
    expect(getRow("ed_cand_state", "dut_1__cand_s1_stf_1")).toEqual({
      id: "dut_1__cand_s1_stf_1", dutyId: "dut_1", candId: "cand_s1", status: "absent", supp: 0, suppCode: "", malpractice: "", absentReason: "", teacherId: "stf_1",
      updatedAt: expect.any(String), updatedBy: expect.any(String),
    });
    expect(screen.getByText("1 present · 1 absent of 2")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Attendance for Aarav Sharma"), "present");
    expect(getRow("ed_cand_state", "dut_1__cand_s1_stf_1")).toMatchObject({ status: "present", supp: 0 });
  });

  it("keeps the checklist and the final-list submission in ed_duty_state", async () => {
    base();
    const { user } = renderUI(<DutiesView />);
    await user.click(screen.getByRole("button", { name: "Open hall for Mathematics" }));
    await user.click(screen.getByLabelText("Briefing: collect sealed envelopes and attendance rolls"));
    expect(getRow("ed_duty_state", "dut_1_stf_1")).toEqual({
      id: "dut_1_stf_1", dutyId: "dut_1", swap: "", swapWith: "", swapReason: "", checked: [0], submitted: false, teacherId: "stf_1", updatedAt: expect.any(String), updatedBy: expect.any(String),
    });
    await user.click(screen.getByLabelText("Conclusion: collect scripts, seal the bundle and hand over"));
    expect(getRow("ed_duty_state", "dut_1_stf_1")).toMatchObject({ checked: [0, 2] });
    await user.click(screen.getByRole("button", { name: "Submit final attendance" }));
    expect(await screen.findByText("Final attendance list submitted")).toBeInTheDocument();
    expect(getRow("ed_duty_state", "dut_1_stf_1")).toMatchObject({ checked: [0, 2], submitted: true });
    expect(writes[writes.length - 1]).toMatchObject({ coll: "ed_duty_state", id: "dut_1_stf_1" });
    expect(screen.getByLabelText("Attendance for Aarav Sharma")).toBeDisabled();
    expect(screen.getByText("Attendance submitted")).toBeInTheDocument();
  });
});
