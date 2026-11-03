"use client";
import { useState } from "react";
import { FileText, Plus, Printer, Upload } from "lucide-react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Avatar, Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, Select, Tabs, Textarea, useToast, type Column } from "@/components/ui";
import { ReasonModal } from "@/features/dashboard/approvals-shared";
import { storage } from "@/lib/firebase";
import { fmtDate } from "@/lib/format";
import { useMyName } from "@/lib/useMe";
import { currentSchoolId, useCollection } from "@/lib/useCollection";
import { classIdOf } from "@/features/ops/shared";
import { certFileError, issueError, nextCertRef, type IssueForm } from "./studentLogic";

/** certificates (data contract 13.7): requested by parents in the parent app or issued directly by the office. */
export type Cert = { id: string; studentId: string; classId: string; studentName: string; grn?: string; type: string; title: string; category?: string; purpose?: string;
  status: "Requested" | "Issued" | "Rejected" | string; requestedBy?: string; requestedAt?: string; parentUid?: string; refNo?: string; issuedOn?: string; validTill?: string;
  issuer?: string; note?: string; fileUrl?: string; filePath?: string; fileName?: string; rejectReason?: string; downloadedAt?: string };
type Stu = { id: string; name: string; grn: string; grade: string; section: string; classId?: string };

export const CERT_TYPES = [
  { id: "bonafide", title: "Bonafide Certificate" },
  { id: "character", title: "Character Certificate" },
  { id: "transfer", title: "Transfer Certificate" },
  { id: "feeReceipt", title: "Annual Fee Certificate" },
  { id: "other", title: "Other Certificate" },
] as const;
const tone = { Requested: "warning", Issued: "success", Rejected: "danger" } as const;
const cls = (id?: string) => (id ?? "").replace(/^cls_(\d+)(\w)$/, "$1-$2");
const today = () => new Date().toLocaleDateString("en-CA");

