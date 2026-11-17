import type { Crew } from "@/features/transport/types";
import type { Staff } from "./StaffView";

export const crewStaffDetailsHref = (crewId: string) => `/staff/transport/${encodeURIComponent(crewId)}`;

/** Resolve saved identity links only; names, emails and employee numbers are not identifiers. */
export function staffForCrew(crew: Crew, staff: Staff[]): Staff | undefined {
  const compatible = staff.filter((member) => (!member.crewId || member.crewId === crew.id)
    && (!crew.authUid || !member.authUid || member.authUid === crew.authUid));
  if (crew.staffId) return compatible.find((member) => member.id === crew.staffId);
  const reverse = compatible.filter((member) => member.crewId === crew.id);
  if (reverse.length) return reverse.length === 1 ? reverse[0] : undefined;
  if (!crew.authUid) return undefined;
  const byLogin = compatible.filter((member) => member.authUid === crew.authUid);
  return byLogin.length === 1 ? byLogin[0] : undefined;
}
