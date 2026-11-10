"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, DataTable, Field, Input, Modal, Select, Textarea, useToast, type Column } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { useAdm, useToday } from "./lib";
import { AdmissionForm } from "./AdmissionForm";
import { EnquirySlideOver } from "./EnquirySlideOver";
import { gradeLabel, type Enquiry, type EnqStage } from "./types";

const stages: Record<Exclude<EnqStage, "enrolled">, string> = {
  new: "New", contacted: "Contacted", campus: "Campus visit", app_issued: "Application created",
  offered: "Offered", lost: "Closed",
};

export function Overview() {
  const { enq, apps, ready, moveEnquiry, deleteEnquiry } = useAdm();
  const toast = useToast();
  const today = useToday();
  const [add, setAdd] = useState(false);
  const [stage, setStage] = useState("");
  const [selected, setSelected] = useState<string>();
  const [deleteId, setDeleteId] = useState<string>();
  const [admitting, setAdmitting] = useState<Enquiry>();
  const enrolledApplications = apps.rows.filter((app) => app.status === "enrolled" || app.studentId);
  const enrolledApplicationIds = new Set(enrolledApplications.map((app) => app.id));
  const enrolledEnquiryIds = new Set(enrolledApplications.map((app) => app.enquiryId));
  const remaining = enq.rows.filter((row): row is Enquiry & { stage: Exclude<EnqStage, "enrolled"> } =>
    row.stage !== "enrolled" && !row.studentId && !enrolledEnquiryIds.has(row.id)
    && !enrolledApplicationIds.has(row.applicationId));
  const rows = remaining.filter((row) => !stage || row.stage === stage);
  const current = remaining.find((row) => row.id === selected);
  const deleting = remaining.find((row) => row.id === deleteId);

  const move = async (row: Enquiry, next: EnqStage, reason?: string) => {
    try {
      await moveEnquiry(row, next, reason);
      toast(next === "lost" ? "Enquiry closed" : "Enquiry updated");
      return true;
    } catch { toast("Could not update the enquiry", "error"); return false; }
  };

  const columns: Column<(typeof remaining)[number]>[] = [
    { key: "name", header: "Student", sortValue: (row) => row.name, render: (row) => <><button type="button" className="cursor-pointer text-left font-semibold text-secondary" onClick={() => setSelected(row.id)}>{row.name}</button><p className="text-xs text-outline">{row.ref}</p></> },
    { key: "grade", header: "Grade or course", render: (row) => gradeLabel(row.grade) },
    { key: "guardian", header: "Guardian", render: (row) => <>{row.guardian}<p className="text-xs text-outline">{row.phone}</p></> },
    { key: "followUp", header: "Follow-up", sortValue: (row) => row.followUp || "9999", render: (row) => row.followUp
      ? <Badge tone={row.followUp <= today && !row.applicationId && row.stage !== "lost" ? "warning" : "neutral"}>{fmtDate(row.followUp)}</Badge> : "—" },
    { key: "stage", header: "Status", render: (row) => row.applicationId || row.stage === "lost" || row.stage === "offered"
      ? <Badge>{stages[row.stage]}</Badge>
      : <Select aria-label={`Move ${row.name}`} className="min-w-40" value={row.stage} onChange={(event) => void move(row, event.target.value as EnqStage)}>
        {(["new", "contacted", "campus"] as const).map((value) => <option key={value} value={value}>{stages[value]}</option>)}
      </Select> },
    { key: "actions", header: "Actions", render: (row) => (
      <Button size="sm" variant="ghost" className="text-error" aria-label={`Delete enquiry for ${row.name}`} onClick={() => setDeleteId(row.id)}>
        <Trash2 size={15} />Delete
      </Button>
    ) },
  ];

  return (
    <Card>
      <CardHeader title="Enquiries" actions={<Button onClick={() => setAdd(true)}><Plus size={16} />New enquiry</Button>} />
      {ready ? <DataTable rows={rows} columns={columns} pageSize={10} searchText={(row) => `${row.name} ${row.guardian} ${row.phone} ${row.ref}`}
        toolbar={<Select aria-label="Enquiry status" value={stage} onChange={(event) => setStage(event.target.value)}>
          <option value="">All statuses</option>{Object.entries(stages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>} /> : <p className="p-5">Loading enquiries…</p>}
      <EnquirySlideOver open={add} onClose={() => setAdd(false)} />
      {admitting && <AdmissionForm mode="direct" enquiry={admitting} onClose={() => setAdmitting(undefined)} />}
      {deleting && <DeleteEnquiryDialog key={deleting.id} row={deleting} onClose={() => setDeleteId(undefined)}
        onDelete={async () => {
          await deleteEnquiry(deleting.id);
          setDeleteId(undefined);
          setSelected(undefined);
          toast("Enquiry deleted");
        }} />}
      {current && !admitting && !deleting && <EnquiryDetail key={current.id} row={current}
        onAdmit={() => { setAdmitting(current); setSelected(undefined); }}
        onDelete={() => setDeleteId(current.id)}
        onClose={() => setSelected(undefined)} onMove={(status, reason) => move(current, status, reason)}
        onSave={async (patch) => { try { await enq.update(current.id, patch); toast("Enquiry updated"); } catch { toast("Could not update the enquiry", "error"); } }} />}
    </Card>
  );
}

function EnquiryDetail({ row, onAdmit, onClose, onDelete, onMove, onSave }: {
  row: Enquiry; onAdmit: () => void; onClose: () => void; onDelete: () => void; onMove: (status: EnqStage, reason?: string) => Promise<boolean>; onSave: (patch: Partial<Enquiry>) => Promise<void>;
}) {
  const [notes, setNotes] = useState(row.note);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (status: EnqStage, close: boolean) => {
    if (busy) return;
    setBusy(true);
    try { if (await onMove(status, reason) && close) onClose(); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${row.name} · ${row.ref}`} subtitle={gradeLabel(row.grade)}
      footer={<>
        <Button className="mr-auto" variant="danger" disabled={busy} onClick={onDelete}><Trash2 size={16} />Delete enquiry</Button>
        {row.stage === "lost" ? <Button disabled={busy} onClick={() => run("new", false)}>Reopen enquiry</Button>
          : <Button onClick={onAdmit}>Make Admission</Button>}
      </>}>
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt>Student</dt><dd>{row.name}</dd>
          <dt>Gender</dt><dd>{row.gender || row.answers?.gender || "—"}</dd>
          <dt>Grade or course</dt><dd>{gradeLabel(row.grade)}</dd>
          <dt>Guardian</dt><dd>{row.guardian}</dd>
          <dt>Guardian phone</dt><dd>{row.phone}</dd>
          <dt>Parent email</dt><dd>{row.email || "—"}</dd>
          <dt>Date of birth</dt><dd>{row.dob ? fmtDate(row.dob) : "—"}</dd>
        </dl>
        {row.applicationId && <Link className="text-sm font-semibold text-secondary"
          href={`/admissions/applications?application=${encodeURIComponent(row.applicationId)}`}>View existing application</Link>}
        <Field label="Follow-up date"><Input type="date" value={row.followUp} onChange={(event) => { void onSave({ followUp: event.target.value }); }} /></Field>
        <Field label="Notes"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} onBlur={() => { if (notes !== row.note) void onSave({ note: notes }); }} /></Field>
        {!row.applicationId && row.stage !== "lost" && <div className="flex items-end gap-2">
          <Field label="Close as lost — reason" className="flex-1"><Input value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
          <Button variant="outline" disabled={busy} onClick={() => run("lost", true)}>Mark lost</Button>
        </div>}
      </div>
    </Modal>
  );
}

function DeleteEnquiryDialog({ row, onClose, onDelete }: {
  row: Enquiry; onClose: () => void; onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await onDelete(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not delete the enquiry."); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={() => { if (!busy) onClose(); }} title="Delete enquiry?" subtitle={`${row.name} · ${row.ref}`}
      footer={<>
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete enquiry"}</Button>
      </>}>
      <p className="text-sm text-on-surface-variant">This permanently removes the enquiry from Admissions. Any linked application or student record is kept.</p>
      {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    </Modal>
  );
}
