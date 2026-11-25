/* ls_plans as the admin web reads it (contract section 5): teacher-private plans with a review the admin answers. */
export type ReviewState = "none" | "submitted" | "approved" | "changes";
export type Plan = {
  id: string; teacherId?: string; title: string; cls?: string; subject?: string; chapter?: string; summary?: string; outcomes?: string[];
  sessions?: { id?: string; date?: string; slot?: string; focus?: string; activities?: { title: string; mins: number }[]; homework?: string; status?: string; note?: string }[];
  attachments?: { name: string; size?: string; url: string; contentType?: string }[];
  sessionCount?: number; taughtCount?: number;
  review?: { state?: ReviewState; note?: string; by?: string; at?: string; submittedAt?: string };
};

export const reviewTone = (s?: ReviewState) => (s === "approved" ? "success" : s === "changes" ? "danger" : s === "submitted" ? "warning" : "neutral") as "success" | "danger" | "warning" | "neutral";

/** The update the admin writes: the decision, the note, who and when (submittedAt stays). */
export function reviewPatch(p: Plan, state: "approved" | "changes", note: string, by: string, now = new Date().toISOString()) {
  return { review: { state, note: note.trim(), by, at: now, submittedAt: p.review?.submittedAt ?? "" } };
}
