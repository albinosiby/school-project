import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { StaffRole } from "./staffRoles";

export type StaffInvitation = { name: string; email: string; role: StaffRole; invitationId: string };

export async function createStaffInvitation(input: StaffInvitation) {
  const { data } = await httpsCallable<StaffInvitation, { created: boolean; emailSent: boolean }>(functions, "createSchoolStaff")(input);
  return data.emailSent;
}

export async function resendStaffInvitation(staffId: string) {
  const { data } = await httpsCallable<{ staffId: string }, { emailSent: boolean }>(functions, "resendSchoolStaffInvite")({ staffId });
  return data.emailSent;
}
