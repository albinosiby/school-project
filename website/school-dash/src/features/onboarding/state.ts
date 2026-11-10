"use client";
import { useCollection } from "@/lib/useCollection";
import { firstOpenStep, markCompleted } from "./logic";

export type OnbState = { id: string; complete: boolean; completed?: number[] };
export type OnbData = { id: string; values: Record<string, unknown> };

export function useOnboarding() {
  const st = useCollection<OnbState>("onboarding");
  const data = useCollection<OnbData>("onb_data");
  const steps = useCollection<{ id: string; no: number; done: boolean; doneAt: string }>("setup_steps");
  const state = st.rows.find((r) => r.id === "state");
  const completed = state?.completed ?? [];
  const ready = st.ready && data.ready && steps.ready;
  const firstOpen = firstOpenStep(completed);

  const saved = (no: number) => data.rows.find((r) => r.id === `s${no}`)?.values as Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any

  async function complete(no: number, values: Record<string, unknown>) {
    const row = data.rows.find((r) => r.id === `s${no}`);
    if (row) await data.update(row.id, { values }); else await data.create({ id: `s${no}`, values });
    const next = markCompleted(completed, no);
    // the marker is written by bootstrap; recreate it if it is missing so progress is never lost
    if (state) await st.update("state", { completed: next }); else await st.create({ id: "state", complete: false, completed: next });
    const step = steps.rows.find((s) => s.no === no);
    if (step) await steps.update(step.id, { done: true, doneAt: new Date().toISOString().slice(0, 10) });
  }
  const finish = async () => { if (state) await st.update("state", { complete: true }); else await st.create({ id: "state", complete: true, completed }); };

  return { ready, state, completed, firstOpen, saved, complete, finish };
}