export function CertificatesPanel({ students }: { students: Stu[] }) {
  const toast = useToast();
  const { rows, ready, create, update } = useCollection<Cert>("certificates");
  const [tab, setTab] = useState("Requested");
  const [issuing, setIssuing] = useState<Cert | "new" | null>(null);
  const [rejecting, setRejecting] = useState<Cert | null>(null);
  const n = (st: string) => rows.filter((c) => c.status === st).length;
  const view = rows.filter((c) => tab === "all" || c.status === tab)
    .sort((a, b) => (b.issuedOn ?? b.requestedAt ?? "").localeCompare(a.issuedOn ?? a.requestedAt ?? ""));
  const nextRef = () => nextCertRef(rows.map((c) => c.refNo), new Date().getFullYear());

  const cols: Column<Cert>[] = [
    { key: "student", header: "Student", sortValue: (c) => c.studentName, render: (c) => <div className="flex items-center gap-3"><Avatar name={c.studentName || "?"} />
      <div><div className="font-semibold">{c.studentName}</div><div className="t-caption text-outline">{cls(c.classId)} · <span className="font-mono">{c.grn}</span></div></div></div> },
    { key: "title", header: "Certificate", sortValue: (c) => c.title, render: (c) => <div><div className="font-medium">{c.title}</div>
      <div className="t-caption text-outline">{c.purpose ? `For ${c.purpose}` : "—"}{c.requestedBy ? ` · asked by ${c.requestedBy}` : ""}</div></div> },
    { key: "date", header: "Date", sortValue: (c) => c.issuedOn ?? c.requestedAt ?? "", render: (c) => <div>{c.issuedOn ? fmtDate(c.issuedOn) : c.requestedAt ? fmtDate(c.requestedAt) : "—"}
      <div className="t-caption text-outline">{c.status === "Issued" ? "issued" : "requested"}</div></div> },
    { key: "status", header: "Status", sortValue: (c) => c.status, render: (c) => <div><Badge tone={tone[c.status as keyof typeof tone] ?? "neutral"}>{c.status}</Badge>
      {c.refNo && <div className="t-caption mt-0.5 font-mono text-outline">{c.refNo}</div>}
      {c.rejectReason && <div className="t-caption mt-0.5 text-outline">{c.rejectReason}</div>}
      {c.status === "Issued" && <div className="t-caption text-outline">{c.fileUrl ? <a className="text-secondary hover:underline" href={c.fileUrl} target="_blank" rel="noreferrer">Signed file</a> : "No file · collect at office"}</div>}
      {c.downloadedAt && <div className="t-caption text-outline">Opened by parent</div>}</div> },
    { key: "act", header: "", className: "text-right", render: (c) => <div className="flex justify-end gap-2">
      {c.status === "Requested" && <><Button size="sm" variant="outline" onClick={() => setIssuing(c)}>Issue</Button>
        <Button size="sm" variant="ghost" className="!text-error" onClick={() => setRejecting(c)}>Reject</Button></>}
      {c.status === "Issued" && <><a className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-sm text-on-surface-variant hover:bg-surface-container" href={`/certificate?id=${c.id}`} target="_blank" rel="noreferrer"><Printer size={14} />Print</a>
        <Button size="sm" variant="ghost" onClick={() => setIssuing(c)}>Edit</Button></>}</div> },
  ];

  return (
    <Card className="pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
        <Tabs value={tab} onChange={setTab} items={[{ id: "Requested", label: "Requested", count: n("Requested") }, { id: "Issued", label: "Issued", count: n("Issued") }, { id: "Rejected", label: "Rejected", count: n("Rejected") }, { id: "all", label: "All", count: rows.length }]} />
        <Button className="ml-auto" onClick={() => setIssuing("new")}><Plus size={16} />Issue certificate</Button>
      </div>
      <p className="t-caption mb-3 px-5 text-outline">Parents request certificates in the parent app and are notified when one is issued. Print the certificate, sign it, and upload the signed copy so parents can download it in the app.</p>
      {!ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading certificates…</p>
        : <DataTable rows={view} columns={cols} pageSize={10} empty={<EmptyState title="No certificates here" hint="Requests sent from the parent app show up under Requested." />} />}
      <IssueModal key={issuing === "new" ? "new" : issuing?.id ?? "none"} target={issuing} students={students} certs={rows} nextRef={nextRef} onClose={() => setIssuing(null)}
        onSave={async (id, data, file) => {
          // new certificates get their id first so the file can be stored under it
          const certId = id ?? `cer_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
          const upload = file ? await uploadCertificate(certId, file) : {};
          if (id) await update(id, { ...data, ...upload }); else await create({ ...data, ...upload, id: certId } as Cert);
          toast(file ? "Certificate issued with the signed file" : "Certificate issued");
        }} />
      <ReasonModal ids={rejecting ? [rejecting.id] : null} title="Reject certificate request" label="Note to the parent" onClose={() => setRejecting(null)}
        onSubmit={async (_ids, reason) => { if (rejecting) { await update(rejecting.id, { status: "Rejected", rejectReason: reason }); toast("Request rejected"); } }} />
    </Card>
  );
}

/** Uploads the signed certificate to schools/{sid}/certificates/{id}/ (storage.rules) and returns the fields for the doc. */
async function uploadCertificate(certId: string, file: File) {
  const sid = currentSchoolId();
  if (!sid) throw new Error("Not signed in");
  const name = file.name.replace(/[^\w.-]+/g, "_").slice(-80) || "certificate.pdf";
  const path = `schools/${sid}/certificates/${certId}/${name}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type, customMetadata: { certificateId: certId } });
  return { fileUrl: await getDownloadURL(r), filePath: path, fileName: file.name };
}

function IssueModal({ target, students, certs, nextRef, onClose, onSave }: {
  target: Cert | "new" | null; students: Stu[]; certs: Cert[]; nextRef: () => string; onClose: () => void; onSave: (id: string | null, data: Partial<Cert>, file: File | null) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const me = useMyName();
  const existing = target && target !== "new" ? target : null;
  const [f, setF] = useState<IssueForm | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const form: IssueForm = f ?? {
    studentId: existing?.studentId ?? "", type: existing?.type ?? "bonafide", purpose: existing?.purpose ?? "",
    refNo: existing?.refNo || nextRef(), issuedOn: existing?.issuedOn ?? today(), validTill: existing?.validTill ?? "",
    issuer: existing?.issuer ?? `${me.name}${me.title ? `, ${me.title}` : ""}`, note: existing?.note ?? "",
  };
  const set = (k: keyof IssueForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setF({ ...form, [k]: e.target.value }); setErr(""); };
  const close = () => { setF(null); setFile(null); setErr(""); onClose(); };
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files?.[0] ?? null;
    e.target.value = "";
    const bad = fl ? certFileError(fl) : "";
    if (bad) return setErr(bad);
    setFile(fl); setErr("");
  };

  async function submit() {
    const s = students.find((x) => x.id === form.studentId);
    const bad = issueError(form, { isNew: !existing, studentOk: !!s, certId: existing?.id, certs });
    if (bad) return setErr(bad);
    const type = CERT_TYPES.find((t) => t.id === form.type) ?? CERT_TYPES[0];
    const issue = { status: "Issued", refNo: form.refNo.trim(), issuedOn: form.issuedOn, validTill: form.validTill, issuer: form.issuer.trim(), note: form.note.trim() };
    setBusy(true);
    try {
      if (existing) await onSave(existing.id, issue, file);
      else await onSave(null, { ...issue, studentId: s!.id, classId: s!.classId || classIdOf(s!.grade, s!.section), studentName: s!.name, grn: s!.grn, type: type.id, title: type.title,
        category: "bonafide", purpose: form.purpose.trim(), requestedBy: "School office", requestedAt: new Date().toISOString() }, file);
      close();
    } catch (e) { setErr(/storage|upload/i.test(String(e)) ? "Could not upload the file. Check the file and try again." : "Could not save the certificate."); } finally { setBusy(false); }
  }

  return (
    <Modal open={!!target} onClose={close} title={existing ? `Issue ${existing.title}` : "Issue certificate"} subtitle={existing ? `${existing.studentName}${existing.purpose ? ` · for ${existing.purpose}` : ""}` : "Issued certificates show in the parent app."}
      footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={busy} onClick={submit}>{busy ? "Saving…" : existing?.status === "Issued" ? "Save" : "Issue"}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {!existing && <>
          <Field label="Student" required className="sm:col-span-2"><Select value={form.studentId} onChange={set("studentId")}><option value="">Choose a student</option>
            {[...students].sort((a, b) => a.name.localeCompare(b.name)).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}-{s.section} · {s.grn}</option>)}</Select></Field>
          <Field label="Certificate"><Select value={form.type} onChange={set("type")}>{CERT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select></Field>
          <Field label="Purpose"><Input value={form.purpose} onChange={set("purpose")} placeholder="e.g. Passport application" /></Field>
        </>}
        <Field label="Reference number" required><Input value={form.refNo} onChange={set("refNo")} className="font-mono" /></Field>
        <Field label="Issue date" required><Input type="date" value={form.issuedOn} onChange={set("issuedOn")} /></Field>
        <Field label="Valid till"><Input type="date" value={form.validTill} onChange={set("validTill")} /></Field>
        <Field label="Signed by" required><Input value={form.issuer} onChange={set("issuer")} /></Field>
        <Field label="Signed certificate" hint="PDF, PNG or JPG up to 10 MB. Parents download it in the app; without a file they are told to collect it from the office." className="sm:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm font-medium hover:bg-surface-container-low">
              <Upload size={16} />{file || existing?.fileName ? "Replace file" : "Upload file"}
              <input type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" onChange={pick} />
            </label>
            {(file || existing?.fileName) && <span className="flex min-w-0 items-center gap-1 text-sm text-on-surface-variant"><FileText size={14} />
              <span className="truncate">{file ? `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)` : existing?.fileName}</span></span>}
          </div>
        </Field>
        <Field label="Note to the parent" className="sm:col-span-2"><Textarea value={form.note} onChange={set("note")} className="min-h-16" /></Field>
      </div>
      {err && <p className="mt-3 text-sm text-error" role="alert">{err}</p>}
    </Modal>
  );
}
