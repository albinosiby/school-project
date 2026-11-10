import policy from "../../../functions/staffRoles.json";

export type StaffRole = keyof typeof policy.labels;
export const staffRoleLabels = policy.labels;

export function assignableStaffRoles(user: { role: string; staffRole?: string } | null): StaffRole[] {
  const actor = user?.role === "admin" ? "admin" : user?.role === "staff" && user.staffRole !== "admin" ? user.staffRole : "";
  return actor && Object.hasOwn(policy.assignable, actor)
    ? policy.assignable[actor as keyof typeof policy.assignable] as StaffRole[]
    : [];
}
