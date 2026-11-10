"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Card, CardHeader, DataTable, Field, Input, Modal, Select, useToast, type Column } from "@/components/ui";
import { fmtDate, inrFull } from "@/lib/format";
import { AdmissionForm } from "./AdmissionForm";
import { EnquirySlideOver } from "./EnquirySlideOver";
import { docsComplete, isEmail, statusTone, useAdm, useToday } from "./lib";
import { OFFERABLE } from "./logic";
import { APP_STATUS_LABEL, DOC_LABEL, gradeLabel, type AppStatus, type Application, type DocKey, type DocState, type Offer } from "./types";
import { studentProfileHref } from "@/features/people/studentLogic";

const stages: AppStatus[] = ["submitted", "docs_pending", "verified", "approved", "waitlisted", "rejected"];

export function Applications() {
  const admissions = useAdm();
  const { apps, offers, cohorts, config, ready } = admissions;
  const params = useSearchParams();
  const [detailId, setDetailId] = useState<string | null | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");
  const [cohort, setCohort] = useState("");
  const fee = config?.appFee ?? 0;
  const rows = apps.rows.filter((row) => (!status || row.status === status) && (!cohort || row.grade === cohort))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || b.ref.localeCompare(a.ref));
  const selected = detailId === undefined ? params.get("application") : detailId;
  const detail = apps.rows.find((row) => row.id === selected);
  const offer = detail ? offers.rows.find((row) => row.id === detail.offerId) ??
    offers.rows.find((row) => row.applicationId === detail.id && ["pending", "accepted", "enrolled"].includes(row.status)) : undefined;
  const columns: Column<Application>[] = [
    { key: "ref", header: "Application", sortValue: (row) => row.ref, render: (row) => <button type="button" onClick={() => setDetailId(row.id)} className="cursor-pointer font-semibold text-secondary">{row.ref}</button> },
    { key: "name", header: "Student", sortValue: (row) => row.name, render: (row) => <><span className="font-semibold">{row.name}</span><p className="text-xs text-outline">{row.guardian} · {row.phone}</p></> },
    { key: "grade", header: "Grade or course", render: (row) => gradeLabel(row.grade) },
    { key: "docs", header: "Documents", render: (row) => <Badge tone={docsComplete(row) ? "success" : "warning"}>{docsComplete(row) ? "Verified" : "Pending"}</Badge> },
    ...(fee > 0 || apps.rows.some((row) => row.feePaid) ? [{
      key: "fee", header: "Fee", render: (row: Application) => row.feePaid ? <Badge tone="success">Paid</Badge> : fee > 0 ? <Badge tone="warning">Unpaid</Badge> : "—",
    }] : []),
    { key: "status", header: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{APP_STATUS_LABEL[row.status]}</Badge> },
  ];

  return (
    <Card>
      <CardHeader title="Applications" actions={<Button onClick={() => setAdding(true)}><Plus size={16} />New application</Button>} />
      {ready ? <DataTable rows={rows} columns={columns} pageSize={10}
        searchText={(row) => `${row.ref} ${row.name} ${row.guardian} ${row.phone}`}
        toolbar={<>
          <Select aria-label="Application status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>
            {Object.entries(APP_STATUS_LABEL).filter(([value]) => !["test_scheduled", "tested", "shortlisted"].includes(value) || apps.rows.some((row) => row.status === value))
              .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Select aria-label="Grade or course" value={cohort} onChange={(e) => setCohort(e.target.value)}><option value="">All grades and courses</option>
            {cohorts.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </Select>
        </>} /> : <p className="p-5">Loading applications…</p>}
      <EnquirySlideOver open={adding} mode="application" onClose={() => setAdding(false)} onApplication={setDetailId} />
      {detail && <ApplicationDetail key={detail.id} application={detail} offer={offer} admissions={admissions} onClose={() => setDetailId(null)} />}
    </Card>
  );
}

function ApplicationDetail({ application, offer, admissions, onClose }: {
  application: Application; offer?: Offer; admissions: ReturnType<typeof useAdm>; onClose: () => void;
}) {
  const { apps, config, moveApplication, setDoc, generateOffer, acceptOffer, declineOffer, lapseOffer } = admissions;
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [email, setEmail] = useState(application.email ?? "");
  const [feeMode, setFeeMode] = useState(application.feeMode || "Cash");
  const fee = config?.appFee ?? 0;
  const today = useToday();
  const canOffer = OFFERABLE.includes(application.status) && docsComplete(application);
  const locked = ["offered", "enrolled", "withdrawn", "lapsed"].includes(application.status);
  const canEnrol = offer ? offer.status === "accepted" : application.status === "approved" && docsComplete(application);
  const studentId = application.status === "enrolled" ? application.studentId || offer?.studentId : undefined;
  const offerExpired = offer?.status === "pending" && !!offer.expiresAt && offer.expiresAt < today;
  const emailChanged = email.trim().toLowerCase() !== (application.email ?? "").trim().toLowerCase();

  async function run(action: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    try { await action(); toast(message); }
    catch (error) { toast(error instanceof Error ? error.message : "Could not save the application", "error"); }
    finally { setBusy(false); }
  }

  if (enrolling) return <AdmissionForm mode="enrol" application={application} offer={offer} onClose={() => setEnrolling(false)} />;

  return (
    <Modal open onClose={() => { if (!busy) onClose(); }} title={`${application.name} · ${application.ref}`} subtitle={gradeLabel(application.grade)} width="max-w-2xl">
      <div className="space-y-5">
        <p className="text-sm">{application.guardian} · {application.phone}{application.dob ? ` · Born ${fmtDate(application.dob)}` : ""}</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Parent email" className="flex-1"><Input type="email" value={email} disabled={busy || application.status === "enrolled"} onChange={(e) => setEmail(e.target.value)} /></Field>
          {emailChanged && <Button variant="outline" disabled={busy} onClick={() => run(async () => {
            const value = email.trim().toLowerCase();
            if (value && !isEmail(value)) throw new Error("Enter a valid parent email");
            await apps.update(application.id, { email: value });
          }, "Parent email saved")}>Save email</Button>}
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Document checklist</h3>
          <ul className="divide-y divide-outline-variant/40 rounded-lg border border-outline-variant/60">
            {(Object.entries(DOC_LABEL) as [DocKey, string][]).map(([key, label]) => (
              <li key={key} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm">{label}</span>
                <Select aria-label={label} value={application.docs?.[key] ?? "pending"} disabled={busy || locked} onChange={(e) => {
                  const state = e.target.value as DocState; void run(() => setDoc(application, key, state), "Document updated");
                }} className="w-36">
                  <option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="na">Not required</option>
                </Select>
              </li>
            ))}
          </ul>
        </div>
        <Field label="Move stage"><Select value={application.status} disabled={busy || locked} onChange={(e) => {
          const next = e.target.value as AppStatus;
          void run(() => moveApplication(application.id, next), `Moved to ${APP_STATUS_LABEL[next]}`);
        }}>
          {!stages.includes(application.status) && <option value={application.status}>{APP_STATUS_LABEL[application.status]}</option>}
          {stages.map((stage) => <option key={stage} value={stage}>{APP_STATUS_LABEL[stage]}</option>)}
        </Select></Field>
        {(fee > 0 || application.feePaid) && <section className="rounded-lg border border-outline-variant/60 p-3">
          <h3 className="mb-2 font-semibold">Application fee {fee > 0 ? inrFull(fee) : ""}</h3>
          {application.feePaid ? <Badge tone="success">Paid{application.feeMode ? ` via ${application.feeMode}` : ""}</Badge> :
            <div className="flex flex-wrap items-end gap-2"><Badge tone="warning">Unpaid</Badge><Field label="Payment method"><Select value={feeMode} onChange={(e) => setFeeMode(e.target.value)}>
              <option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Card</option><option>Cheque</option>
            </Select></Field><Button variant="outline" disabled={busy} onClick={() => run(() => apps.update(application.id, { feePaid: true, feeMode }), "Fee marked as paid")}>Record payment</Button></div>}
        </section>}
        <section className="space-y-3 rounded-lg bg-surface-container-low p-3">
          <h3 className="font-semibold">Offer and enrolment</h3>
          {offer && <p className="text-sm">{offer.ref} · {offer.status === "pending" ? offerExpired ? "Expired" : `Awaiting acceptance · expires ${fmtDate(offer.expiresAt)}` : offer.status === "accepted" ? "Accepted · seat reserved" : offer.status === "enrolled" ? "Enrolled" : offer.status}</p>}
          <div className="flex flex-wrap gap-2">
            {!offer && canOffer && <Button disabled={busy} onClick={() => run(() => generateOffer(application), "Offer issued and seat reserved")}>Generate offer</Button>}
            {offer?.status === "pending" && !offerExpired && <Button disabled={busy} onClick={() => run(() => acceptOffer(offer, { recordToken: false }), "Offer accepted")}>Record acceptance</Button>}
            {offer?.status === "pending" && offerExpired && <Button disabled={busy} onClick={() => run(() => lapseOffer(offer), "Offer expired and seat released")}>Release expired offer</Button>}
            {(offer?.status === "pending" && !offerExpired || offer?.status === "accepted") && <Button variant="outline" disabled={busy} onClick={() => run(() => declineOffer(offer), "Offer declined and seat released")}>Record decline</Button>}
            {canEnrol && <Button disabled={busy || emailChanged} onClick={() => setEnrolling(true)}>Enrol student</Button>}
            {studentId && <Link href={studentProfileHref(studentId)} className="font-semibold text-secondary">Open student profile</Link>}
          </div>
          {!offer && !canOffer && !studentId && <p className="text-sm text-on-surface-variant">Verify the application before issuing an offer.</p>}
          {canEnrol && emailChanged && <p className="text-sm text-on-surface-variant">Save the updated parent email before enrolling.</p>}
        </section>
      </div>
    </Modal>
  );
}
