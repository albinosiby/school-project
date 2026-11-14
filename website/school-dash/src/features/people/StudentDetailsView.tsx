"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, Modal, ProgressBar, useToast } from "@/components/ui";
import { StudentPortrait } from "@/features/admissions/AdmissionFilePreview";
import { AdmissionDocumentsPanel } from "@/features/admissions/AdmissionDocumentsPanel";
import { useAdmissionDocuments } from "@/features/admissions/admissionDocuments";
import { blankAdmission, type AdmissionDetails, type ContactType } from "@/features/admissions/admissionDetails";
import { schoolDoc, stamp } from "@/features/fees/logic";
import { addressRecord } from "@/features/onboarding/address";
import { COUNTRIES, INDIA_STATES } from "@/features/onboarding/locations";
import { classStream, isSeniorGrade, streamFromClassId, streamName } from "@/lib/academicStreams";
import { useAuth } from "@/lib/authContext";
import { db } from "@/lib/firebase";
import { consentMap, useSchoolUsers, type Consent } from "@/lib/parentAccount";
import { useCollection } from "@/lib/useCollection";
import { ParentLoginSection } from "./ParentLoginSection";
import { StudentTransportCard } from "./StudentTransportCard";
import { StudentDivisionAssignment } from "./StudentDivisionPicker";
import { StudentForm } from "./StudentForm";
import { studentClassId } from "./studentLogic";
import { recordedAttendance, type StudentAttendanceMonth } from "./studentAttendance";
import type { Student } from "./StudentsView";

const contactLabels: Record<ContactType, string> = { father: "Father", mother: "Mother", guardian: "Other guardian" };

function DetailsCard({ title, fields }: { title: string; fields: [string, string | undefined][] }) {
  return <Card className="p-5">
    <h2 className="t-label-caps mb-3 text-on-surface-variant">{title}</h2>
    <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm">
      {fields.map(([label, value]) => <div key={label} className="contents">
        <dt className="text-outline">{label}</dt>
        <dd className="whitespace-pre-line break-words">{value?.trim() || "—"}</dd>
      </div>)}
    </dl>
  </Card>;
}

