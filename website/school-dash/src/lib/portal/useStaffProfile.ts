"use client";
// The signed-in staff member of the portal: users/{uid} (role, staffId, crewId) joined with schools/{sid}/staff/{staffId}.
import { useAuth } from "@/lib/authContext";
import { useCollection } from "@/lib/useCollection";
import { assignableStaffRoles } from "@/lib/staffRoles";

export type StaffRecord = { id: string; name: string; empId?: string; designation?: string; department?: string; role?: string; staffRole?: string; category?: string; phone?: string; email?: string; photoUrl?: string; subjects?: string; subjectNames?: string[]; status?: string };

/** Who is using the portal. `teaching` is true for teacher accounts (role "teacher": teachers and HODs), which is what
 * the rules let mark attendance, enter marks and so on. Non-teaching staff see leave, check-in, notices and their profile.
 * Bus crew (`crew`: driver / attendant) have a crew record instead of a staff record and no staff pages yet. */
export function useStaffProfile() {
  const { user } = useAuth();
  const crew = user?.role === "driver" || user?.role === "attendant";
  const staffId = user?.staffId ?? "";
  // crew accounts cannot read the staff directory (rules: isCrew reads tr_crew), so the listener stays off for them
  const staff = useCollection<StaffRecord>("staff", !!user && !crew);
  const record = staff.rows.find((row) => row.id === staffId);
  const teaching = user?.role === "teacher" && !!staffId;
  return {
    user, staffId, crewId: user?.crewId ?? "", record, ready: crew || staff.ready, teaching, crew,
    name: record?.name || user?.name || user?.email || "",
    designation: record?.designation || record?.staffRole || user?.staffRole || (crew ? (user?.role === "driver" ? "Driver" : "Bus attendant") : ""),
    canAddStaff: assignableStaffRoles(user).length > 0,
  };
}
