"use client";
import { useCollection } from "@/lib/useCollection";

export const STEPS = [
  { no: 1, title: "School Profile", blurb: "Who you are: name, board and affiliation." },
  { no: 2, title: "Academic Year & Terms", blurb: "Set the year and the terms that structure it." },
  { no: 3, title: "Classes & Sections", blurb: "Choose grades, sections and seat capacity." },
  { no: 4, title: "Bell Schedule", blurb: "Define the school day and its periods." },
  { no: 5, title: "Fee Structure", blurb: "Set fees per grade band and payment rules." },
  { no: 6, title: "Staff Allocations", blurb: "Assign roles and class teachers." },
  { no: 7, title: "Data Import", blurb: "Bring in students and guardians." },
  { no: 8, title: "Parent Invite", blurb: "Open the parent app and send invitations." },
] as const;

export type OnbState = { id: string; complete: boolean; completed?: number[] };
export type OnbData = { id: string; values: Record<string, unknown> };

export function useOnboarding() {
  const st = useCollection<OnbState>("onboarding");
  const data = useCollection<OnbData>("onb_data");
  const steps = useCollection<{ id: string; no: number; done: boolean; doneAt: string }>("setup_steps");
  const state = st.rows.find((r) => r.id === "state");
  const completed = state?.completed ?? [];
  const ready = st.ready && data.ready && steps.ready;
  const firstOpen = STEPS.find((s) => !completed.includes(s.no))?.no ?? 8;

  const saved = (no: number) => data.rows.find((r) => r.id === `s${no}`)?.values as Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any

  async function complete(no: number, values: Record<string, unknown>) {
    const row = data.rows.find((r) => r.id === `s${no}`);
    if (row) await data.update(row.id, { values }); else await data.create({ id: `s${no}`, values });
    const next = [...new Set([...completed, no])].sort((a, b) => a - b);
    // the marker is written by bootstrap; recreate it if it is missing so progress is never lost
    if (state) await st.update("state", { completed: next }); else await st.create({ id: "state", complete: false, completed: next });
    const step = steps.rows.find((s) => s.no === no);
    if (step) await steps.update(step.id, { done: true, doneAt: new Date().toISOString().slice(0, 10) });
  }
  const finish = async () => { if (state) await st.update("state", { complete: true }); else await st.create({ id: "state", complete: true, completed }); };

  return { ready, state, completed, firstOpen, saved, complete, finish };
}
