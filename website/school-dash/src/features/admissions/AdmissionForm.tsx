"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingSkeleton, Button, Modal, useToast } from "@/components/ui";
import { GeneratedParentPassword } from "@/features/people/GeneratedParentPassword";
import { StudentForm } from "@/features/people/StudentForm";
import { streamIdOf } from "@/lib/academicStreams";
import { setParentAppAccess, useSchoolUsers, type ParentCredentials } from "@/lib/parentAccount";
import { uploadAdmissionDocument } from "./admissionDocuments";
import { saveAdmission } from "./admissionSave";
import { useCollection } from "@/lib/useCollection";
import type { ClassRef, StudentRow } from "./logic";
import { studentGrade, type Application, type Enquiry, type Offer, type Seat } from "./types";
import { studentProfileHref } from "@/features/people/studentLogic";

type ParentAccessOutcome =
  | ({ state: "issued" } & ParentCredentials)
  | { state: "active"; email: string }
  | { state: "failed"; email: string; message: string };

export function AdmissionForm({ mode, application, enquiry, offer, onClose }: {
  mode: "add" | "direct" | "enrol";
  application?: Application;
  enquiry?: Enquiry;
  offer?: Offer;
  onClose: () => void;
}) {
  const students = useCollection<StudentRow>("students");
  const classes = useCollection<ClassRef>("classes");
  const apps = useCollection<Application>("adm_applications");
  const enq = useCollection<Enquiry>("adm_enquiries");
  const offers = useCollection<Offer>("adm_offers");
  const seats = useCollection<Seat>("adm_seats");
  const { users } = useSchoolUsers();
  const router = useRouter();
  const requestId = useRef<string>(undefined);
  const [parentAccessOutcome, setParentAccessOutcome] = useState<(ParentAccessOutcome & { studentId: string }) | null>(null);
  const [retrying, setRetrying] = useState(false);
  const toast = useToast();
  const linkedEnquiry = enquiry ?? enq.rows.find((row) => row.id === application?.enquiryId);
  const ready = students.ready && classes.ready && apps.ready && offers.ready && seats.ready &&
    (!(enquiry || application?.enquiryId) || enq.ready);
  const source = application ?? enquiry;

  function finish(id: string) {
    onClose();
    router.push(studentProfileHref(id));
  }

  async function setupParentAccess(studentId: string, email: string) {
    try {
      const result = await setParentAppAccess(studentId, { enabled: true, email });
      if (result.state === "off") throw new Error("Parent app access could not be enabled.");
      setParentAccessOutcome({ ...result, studentId });
    } catch (error) {
      const message = error instanceof Error && error.message && !/^internal(?:\s*\[\d+\])?$/i.test(error.message)
        ? error.message : "The password service could not be reached.";
      setParentAccessOutcome({ studentId, state: "failed", email, message });
    }
  }

  if (parentAccessOutcome) {
    const { studentId, email, state } = parentAccessOutcome;
    const done = () => { if (!retrying) finish(studentId); };
    const retry = async () => {
      if (retrying) return;
      setRetrying(true);
      try { await setupParentAccess(studentId, email); }
      finally { setRetrying(false); }
    };
    return <Modal open onClose={done} title="Parent app access"
      footer={<>
        {state === "failed" && <Button variant="outline" disabled={retrying} onClick={retry}>
          {retrying ? "Generating…" : "Retry password setup"}
        </Button>}
        <Button disabled={retrying} onClick={done}>Open Student Details</Button>
      </>}>
      {state === "issued" ? <GeneratedParentPassword credentials={parentAccessOutcome} /> : <div className="space-y-2 text-sm">
        <p><strong>Parent username</strong> {email}</p>
        {state === "failed" && <p role="alert" className="text-error">
          The student was saved, but the parent password could not be generated. {parentAccessOutcome.message}
        </p>}
        {state === "active" && <p>The student is linked to an active parent account. The parent can use their existing password.</p>}
      </div>}
    </Modal>;
  }
  if (application && !ready) return <LoadingSkeleton variant="form" label="Loading enrolment details…" />;

  return <StudentForm mode={mode} existing={students.rows} users={users} readyToSave={ready} onClose={onClose}
    initial={source && {
      name: source.name, guardian: source.guardian, phone: source.phone,
      dob: source.dob || linkedEnquiry?.dob || "", guardianEmail: source.email || linkedEnquiry?.email || "",
      relation: linkedEnquiry?.relation || application?.relation || "Parent", grade: studentGrade(source.grade),
      firstName: source.name.trim().split(/\s+/)[0] || "",
      lastName: source.name.trim().split(/\s+/).slice(1).join(" "),
      gender: application?.gender || linkedEnquiry?.gender || linkedEnquiry?.answers?.gender || "",
      streamId: streamIdOf(source.grade.split("-").slice(1).join("-")),
    }}
    onSave={async (student, photo, parentLoginEmail) => {
      if (mode === "direct" && !enquiry) requestId.current ??= crypto.randomUUID();
      const id = await saveAdmission(student, {
        students: students.rows, classes: classes.rows, applications: apps.rows, seats: seats.rows, offers: offers.rows,
        application, enquiry, offer, requestId: requestId.current, recordAdmission: mode !== "add",
      });
      if (photo) {
        try { await uploadAdmissionDocument(id, "photo", photo); }
        catch { toast("Admission saved. Upload the photograph again from the student profile.", "error"); }
      }
      toast(mode === "add" ? "Student added" : "Student enrolled");
      if (parentLoginEmail) {
        await setupParentAccess(id, parentLoginEmail);
        return;
      }
      finish(id);
    }} />;
}