export function StudentDetailsView({ studentId }: { studentId: string }) {
  const router = useRouter();
  const toast = useToast();
  const students = useCollection<Student>("students");
  const documents = useAdmissionDocuments();
  const attendance = useCollection<StudentAttendanceMonth>("par_attendance");
  const schoolId = useAuth().user?.schoolId;
  const [admissionRecord, setAdmissionRecord] = useState<{
    schoolId: string; studentId: string; details?: AdmissionDetails; failed?: boolean;
  }>();
  useEffect(() => {
    if (!schoolId) return;
    const ref = doc(db, "schools", schoolId, "adm_student_details", studentId);
    return onSnapshot(ref, (snapshot) => {
      setAdmissionRecord({ schoolId, studentId, details: snapshot.data() as AdmissionDetails | undefined });
    }, () => {
      setAdmissionRecord({ schoolId, studentId, failed: true });
    });
  }, [schoolId, studentId]);
  const { users } = useSchoolUsers();
  const consents = useCollection<Consent>("consents");
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useLayoutEffect(() => {
    // Cached routes preserve state when hidden. A delete confirmation is only for this visit.
    return () => setConfirmingDelete(false);
  }, [schoolId, studentId]);
  const rows = students.rows.filter((row) => row.deleted !== true);
  const student = rows.find((row) => row.id === studentId);
  const currentAdmission = admissionRecord?.schoolId === schoolId && admissionRecord?.studentId === studentId
    ? admissionRecord : undefined;
  const details = currentAdmission?.details;

  async function deleteStudent() {
    if (!student || deleting) return;
    setDeleting(true);
    try {
      await students.remove(student.id);
      toast("Student removed");
      router.replace("/students");
    } catch {
      toast("Could not delete", "error");
    } finally {
      setDeleting(false);
    }
  }

  const back = <Link href="/students" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:underline">
    <ArrowLeft size={16} aria-hidden="true" /> Back to students
  </Link>;
  if (!students.ready) return <div>{back}<p role="status">Loading student details…</p></div>;
  if (!student) return <div>{back}<Card><EmptyState title="Student record unavailable" hint="The record may have been removed or may not be available to your account." /></Card></div>;

  const checklist = documents.byStudent.get(student.id);
  const photo = checklist?.uploads.photo;
  const recorded = recordedAttendance(attendance.rows, [student]).get(student.id);
  const statusTone = student.status === "Active" ? "success" : student.status === "Transferred" ? "neutral" : "warning";
  const course = isSeniorGrade(student.grade) ? student.stream || streamName(classStream(student) || streamFromClassId(student.classId)) : "";
  const classLabel = [`Grade ${student.grade}`, course, student.section ? `Division ${student.section}` : "Division unassigned"].filter(Boolean).join(" · ");
  const subtitle = [student.grn, classLabel, `Roll ${student.roll || "unassigned"}`].filter(Boolean).join(" · ");

  const nationality = COUNTRIES.find((country) => country.code === details?.nationality)?.name || details?.nationality;
  const residence = details?.residence;
  const address = student.address || (residence && addressRecord(
    { ...blankAdmission("").residence, ...residence },
    residence.country === "IN" ? INDIA_STATES : [],
  ).address);
  const primary = details?.primary;
  const secondary = details?.secondary ? details.contacts?.[details.secondary] : undefined;
  const secondaryName = details?.secondary && (secondary?.name || contactLabels[details.secondary]);
  const transfer = details?.admissionType === "Transfer" || Boolean(details?.previousSchool);
  const guardianFields: [string, string | undefined][] = [
    ["Name", student.guardian], ["Relation", student.relation], ["Phone", student.phone],
    ["Email", student.email],
  ];
  const guardianAddress = primary === "guardian" ? details?.contacts?.guardian?.address : undefined;
  if (guardianAddress) guardianFields.push(["Guardian address", guardianAddress]);
  if (details) guardianFields.push(
    ["Secondary contact", secondaryName || undefined],
    ["Preferred communication language", details.language],
    ["Emergency contact number", details.emergencyPhone],
  );

  return <div>
    {back}
    <Card className="mb-5 flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="shrink-0">
          {photo ? <StudentPortrait key={photo.path} name={student.name} path={photo.path} /> : <Avatar name={student.name} size={96} />}
        </div>
        <div className="min-w-0">
          <h1 className="t-headline-lg break-words">{student.name}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={statusTone}>{student.status}</Badge>
            <span className="text-sm text-on-surface-variant">Date of birth: {student.dob || "—"}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <StudentDivisionAssignment key={student.id} student={student} students={students.rows} />
        <Button variant="danger" onClick={() => setConfirmingDelete(true)}><Trash2 size={14} />Delete</Button>
        <Button onClick={() => setEditing(true)}><Pencil size={14} />Edit</Button>
      </div>
    </Card>
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <div className="grid min-w-0 gap-4">
        <Card className="p-5">
          <h2 className="t-label-caps mb-2 text-on-surface-variant">Attendance</h2>
          {recorded ? <>
            <div className="flex items-center gap-3">
              <ProgressBar value={recorded.pct} tone={recorded.pct >= 75 ? "success" : "danger"} />
              <span className="font-mono text-sm">{recorded.pct}%</span>
            </div>
            <p className="mt-1 text-sm text-on-surface-variant">{recorded.attended} of {recorded.days} recorded days attended</p>
          </> : <p className="text-sm text-on-surface-variant">{attendance.ready ? "Not recorded" : "Loading attendance…"}</p>}
        </Card>
        {details && <DetailsCard title="Student information" fields={[
          ["First name at admission", details.firstName], ["Middle name at admission", details.middleName], ["Last name at admission", details.lastName],
          ["Gender", details.gender || student.gender], ["Nationality", nationality], ["Religion", details.religion],
          ["Mother tongue", details.motherTongue], ["Category", details.category], ["Caste", details.caste],
        ]} />}
        {!details && student.gender && <DetailsCard title="Student information" fields={[["Gender", student.gender]]} />}
        {address && <DetailsCard title="Student address" fields={[["Address", address]]} />}
        <DetailsCard title="Guardian" fields={guardianFields} />
        <StudentTransportCard key={student.id} student={student} students={students.rows} />
        {(details || student.admissionNumber || student.admissionDate || student.academicYear) && <DetailsCard title="Admission" fields={[
          ["Admission number", student.admissionNumber], ["Admission date", student.admissionDate || details?.admissionDate],
          ["Academic year", student.academicYear || details?.academicYear], ["Student type", details?.studentType], ["Admission type", details?.admissionType],
        ]} />}
        {details && transfer && <DetailsCard title="Previous school" fields={[
          ["School name", details.previousSchool], ["Address", details.previousAddress], ["Previous class", details.previousClass],
          ["Previous board", details.previousBoard], ["Previous admission number", details.previousAdmissionNo],
          ["Transfer certificate number", details.previousTcNo], ["Previous academic performance", details.performance],
        ]} />}
        {!currentAdmission && <p role="status">Loading saved admission details…</p>}
        {currentAdmission?.failed && <p role="status">Saved admission details could not be loaded.</p>}
      </div>
      <div className="grid min-w-0 gap-4">
        <Card className="p-5">
          <ParentLoginSection key={student.id} s={student} students={rows} users={users} consents={consentMap(consents.rows)} />
        </Card>
        {(["father", "mother"] as const).map((key) => {
          const contact = details?.contacts?.[key];
          if (!contact || !(contact.name || contact.phone || contact.email || contact.occupation)) return null;
          const title = primary === key ? `${contactLabels[key]} · Designated guardian` : contactLabels[key];
          return <DetailsCard key={key} title={title} fields={[
            ["Name", contact.name], ["Phone", contact.phone], ["Email", contact.email], ["Occupation", contact.occupation],
          ]} />;
        })}
        {details && <DetailsCard title="Medical and health" fields={[
          ["Blood group", details.bloodGroup], ["Existing medical conditions", details.conditions], ["Disabilities or special assistance", details.assistance],
        ]} />}
        <Card className="p-5">
          {documents.ready ? <AdmissionDocumentsPanel id={student.id} checklist={checklist} />
            : <p role="status">Loading admission documents…</p>}
        </Card>
      </div>
    </div>
    {editing && <StudentForm edit={student} existing={students.rows} users={users} onClose={() => setEditing(false)}
      onSave={async (values) => {
        const ref = schoolDoc("students", student.id);
        await runTransaction(db, async (transaction) => {
          const current = await transaction.get(ref);
          if (!current.exists() || current.data().deleted === true) throw new Error("This student record was removed.");
          const moved = studentClassId(current.data()) !== values.classId;
          const fields: Partial<typeof values> = { ...values };
          delete fields.roll;
          delete fields.guardianEmail;
          transaction.update(ref, { ...fields, ...(moved ? { roll: values.roll, rollAcademicYear: "" } : {}), ...stamp() });
        });
        toast("Student updated");
        setEditing(false);
      }} />}
    <Modal open={confirmingDelete} onClose={() => { if (!deleting) setConfirmingDelete(false); }} title="Delete student?" subtitle={student.name}
      footer={<><Button variant="ghost" disabled={deleting} onClick={() => setConfirmingDelete(false)}>Cancel</Button>
        <Button variant="danger" disabled={deleting} onClick={deleteStudent}>{deleting ? "Deleting…" : "Delete"}</Button></>}>
      <p className="text-on-surface-variant">This permanently removes the student record. This cannot be undone.</p>
    </Modal>
  </div>;
}
