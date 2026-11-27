// Homework hand-ins from the parent app (par_hw_submissions/{studentId}_{homeworkId}, written by a guardian after
// uploading the files to Storage at schools/{sid}/homework/{homeworkId}/{studentId}/...). The server copies a
// checked version into ops_homework.handins.{studentId}; the teacher app never writes `handins`, so a teacher saving
// grades cannot overwrite a hand-in that arrived meanwhile.

const MAX_FILES = 10;
const TYPES = /^(image\/(jpeg|png|heic|heif|webp)|application\/pdf)$/;
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Open for hand-ins: not deleted, not a draft, not closed / completed. */
function homeworkOpen(h) {
  if (!h || h.deleted === true) return false;
  return !/draft|closed|completed/i.test(String(h.status ?? ""));
}

/**
 * The hand-in to store for [submission] of [studentId] on homework [homeworkId] of school [sid] (null when invalid):
 * only files uploaded under that homework and student's own Storage folder, of the allowed types, at most 10; the
 * note trimmed; late when handed in after the due day (school calendar day of submittedAt).
 */
function handinFrom(submission, { sid, homeworkId, studentId, due, today }) {
  if (!submission || submission.studentId !== studentId || submission.homeworkId !== homeworkId) return null;
  const prefix = `schools/${sid}/homework/${homeworkId}/${studentId}/`;
  const files = (Array.isArray(submission.files) ? submission.files : [])
    .filter((f) => f && typeof f === "object" && typeof f.path === "string" && f.path.startsWith(prefix) && !f.path.slice(prefix.length).includes("/")
      && typeof f.url === "string" && /^https:\/\//.test(f.url) && TYPES.test(String(f.type ?? "")))
    .slice(0, MAX_FILES)
    .map((f) => ({ name: str(f.name, 120) || f.path.slice(prefix.length), url: f.url, path: f.path, type: f.type, size: Number(f.size) || 0 }));
  if (!files.length) return null;
  const submittedAt = /^\d{4}-\d{2}-\d{2}T/.test(String(submission.submittedAt ?? "")) ? submission.submittedAt : new Date().toISOString();
  const dueDay = String(due ?? "").slice(0, 10);
  return {
    files, note: str(submission.note, 500), submittedAt, uid: str(submission.uid, 128),
    late: /^\d{4}-\d{2}-\d{2}$/.test(dueDay) && today > dueDay,
  };
}

/** A student's submission as the parent app shows it: the teacher's grading merged with the hand-in. */
function mergedSubmission(h, studentId, clean) {
  const x = h?.submissions?.[studentId];
  const hi = h?.handins?.[studentId];
  const base = x && typeof x === "object" ? x : {};
  const graded = base.status === "graded";
  const status = graded ? "graded" : hi ? "submitted" : (base.status ?? "pending");
  return clean({
    status, marks: base.marks, feedback: base.feedback, gradedAt: base.gradedAt,
    files: hi?.files, note: hi?.note, submittedAt: hi?.submittedAt, late: hi ? hi.late === true : undefined,
  });
}

module.exports = { handinFrom, homeworkOpen, mergedSubmission, MAX_FILES };
