"use client";

import { useId, useState } from "react";
import { MapPin } from "lucide-react";
import { Button, Field, Input, Modal, useToast } from "@/components/ui";
import { classTitle } from "./classDetails";
import { roomTakenBy, type ClassRow } from "./logic";

export function ClassRoomAssignment({ cls, classes, onSave }: {
  cls: ClassRow; classes: ClassRow[]; onSave: (room: string) => Promise<unknown>;
}) {
  const toast = useToast();
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [room, setRoom] = useState("");
  const [original, setOriginal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const cleanRoom = room.trim().replace(/\s+/g, " ");
  function open() {
    setRoom(cls.room || ""); setOriginal(cls.room || ""); setError(""); setEditing(true);
  }
  function close() { if (!saving) setEditing(false); }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || cleanRoom === (cls.room || "")) return;
    if ((cls.room || "") !== original) {
      setError("The assigned room changed while you were editing. Close this dialog and review the current room.");
      return;
    }
    if (cleanRoom.length > 20) { setError("Room is at most 20 characters."); return; }
    const other = roomTakenBy(classes, cleanRoom, cls.id);
    if (other) { setError(`Room ${cleanRoom} is already assigned to ${classTitle(other)}.`); return; }
    setSaving(true); setError("");
    try {
      await onSave(cleanRoom);
      setEditing(false);
      toast(cleanRoom ? "Class room saved" : "Class room unassigned");
    } catch { setError("Could not save the room. Try again."); }
    finally { setSaving(false); }
  }
  return <>
    <Button variant="outline" size="sm" onClick={open}><MapPin size={14} aria-hidden="true" />{cls.room ? "Change room" : "Assign room"}</Button>
    <Modal open={editing} onClose={close} title={cls.room ? "Change room" : "Assign room"} subtitle={classTitle(cls)} footer={<>
      <Button variant="ghost" disabled={saving} onClick={close}>Cancel</Button>
      <Button type="submit" form={formId} disabled={saving || cleanRoom === (cls.room || "")}>{saving ? "Saving…" : "Save room"}</Button>
    </>}>
      <form id={formId} onSubmit={save}>
        <Field label="Room" error={error} hint="Enter a room number or name, such as 204 or Science Lab. Leave blank to unassign.">
          <Input autoFocus maxLength={20} value={room} disabled={saving} onChange={(event) => { setRoom(event.target.value); setError(""); }} />
        </Field>
      </form>
    </Modal>
  </>;
}
