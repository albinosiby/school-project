"use client";

import { useId, useState } from "react";
import { UserRoundPen } from "lucide-react";
import { Avatar, Button, Card, Field, Modal, Select, useToast } from "@/components/ui";
import { classTitle, type ClassTeacher } from "./classDetails";
import { TeacherName } from "./ClassTimetable";
import { classTeacherElsewhere, type ClassRow } from "./logic";
import { teachingStaff } from "./shared";
import { TeacherPhone } from "./TeacherPhone";

type TeacherPatch = Pick<ClassRow, "classTeacherId" | "classTeacher">;

export function ClassTeacherCard({ cls, classes, staff, onSave }: {
  cls: ClassRow;
  classes: ClassRow[];
  staff: ClassTeacher[];
  onSave: (patch: TeacherPatch) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const formId = useId();
  const toast = useToast();
  const current = staff.find((member) => member.id === cls.classTeacherId);
  const name = current?.name || cls.classTeacher;
  const teachers = teachingStaff(staff.map((member) => ({ ...member, department: member.department ?? "" })));
  const available = teachers.filter((member) => member.id === cls.classTeacherId || !classTeacherElsewhere(classes, member.id, cls.id));

  function open() {
    setTeacherId(cls.classTeacherId || "");
    setError("");
    setEditing(true);
  }
  function close() { if (!saving) setEditing(false); }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || teacherId === (cls.classTeacherId || "")) return;
    const selected = teachers.find((member) => member.id === teacherId);
    const other = classTeacherElsewhere(classes, teacherId, cls.id);
    if (other) {
      setError(`${selected?.name || "This teacher"} is already class teacher of ${classTitle(other)}. Unassign them there first.`);
      return;
    }
    if (teacherId && !selected) {
      setError("This teacher is no longer available. Choose another teacher.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ classTeacherId: teacherId, classTeacher: selected?.name || "" });
      setEditing(false);
      toast(teacherId ? "Class teacher saved" : "Class teacher unassigned");
    } catch {
      setError("Could not save the class teacher. Try again.");
    } finally { setSaving(false); }
  }

  return <>
    <Card role="region" aria-label="Class teacher" className="min-w-0 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Class teacher</h2>
        <Button variant="outline" size="sm" onClick={open}><UserRoundPen size={14} aria-hidden="true" />{cls.classTeacherId ? "Change class teacher" : "Set class teacher"}</Button>
      </div>
      <div className="flex items-center gap-3">
        <Avatar name={name || "—"} size={44} />
        <div className="min-w-0">
          <p className="break-words text-base font-semibold"><TeacherName id={current?.id} name={name} /></p>
          <div className="mt-1 text-sm text-on-surface-variant">{cls.classTeacherId ? <TeacherPhone teacher={current} icon /> : "Choose a teacher for this class."}</div>
        </div>
      </div>
    </Card>
    <Modal open={editing} onClose={close} title="Set class teacher" subtitle={classTitle(cls)} footer={<>
      <Button variant="ghost" disabled={saving} onClick={close}>Cancel</Button>
      <Button type="submit" form={formId} disabled={saving || teacherId === (cls.classTeacherId || "")}>{saving ? "Saving…" : "Save"}</Button>
    </>}>
      <form id={formId} onSubmit={save}>
        <Field label="Class teacher" hint="Teachers assigned to another class are available after they are unassigned there.">
          <Select autoFocus value={teacherId} disabled={saving} onChange={(event) => { setTeacherId(event.target.value); setError(""); }}>
            <option value="">Not assigned</option>
            {cls.classTeacherId && !available.some((member) => member.id === cls.classTeacherId) && <option value={cls.classTeacherId}>{name || cls.classTeacherId}</option>}
            {available.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </Select>
        </Field>
        {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
      </form>
    </Modal>
  </>;
}
