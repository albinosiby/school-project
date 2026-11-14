import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { StaffRole } from "@/lib/staffRoles";
import { addressRecord, type SchoolAddress } from "@/features/onboarding/address";
import { NOT_APPLICABLE, OTHER_LOCATION, type AddressState, type LocationOption } from "@/features/onboarding/locations";
import options from "../../../../functions/staffProfileOptions.json";
import type { Staff } from "./StaffView";
import { EMAIL_RE } from "./staffLogic";

export { options };

export const blankAddress = { line1: "", line2: "", country: "", state: "", stateName: "", district: "", districtName: "", city: "", pin: "" };
export const blankEmergency = { name: "", relationship: "", mobile: "", alternate: "", address: "" };
export const blankQualification = { level: "", course: "", specialization: "", institution: "", year: "", grade: "" };

export const blankStaffProfile = {
  empId: "", firstName: "", middleName: "", lastName: "", birthDate: "", gender: "", bloodGroup: "", maritalStatus: "", nationality: "",
  phone: "", alternatePhone: "", contactEmail: "", currentAddress: blankAddress, permanentAddress: blankAddress, sameAddress: true,
  category: "", designation: "", department: "", departmentId: "", joined: "", employmentType: "", employmentStatus: "Active", probationMonths: "",
  contractStart: "", contractEnd: "", workShift: "", emergency: blankEmergency, qualifications: [] as (typeof blankQualification)[],
  teachingLevel: "", primarySubject: "", primarySubjectId: "", additionalSubjects: [] as string[], additionalSubjectIds: [] as string[], teachingExperience: "", previousSchool: "",
  previousDesignation: "", tet: "", tetCertificate: "", teachingQualification: "", specialization: "",
  workExperience: "", previousOrganization: "", skills: "", professionalCertification: "", licenseNumber: "", licenseType: "",
  licenseExpiry: "", vehicleCategory: "",
};

export type StaffProfile = typeof blankStaffProfile;
export type StaffAddress = typeof blankAddress;
export type StaffCredentials = { email: string; password: string };
export type StaffLoginDraft = StaffCredentials;
export const blankStaffLogin: StaffLoginDraft = { email: "", password: "" };

export function staffAddressFields(address: StaffAddress, states: AddressState[]): SchoolAddress {
  const match = <T extends LocationOption>(options: T[], value: string) => options.find((option) =>
    option.code === value || option.name.toLowerCase() === value.trim().toLowerCase());
  const selectedState = match(states, address.state);
  const selectedDistrict = match(selectedState?.districts ?? [], address.district);
  const choice = (saved: string, code?: string) => code ?? (saved && saved !== NOT_APPLICABLE ? OTHER_LOCATION : saved);
  const manualName = (saved: string, name?: string) => saved === OTHER_LOCATION ? name ?? "" : saved;
  const state = choice(address.state, selectedState?.code);
  const district = choice(address.district, selectedDistrict?.code);
  return {
    addressLine1: address.line1, addressLine2: address.line2, country: address.country, city: address.city, pin: address.pin,
    state, stateName: state === OTHER_LOCATION ? manualName(address.state, address.stateName) : "",
    district, districtName: district === OTHER_LOCATION ? manualName(address.district, address.districtName) : "",
  };
}

export function staffAddressDraft(address: SchoolAddress): StaffAddress {
  const { addressLine1, addressLine2, country, state, district, city, pin, stateName = "", districtName = "" } = address;
  return { line1: addressLine1, line2: addressLine2, country, state, stateName, district, districtName, city, pin };
}

export function staffAddressForSave(address: SchoolAddress, states: AddressState[]) {
  const record = addressRecord(address, states);
  return {
    line1: record.addressLine1, line2: record.addressLine2, country: record.country, city: record.city, pin: record.pin,
    state: record.stateName || (record.state === NOT_APPLICABLE ? NOT_APPLICABLE : ""),
    district: record.districtName || (record.district === NOT_APPLICABLE ? NOT_APPLICABLE : ""),
  };
}

export function isTeachingStaff(member: Pick<Staff, "category" | "staffRole" | "role" | "designation">) {
  if (member.category) return member.category === "Teaching";
  const titles = [member.role, member.designation].map((title) => title?.trim().toLowerCase());
  const legacyTeachingTitles = ["hod", "pgt", "tgt", "prt"];
  return member.staffRole === "teacher" || member.staffRole === "hod" ||
    titles.some((title) => title && legacyTeachingTitles.includes(title)) ||
    options.teachingDesignations.some((title) => title !== "Other" && titles.includes(title.toLowerCase()));
}

