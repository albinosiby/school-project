import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { StaffRole } from "@/lib/staffRoles";
import options from "../../../../functions/staffProfileOptions.json";
import type { Staff } from "./StaffView";

export { options };

export const blankAddress = { line1: "", line2: "", country: "", state: "", district: "", city: "", pin: "" };
export const blankEmergency = { name: "", relationship: "", mobile: "", alternate: "", address: "" };
export const blankQualification = { level: "", course: "", specialization: "", institution: "", year: "", grade: "" };

export const blankStaffProfile = {
  empId: "", firstName: "", middleName: "", lastName: "", birthDate: "", gender: "", bloodGroup: "", maritalStatus: "", nationality: "",
  phone: "", alternatePhone: "", contactEmail: "", currentAddress: blankAddress, permanentAddress: blankAddress, sameAddress: true,
  category: "", designation: "", department: "", joined: "", employmentType: "", employmentStatus: "Active", probationMonths: "",
  contractStart: "", contractEnd: "", workShift: "", emergency: blankEmergency, qualifications: [] as (typeof blankQualification)[],
  teachingLevel: "", primarySubject: "", additionalSubjects: [] as string[], teachingExperience: "", previousSchool: "",
  previousDesignation: "", tet: "", tetCertificate: "", teachingQualification: "", specialization: "",
  workExperience: "", previousOrganization: "", skills: "", professionalCertification: "", licenseNumber: "", licenseType: "",
  licenseExpiry: "", vehicleCategory: "",
};

export type StaffProfile = typeof blankStaffProfile;
export type StaffAddress = typeof blankAddress;
export type StaffCredentials = { email: string; password: string };

export function staffProfileDraft(member?: Staff, profile?: Partial<StaffProfile> | null): StaffProfile {
  if (profile) return { ...blankStaffProfile, ...profile };
  if (!member) return blankStaffProfile;
  const [firstName = "", ...rest] = member.name.trim().split(/\s+/);
  const lastName = rest.pop() ?? "";
  const teaching = ["teacher", "hod"].includes(member.staffRole ?? "") ||
    member.category === "Teaching" || (!member.staffRole && /^(PGT|TGT|PRT|Teacher)$/i.test(member.role));
  return {
    ...blankStaffProfile,
    firstName, middleName: rest.join(" "), lastName, empId: member.empId ?? "",
    category: teaching ? "Teaching" : "Non-Teaching",
    designation: member.designation || member.role, department: member.department ?? "",
    phone: member.phone ?? "", contactEmail: member.email ?? "", joined: member.joined ?? "",
    employmentStatus: options.employmentStatuses.includes(member.status) ? member.status : "Active",
  };
}

export function appLoginRoles(profile: Pick<StaffProfile, "category" | "designation">, permitted: StaffRole[]): StaffRole[] {
  return permitted.filter((role) => {
    if (profile.category === "Teaching") return role === "teacher" || role === "hod";
    if (profile.designation === "Driver") return role === "driver";
    if (profile.designation === "Bus Attendant") return role === "helper";
    return !["teacher", "hod", "driver", "helper"].includes(role);
  });
}

export async function loadStaffProfile(staffId: string) {
  const { data } = await httpsCallable<{ staffId: string }, { profile: Partial<StaffProfile> | null; photo: string | null }>(functions, "getStaffProfile")({ staffId });
  return data;
}

export async function saveStaffProfile(input: { staffId?: string; requestId: string; profile: StaffProfile; photo?: string | null }) {
  const { data } = await httpsCallable<typeof input, { staffId: string; empId: string }>(functions, "saveStaffProfile")(input);
  return data;
}

export async function setStaffAppLogin(staffId: string, access: { email: string; role: StaffRole } | { replace: true }) {
  const request = { staffId, ...access };
  const { data } = await httpsCallable<typeof request, StaffCredentials>(functions, "setStaffAppLogin")(request);
  return data;
}

export async function deleteStaffProfile(staffId: string) {
  await httpsCallable<{ staffId: string }, { deleted: boolean }>(functions, "deleteStaffProfile")({ staffId });
}

export function staffFormError(error: unknown) {
  if (error instanceof Error && !/^internal(?:\s*\[\d+\])?$/i.test(error.message)) return error.message;
  return "The staff service could not complete the request. Try again.";
}
