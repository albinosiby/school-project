"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { doc, writeBatch } from "firebase/firestore";
import { LoadingSkeleton, Badge, Button, Card, EmptyState, Modal, useToast } from "@/components/ui";
import { COUNTRIES } from "@/features/onboarding/locations";
import type { Crew } from "@/features/transport/types";
import { useAuth } from "@/lib/authContext";
import { auth, db } from "@/lib/firebase";
import { accountError, createAccount, sendInvite } from "@/lib/staffAccount";
import { resendStaffInvitation } from "@/lib/staffInvitation";
import { assignableStaffRoles } from "@/lib/staffRoles";
import { currentSchoolId, useCollection } from "@/lib/useCollection";
import { normalizeSubjects, subjectCatalogId, subjectForSelection, subjectKey, subjectSettingsId, type SubjectSettings } from "@/lib/schoolSubjects";
import { useNow } from "@/lib/useNow";
import { StaffAppLogin } from "./StaffAppLogin";
import { StaffActivityCards, StaffLeaveHistory } from "./StaffActivityCards";
import { StaffDocumentsPanel } from "./StaffDocumentsPanel";
import { StaffPortrait } from "./StaffPortrait";
import { StaffTeachingAssignments } from "./StaffTeachingAssignments";
import { StaffTimetable } from "./StaffTimetable";
import { StaffPayrollCards } from "./StaffPayrollCards";
import { LegacyStaffForm } from "./LegacyStaffForm";
import { StaffProfileForm } from "./StaffProfileForm";
import type { Staff } from "./StaffView";
import { localDate } from "./checkins";
import type { StaffLeave } from "./leaves";
import { effectiveStatus } from "./staffLogic";
import { appLoginRole, deleteStaffProfile, isTeachingStaff, loadStaffProfile, staffFormError, staffSubjects,
  type StaffAddress } from "./staffProfiles";

type DetailsField = [string, string | undefined];
type SavedProfile = Awaited<ReturnType<typeof loadStaffProfile>>;

function DetailsCard({ title, fields, children }: { title: string; fields?: DetailsField[]; children?: ReactNode }) {
  return <Card className="min-w-0 p-5">
    <h2 className="t-label-caps mb-3 text-on-surface-variant">{title}</h2>
    {fields && <DetailsList fields={fields} />}
    {children}
  </Card>;
}

function DetailsList({ fields }: { fields: DetailsField[] }) {
  return <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm">
    {fields.map(([label, value]) => <div key={label} className="contents">
      <dt className="text-outline">{label}</dt>
      <dd className="whitespace-pre-line break-words">{value?.trim() || "—"}</dd>
    </div>)}
  </dl>;
}

function countryName(code?: string) {
  return COUNTRIES.find((country) => country.code === code)?.name ?? code;
}

function addressFields(address?: StaffAddress): DetailsField[] {
  return [
    ["Address line 1", address?.line1], ["Address line 2", address?.line2], ["City / locality", address?.city],
    ["District", address?.district], ["State", address?.state], ["Country", countryName(address?.country)],
    ["PIN / postal code", address?.pin],
  ];
}