export function staffSubjects(member: Pick<Staff, "subjects" | "subjectNames">) {
  return member.subjectNames ?? (member.subjects ?? "").split(",").map((subject) => subject.trim()).filter(Boolean);
}

export function staffProfileDraft(member?: Staff, profile?: Partial<StaffProfile> | null): StaffProfile {
  if (profile) return { ...blankStaffProfile, ...profile,
    currentAddress: { ...blankAddress, ...profile.currentAddress },
    permanentAddress: { ...blankAddress, ...profile.permanentAddress },
  };
  if (!member) return blankStaffProfile;
  const [firstName = "", ...rest] = member.name.trim().split(/\s+/);
  const lastName = rest.pop() ?? "";
  const teaching = isTeachingStaff(member);
  return {
    ...blankStaffProfile,
    firstName, middleName: rest.join(" "), lastName, empId: member.empId ?? "",
    category: teaching ? "Teaching" : "Non-Teaching",
    designation: member.designation || member.role, department: member.department ?? "", departmentId: member.departmentId ?? "",
    phone: member.phone ?? "", contactEmail: member.email ?? "", joined: member.joined ?? "",
    employmentStatus: options.employmentStatuses.includes(member.status) ? member.status : "Active",
  };
}

export function appLoginRole(profile: Pick<StaffProfile, "category" | "designation" | "departmentId">, permitted: StaffRole[]) {
  const { category, designation, departmentId } = profile;
  if (!category || !designation) return undefined;
  const mapped = options.designationAppRoles;
  const role = category === "Teaching"
    ? (/^(?:head of department|hod)$/i.test(designation) && departmentId ? "hod" : "teacher")
    : Object.hasOwn(mapped, designation) ? mapped[designation as keyof typeof mapped] as StaffRole : "general_staff";
  return permitted.includes(role) ? role : undefined;
}

export function staffLoginInput(draft: StaffLoginDraft, role?: StaffRole) {
  const email = draft.email.trim();
  const { password } = draft;
  if (!EMAIL_RE.test(email) || email.length > 254) throw new Error("Enter a valid login email.");
  if (!role) throw new Error("Choose a staff designation that can use app access.");
  if (password && ((!/^\d{6}$/.test(password) && password.length < 8) || password.length > 128 || password.trim() !== password)) {
    throw new Error("Use six digits or 8 to 128 characters with no leading or trailing spaces.");
  }
  return { email, role, ...(password ? { password } : {}) };
}

export async function loadStaffProfile(staffId: string) {
  const { data } = await httpsCallable<{ staffId: string }, { profile: Partial<StaffProfile> | null; photo: string | null }>(functions, "getStaffProfile")({ staffId });
  return data;
}

type SavedAddress = ReturnType<typeof staffAddressForSave>;
type StaffProfileInput = Omit<StaffProfile, "currentAddress" | "permanentAddress"> & { currentAddress: SavedAddress; permanentAddress: SavedAddress };

export async function saveStaffProfile(input: { staffId?: string; requestId: string; profile: StaffProfileInput; photo?: string | null }) {
  const { data } = await httpsCallable<typeof input, { staffId: string; empId: string }>(functions, "saveStaffProfile")(input);
  return data;
}

export async function setStaffAppLogin(staffId: string, access: ReturnType<typeof staffLoginInput> | { replace: true }) {
  const request = { staffId, ...access };
  const { data } = await httpsCallable<typeof request, StaffCredentials>(functions, "setStaffAppLogin")(request);
  return data;
}

export async function revealStaffAppPassword(staffId: string) {
  const { data } = await httpsCallable<{ staffId: string },
    ({ state: "revealed" } & StaffCredentials) | { state: "replacement-required" }>(functions, "revealStaffAppPassword")({ staffId });
  return data;
}

export async function deleteStaffProfile(staffId: string) {
  await httpsCallable<{ staffId: string }, { deleted: boolean }>(functions, "deleteStaffProfile")({ staffId });
}

export function staffFormError(error: unknown) {
  if (error instanceof Error && !/^internal(?:\s*\[\d+\])?$/i.test(error.message)) return error.message;
  return "The staff service could not complete the request. Try again.";
}
