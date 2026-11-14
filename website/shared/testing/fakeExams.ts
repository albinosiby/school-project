// UI test transport only. Authorization/concurrency is tested against the real handler in the emulator suite.
import { getRow, guard, rawDelete, rawSet, rawUpdate, rowsOf } from "./fakeDb";
import type { Paper } from "../../school-dash/src/features/exams/types";
export function fakeExamAction(input: Record<string, unknown>) {
  guard();
  const paper = getRow<Paper>("exm_papers", String(input.paperId));
  if (input.action === "lock" && paper) rawUpdate("exm_papers", paper.id, { locked: input.locked, ...(input.locked === false ? { published: [] } : {}) });
  if (input.action === "subjectPublish" && paper) {
    const label = String(input.classId).replace(/^cls_(\d+)([A-Z])$/, "$1-$2");
    rawUpdate("exm_papers", paper.id, { published: [...new Set([...(paper.published || []), label])], marksEntered: true, status: "Completed", locked: true });
  }
  if (input.action === "duty" && paper) {
    const id = String(input.dutyId || `dut_${input.requestId}`);
    if (input.remove) rawDelete("exm_duties", id);
    else {
      const staff = rowsOf<{ id: string; name: string }>("staff").find((s) => s.id === input.staffId);
      if (input.role === "Chief Invigilator") rawUpdate("exm_papers", paper.id, { invigilatorId: input.staffId, invigilator: staff?.name || "" });
      const end = new Date(`2000-01-01T${paper.start}:00Z`); end.setTime(+end + paper.duration * 3600000);
      rawSet("exm_duties", id, { ...input, id, paperId: paper.id, cycleId: paper.cycleId, staffId: input.staffId, role: input.role, hall: String(input.hall || "").trim(), venue: input.venue,
        date: paper.date, start: paper.start, end: end.toISOString().slice(11, 16), grade: paper.grade, subject: paper.subject, code: paper.code, classIds: paper.classIds, status: "upcoming", note: String(input.note || "").trim(), createdAt: new Date().toISOString() });
    }
  }
  return { ok: true };
}