export function StaffDetailsView({ staffId }: { staffId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { rows, ready, update } = useCollection<Staff>("staff");
  const departmentSettings = useCollection<SubjectSettings>("set_config").rows.find(({ id }) => id === subjectSettingsId);
  const leaves = useCollection<StaffLeave>("staff_leaves");
  const crewRecords = useCollection<Crew>("tr_crew");
  const today = localDate(new Date(useNow()));
  const member = rows.find((row) => row.id === staffId);
  const hasMember = Boolean(member);
  const canManage = user?.role === "admin";
  const scope = canManage ? JSON.stringify([user.id, user.schoolId, staffId]) : "";
  const managed = Boolean(member?.profileVersion);
  const [editing, setEditing] = useState<"legacy" | "profile" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [revision, setRevision] = useState(0);
  const [record, setRecord] = useState<{ scope: string; revision: number; result?: SavedProfile; error?: string }>();
  const [loginBusy, setLoginBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [uploadedPhoto, setUploadedPhoto] = useState<{ scope: string; revision: number; photo: string }>();
  const [loginEmail, setLoginEmail] = useState<{ scope: string; email: string }>();

  useLayoutEffect(() => () => {
    setEditing(null);
    setConfirmDelete(false);
  }, [scope]);

  useEffect(() => {
    if (!scope || !hasMember) return;
    let disposed = false;
    loadStaffProfile(staffId).then((result) => {
      if (!disposed) setRecord({ scope, revision, result });
    }).catch((error: unknown) => {
      if (!disposed) setRecord({ scope, revision, error: staffFormError(error) });
    });
    return () => { disposed = true; };
  }, [hasMember, revision, scope, staffId]);

  const back = <Link href="/staff" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:underline">
    <ArrowLeft size={16} aria-hidden="true" /> Back to staff
  </Link>;
  if (!ready) return <div>{back}<LoadingSkeleton variant="details" label="Loading staff details…" /></div>;
  if (!member || !canManage) return <div>{back}<Card>
    <EmptyState title="Staff record unavailable" hint="The record may have been removed or may not be available to your account." />
  </Card></div>;

  const loaded = record?.scope === scope && record.revision === revision ? record : undefined;
  const details = loaded?.result?.profile;
  const photo = uploadedPhoto?.scope === scope && uploadedPhoto.revision === revision
    ? uploadedPhoto.photo : loaded?.result?.photo;
  const status = effectiveStatus(member, leaves.rows, today);
  const linkedEmail = loginEmail?.scope === scope ? loginEmail.email : member.authUid ? member.email ?? "" : "";
  const designation = details?.designation || member.designation || member.role;
  const staffCategory = details?.category || member.category;
  const department = details?.department || member.department;
  const teaching = isTeachingStaff({ ...member, designation, category: staffCategory });
  const departmentId = details?.departmentId ?? member.departmentId;
  const academicDepartment = departmentSettings?.departments?.find(({ id }) => id === departmentId)?.name;
  const [savedSubject, ...savedAdditionalSubjects] = staffSubjects(member);
  const subjectCatalog = normalizeSubjects(departmentSettings?.subjects ?? []);
  const teachingSubject = (name: string, id?: string) => {
    const match = subjectForSelection(subjectCatalog, name, id);
    return match ? { name: match.name, key: subjectCatalogId(match) || subjectKey(match.name) }
      : { name, key: id || subjectKey(name) };
  };
  const primarySubject = teachingSubject(details?.primarySubject || savedSubject, details?.primarySubjectId);
  const subject = primarySubject.name;
  const extraSubjects = new Map((details?.additionalSubjects ?? savedAdditionalSubjects).map((name, index) => {
    const mapped = teachingSubject(name, details?.additionalSubjectIds?.[index]);
    return [mapped.key, mapped.name];
  }));
  extraSubjects.delete(primarySubject.key);
  const additionalSubjects = [...extraSubjects.values()];
  const driver = designation === "Driver";
  const crew = crewRecords.rows.find((entry) => entry.id === member.crewId)
    ?? crewRecords.rows.find((entry) => entry.staffId === member.id)
    ?? crewRecords.rows.find((entry) => member.authUid && entry.authUid === member.authUid);
  const crewId = crew?.id || member.crewId;
  const subtitle = [member.empId, designation, teaching ? subject : department].filter(Boolean).join(" · ");
  const actionsBusy = busyAction || loginBusy || photoBusy;
  const roles = assignableStaffRoles(user);

  async function createLegacyLogin(staff: Staff) {
    const email = staff.email;
    if (!email) {
      setEditing("legacy");
      toast("Add an email first", "error");
      return;
    }
    const schoolId = currentSchoolId();
    if (!schoolId) return;
    setBusyAction(true);
    try {
      const account = await createAccount(email);
      try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        batch.set(doc(db, "users", account.uid), {
          schoolId, role: "teacher", staffId, email: email.trim(), name: staff.name, createdAt: now,
        });
        batch.set(doc(db, "schools", schoolId, "staff", staffId), {
          name: staff.name, email, authUid: account.uid, updatedAt: now, updatedBy: auth.currentUser?.uid ?? "",
        }, { merge: true });
        await batch.commit();
      } catch (error) {
        await account.rollback();
        throw error;
      }
      try {
        await sendInvite(email);
        toast(`Login created. Password email sent to ${email}`);
      } catch {
        toast("Login created, but the password email could not be sent. Use Resend invite.", "error");
      } finally {
        await account.finish();
      }
    } catch (error) {
      toast(accountError(error), "error");
    } finally {
      setBusyAction(false);
    }
  }

  async function resendLegacyInvite(staff: Staff) {
    if (!staff.email) return;
    setBusyAction(true);
    try {
      if (staff.staffRole) {
        if (!(await resendStaffInvitation(staffId))) {
          toast("The invitation could not be sent. Wait a minute and try again.", "error");
          return;
        }
      } else {
        await sendInvite(staff.email);
      }
      toast(`Password email sent to ${staff.email}`);
    } catch (error) {
      toast(accountError(error), "error");
    } finally {
      setBusyAction(false);
    }
  }

  async function removeStaff(staff: Staff) {
    setBusyAction(true);
    try {
      const schoolId = currentSchoolId();
      if (!schoolId) throw new Error("Not signed in");
      if (staff.profileVersion) {
        await deleteStaffProfile(staffId);
      } else {
        const batch = writeBatch(db);
        batch.delete(doc(db, "schools", schoolId, "staff", staffId));
        if (staff.authUid) batch.delete(doc(db, "users", staff.authUid));
        await batch.commit();
      }
      toast("Staff removed");
      setConfirmDelete(false);
      router.push("/staff");
    } catch {
      toast("Could not delete the staff member", "error");
    } finally {
      setBusyAction(false);
    }
  }

  async function markReturned() {
    setBusyAction(true);
    try {
      await update(staffId, { status: "Active", leaveFrom: "", leaveTo: "", leaveReason: "" });
      toast("Marked as returned");
    } catch {
      toast("Could not update the leave status", "error");
    } finally {
      setBusyAction(false);
    }
  }

  return <div>
    {back}
    <Card className="mb-5 flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
      <div className="flex min-w-0 items-center gap-4">
        <StaffPortrait name={member.name} photo={photo} />
        <div className="min-w-0">
          <h1 className="t-headline-lg break-words">{member.name}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={status.status === "Active" ? "success" : status.status === "On leave" ? "warning" : "neutral"}>{status.status}</Badge>
            <span className="text-sm text-on-surface-variant">Date of birth: {details?.birthDate || "—"}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {member.status === "On leave" && <Button variant="outline" disabled={actionsBusy} onClick={markReturned}>Mark returned</Button>}
        {!member.crewId && <Button variant="danger" disabled={actionsBusy} onClick={() => setConfirmDelete(true)}>
          <Trash2 size={14} />Delete
        </Button>}
        <Button disabled={actionsBusy} onClick={() => setEditing(managed ? "profile" : "legacy")}><Pencil size={14} />Edit</Button>
      </div>
    </Card>

    {managed && !loaded && <LoadingSkeleton variant="details" label="Loading saved staff details…" className="mb-4 text-sm text-on-surface-variant" />}
    {loaded?.error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm text-error">
      {loaded.error}
      <Button variant="outline" size="sm" onClick={() => setRevision((value) => value + 1)}>Try again</Button>
    </div>}
    {teaching && <StaffTimetable key={`${scope}:timetable`} member={member} staff={rows} />}
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <div className="grid min-w-0 gap-4">
        <StaffActivityCards key={scope} member={member} designation={designation} today={today}
          crewId={crewId} busId={crew?.busId} crewReady={crewRecords.ready} />
        {teaching && <StaffTeachingAssignments key={`${scope}:teaching`} staffId={staffId} />}
        <DetailsCard title="Basic information" fields={[
          ["Employee ID", member.empId], ["Full name", member.name],
          ...(details ? ([
            ["First name", details.firstName], ["Middle name", details.middleName], ["Last name", details.lastName],
            ["Date of birth", details.birthDate], ["Gender", details.gender], ["Nationality", countryName(details.nationality)],
            ["Blood group", details.bloodGroup], ["Marital status", details.maritalStatus],
            ["Alternate mobile", details.alternatePhone],
          ] satisfies DetailsField[]) : []),
          ["Mobile number", details?.phone || member.phone],
          ["Contact email", details?.contactEmail ?? (!member.authUid ? member.email : undefined)],
        ]} />
        {details && <>
          <DetailsCard title="Current address" fields={addressFields(details.currentAddress)} />
          <DetailsCard title="Permanent address" fields={addressFields(details.sameAddress ? details.currentAddress : details.permanentAddress)}>
            {details.sameAddress && <p className="mt-3 text-sm text-on-surface-variant">Same as current address</p>}
          </DetailsCard>
          <DetailsCard title="Emergency contact" fields={[
            ["Name", details.emergency?.name], ["Relationship", details.emergency?.relationship],
            ["Mobile number", details.emergency?.mobile], ["Alternate number", details.emergency?.alternate],
            ["Address", details.emergency?.address],
          ]} />
        </>}
      </div>
      <div className="grid min-w-0 gap-4">
        <Card className="min-w-0 p-5">
          {linkedEmail || details?.category && details.designation ? <StaffAppLogin key={JSON.stringify([scope, revision])}
            staffId={staffId} existingEmail={linkedEmail} role={details ? appLoginRole({
              category: details.category ?? "", designation: details.designation ?? "", departmentId: details.departmentId ?? "",
            }, roles) : undefined}
            onBusyChange={setLoginBusy} onLinked={(email) => setLoginEmail({ scope, email })} /> : <>
            <h2 className="t-label-caps mb-3 text-on-surface-variant">App login</h2>
            <p className="text-sm text-on-surface-variant">Complete the staff profile to set up app access.</p>
          </>}
          {!managed && <div className="mt-3">
            {member.authUid
              ? (!member.staffRole || roles.some((role) => role === member.staffRole)) &&
                <Button size="sm" variant="outline" disabled={actionsBusy} onClick={() => resendLegacyInvite(member)}>Resend invite</Button>
              : roles.length > 0 && !member.staffRole &&
                <Button size="sm" variant="outline" disabled={actionsBusy} onClick={() => createLegacyLogin(member)}>Create login</Button>}
          </div>}
        </Card>
        <DetailsCard title="Employment" fields={[
          ["Staff category", staffCategory], ["Designation", designation],
          teaching ? ["Subject", subject] : ["Department", department],
          ...(teaching && academicDepartment ? ([["Department", academicDepartment]] satisfies DetailsField[]) : []),
          ["Joining date", details?.joined || member.joined], ["Employment type", details?.employmentType],
          ["Employment status", details?.employmentStatus || member.status], ["Probation period (months)", details?.probationMonths],
          ...(staffCategory === "Non-Teaching"
            ? ([["Work shift", details?.workShift]] satisfies DetailsField[]) : []),
          ...(details?.employmentType === "Contract" ? ([
            ["Contract start date", details.contractStart], ["Contract end date", details.contractEnd],
          ] satisfies DetailsField[]) : []),
          ...(status.status === "On leave" ? ([
            ["On leave until", status.until], ["Leave reason", member.leaveReason],
          ] satisfies DetailsField[]) : []),
        ]} />
        {teaching && details ? <DetailsCard title="Teaching details" fields={[
          ["Additional subjects", additionalSubjects.join(", ")], ["Teaching experience (years)", details.teachingExperience],
          ["Previous school", details.previousSchool], ["Previous designation", details.previousDesignation],
          ["TET / CTET qualified", details.tet], ["TET / CTET certificate number", details.tetCertificate],
          ["B.Ed / D.El.Ed qualification", details.teachingQualification], ["Specialization", details.specialization],
        ]} /> : driver && details ? <DetailsCard title="Driver details" fields={[
          ["Driving licence number", details.licenseNumber], ["Licence expiry date", details.licenseExpiry],
        ]} /> : details ? <DetailsCard title="Non-teaching details" fields={[
          ["Previous work experience (years)", details.workExperience], ["Previous organization", details.previousOrganization],
          ["Relevant skills", details.skills], ["Professional certification", details.professionalCertification], ["Licence number", details.licenseNumber],
        ]} /> : teaching && additionalSubjects.length > 0 &&
          <DetailsCard title="Teaching details" fields={[["Additional subjects", additionalSubjects.join(", ")]]} />}
        {details && <DetailsCard title="Qualifications">
          {details.qualifications?.length ? <div className="grid gap-3">
            {details.qualifications.map((qualification, index) => <div key={index} className="rounded-lg border border-outline-variant p-3">
              <h3 className="mb-2 font-semibold">{qualification.course || `Qualification ${index + 1}`}</h3>
              <DetailsList fields={[
                ["Qualification level", qualification.level], ["Specialization", qualification.specialization],
                ["Institution / university", qualification.institution], ["Year of completion", qualification.year], ["Grade / percentage", qualification.grade],
              ]} />
            </div>)}
          </div> : <p className="text-sm text-on-surface-variant">No qualifications recorded.</p>}
        </DetailsCard>}
        <StaffPayrollCards key={scope} staffId={staffId} today={today} />
        <Card className="p-5">
          <StaffDocumentsPanel key={scope} staffId={staffId} photo={photo} editing={!!editing} onPhotoBusy={setPhotoBusy}
            designation={designation} directoryRole={member.role} staffRole={member.staffRole}
            staffCategory={details?.category || member.category}
            hasProfessionalCredential={Boolean(details?.professionalCertification || details?.licenseNumber)}
            onPhotoSaved={(photo) => setUploadedPhoto({ scope, revision, photo })} />
        </Card>
      </div>
    </div>
    <div className="mt-4">
      <StaffLeaveHistory key={scope} member={member} crewId={crewId} today={today} />
    </div>
    {editing === "legacy" && <LegacyStaffForm key={scope} edit={member} rows={rows} onClose={() => setEditing(null)}
      onComplete={() => setEditing("profile")} onSave={async (values) => {
        try {
          await update(staffId, values);
          toast("Staff updated");
          setEditing(null);
        } catch (error) {
          toast(accountError(error), "error");
        }
      }} />}
    {editing === "profile" && <StaffProfileForm key={scope} member={member} staff={rows} permittedRoles={roles}
      onClose={() => { setEditing(null); setRevision((value) => value + 1); }} />}
    <Modal open={confirmDelete} onClose={() => { if (!busyAction) setConfirmDelete(false); }}
      title="Delete staff member?" subtitle={member.name} footer={<>
        <Button variant="ghost" disabled={busyAction} onClick={() => setConfirmDelete(false)}>Cancel</Button>
        <Button variant="danger" disabled={busyAction} onClick={() => removeStaff(member)}>Delete</Button>
      </>}>
      <p className="text-on-surface-variant">This removes the staff record permanently{member.authUid ? " and revokes their app access." : "."}</p>
    </Modal>
  </div>;
}
