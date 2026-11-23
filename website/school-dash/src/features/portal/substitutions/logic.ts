// Pure helpers of the teacher's substitution duties (`ops_substitutions` where substituteTeacherId == me).
// The substitute may only move the status to Accepted / Declined (rules: onlyKeys status, updatedAt, updatedBy).
import { subStatus, type Substitution } from "@/features/ops/logic";

export type SubDecision = "Accepted" | "Declined";

/** upcoming (today or later) and past duties, upcoming soonest first and past newest first */
export function groupSubstitutions(rows: Substitution[], today: string) {
  const byTime = (a: Substitution, b: Substitution) => a.date.localeCompare(b.date) || (Number(a.period) || 0) - (Number(b.period) || 0);
  const upcoming = rows.filter((s) => s.date >= today).sort(byTime);
  const past = rows.filter((s) => s.date < today).sort((a, b) => byTime(b, a));
  return { upcoming, past };
}

/** the only patch a substitute may write; the store adds updatedAt / updatedBy */
export const decisionPatch = (status: SubDecision) => ({ status });

/** a duty can be answered while it is still Assigned and not in the past */
export const canDecide = (s: Substitution, today: string) => subStatus(s.status) === "Assigned" && s.date >= today;

export const subTone = (status: unknown) => {
  const s = subStatus(status);
  return (s === "Accepted" ? "success" : s === "Declined" ? "danger" : "warning") as "success" | "danger" | "warning";
};
