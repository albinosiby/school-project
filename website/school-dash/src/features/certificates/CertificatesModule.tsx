"use client";
import { useMemo, useState } from "react";
import { Award, Clock3, FileCheck2, FileText, Plus, ShieldX } from "lucide-react";
import { Avatar, Badge, Button, Card, DataTable, EmptyState, LoadingSkeleton, PageHeader, Select, Stat, Tabs, type Column } from "@/components/ui";
import { currentSchoolId, useCollection } from "@/lib/useCollection";
import { useAuth } from "@/lib/authContext";
import { fmtDate } from "@/lib/format";
import { catalog, defaultTemplate, recipientKind, recipientName, statusTone } from "./catalog";
import { CertificateEditor } from "./CertificateEditor";
import { CertificateDetails } from "./CertificateDetails";
import { TemplateEditor } from "./TemplateEditor";
import { CertificateVerification } from "./CertificateVerification";
import type { Certificate, CertificateTemplate, RecipientKind } from "./types";

export function CertificatesModule() {
  const { user } = useAuth(), certificates = useCollection<Certificate>("certificates"), templates = useCollection<CertificateTemplate>("certificate_templates");
  const [tab, setTab] = useState("dashboard"), [kind, setKind] = useState("all"), [type, setType] = useState("");
  const [requestStatus, setRequestStatus] = useState("Requested");
  const [editing, setEditing] = useState<{ kind: RecipientKind; target?: Certificate; replaces?: Certificate } | null>(null), [detailsId, setDetailsId] = useState(""), [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const manageable = user?.role === "admin" || user?.role === "owner";
  const effectiveTemplates = useMemo(() => catalog.map((entry) => templates.rows.find((t) => t.type === entry.id) || defaultTemplate(entry.id)), [templates.rows]);
  const rows = useMemo(() => certificates.rows.filter((c) => (kind === "all" || recipientKind(c) === kind) && (!type || c.type === type)).sort((a, b) => (b.issuedOn || b.requestedAt || "").localeCompare(a.issuedOn || a.requestedAt || "")), [certificates.rows, kind, type]);
  const count = (statuses: string[]) => rows.filter((c) => statuses.includes(c.status)).length;
  const details = certificates.rows.find((c) => c.id === detailsId);
  const tableRows = tab === "requests" ? rows.filter((c) => ["Requested", "Rejected"].includes(c.status) && (requestStatus === "all" || c.status === requestStatus)) : tab === "drafts" ? rows.filter((c) => ["Draft", "Preparing"].includes(c.status)) : tab === "issued" ? rows.filter((c) => ["Issued", "Revoked"].includes(c.status)) : rows.filter((c) => c.status === "Issued").slice(0, 6);
  const columns: Column<Certificate>[] = [
    { key: "recipient", header: "Recipient", sortValue: recipientName, render: (c) => <div className="flex min-w-44 items-center gap-3"><Avatar name={recipientName(c)} /><div><button type="button" className="text-left font-semibold text-secondary hover:underline" onClick={() => setDetailsId(c.id)}>{recipientName(c)}</button><p className="mt-0.5 text-xs text-on-surface-variant">{recipientKind(c) === "staff" ? `Staff · ${c.recipientSnapshot?.employeeId || ""}` : `${c.grn || "Student"} · ${c.recipientSnapshot?.class || c.classId || ""}`}</p></div></div> },
    { key: "certificate", header: "Certificate", sortValue: (c) => c.title, render: (c) => <div className="min-w-40"><p className="font-medium">{c.title}</p><p className="mt-1 text-xs text-on-surface-variant">{c.purpose || "School office"}</p></div> },
    { key: "reference", header: "Certificate number", render: (c) => <span className="whitespace-nowrap font-mono text-xs">{c.refNo || "Assigned on issue"}</span> },
    { key: "date", header: "Date", sortValue: (c) => c.issuedOn || c.requestedAt || "", render: (c) => <span className="whitespace-nowrap text-sm">{c.issuedOn ? fmtDate(c.issuedOn) : c.requestedAt ? fmtDate(c.requestedAt) : "—"}</span> },
    { key: "status", header: "Status", render: (c) => <Badge tone={statusTone(c.status)}>{c.status}</Badge> },
    { key: "action", header: "", render: (c) => <Button variant="ghost" size="sm" onClick={() => setDetailsId(c.id)}>View details</Button> },
  ];
  return <div><PageHeader title="Certificates" subtitle="Issue and manage student and staff certificates, requests and verification." actions={manageable && <Button disabled={!templates.ready || !!templates.error} onClick={() => setEditing({ kind: kind === "staff" ? "staff" : "student" })}><Plus size={16} />Issue certificate</Button>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Total issued" value={certificates.ready ? count(["Issued", "Revoked"]) : <LoadingSkeleton variant="inline" />} icon={<FileCheck2 size={18} />} /><Stat label="Pending requests" value={certificates.ready ? count(["Requested"]) : <LoadingSkeleton variant="inline" />} icon={<Clock3 size={18} />} /><Stat label="Drafts & preparing" value={certificates.ready ? count(["Draft", "Preparing"]) : <LoadingSkeleton variant="inline" />} icon={<FileText size={18} />} /><Stat label="Revoked" value={certificates.ready ? count(["Revoked"]) : <LoadingSkeleton variant="inline" />} icon={<ShieldX size={18} />} /></div>
    <div className="mb-4 flex flex-wrap items-center gap-3"><Tabs value={kind} onChange={(v) => { setKind(v); setType(""); }} items={[{ id: "all", label: "All recipients" }, { id: "student", label: "Students" }, { id: "staff", label: "Staff" }]} /></div>
    <Tabs value={tab} onChange={(value) => { setTab(value); setType(""); }} items={[{ id: "dashboard", label: "Overview" }, { id: "requests", label: "Requests", count: count(["Requested", "Rejected"]) }, { id: "issued", label: "Issued", count: count(["Issued", "Revoked"]) }, { id: "drafts", label: "Drafts", count: count(["Draft", "Preparing"]) }, { id: "templates", label: "Templates" }, { id: "verify", label: "Verification" }]} />
    <div className="mt-5">{tab === "verify" ? <CertificateVerification schoolId={currentSchoolId() || ""} /> : tab === "templates" ? <>
      {templates.error ? <Card className="p-5"><p role="alert">Could not load certificate templates.</p><Button variant="outline" onClick={templates.reload}>Retry</Button></Card> : !templates.ready ? <LoadingSkeleton variant="card" label="Loading templates…" /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{catalog.filter((c) => !c.legacy && (kind === "all" || c.kind === kind)).map((entry) => { const item = effectiveTemplates.find((t) => t.type === entry.id)!; return <Card key={entry.id} className="overflow-hidden"><div className="h-1" style={{ backgroundColor: item.accent }} /><div className="p-5"><div className="flex items-center justify-between"><Award size={23} className="text-secondary" /><Badge>{entry.kind === "staff" ? "Staff" : "Student"}</Badge></div><h2 className="mt-4 font-semibold">{item.title}</h2><p className="mt-2 min-h-10 text-sm text-on-surface-variant">{entry.description}</p><div className="mt-4 flex items-center justify-between gap-2"><span className="text-xs text-on-surface-variant">{item.version ? `Version ${item.version}` : "Default template"}</span>{manageable && <Button variant="outline" size="sm" onClick={() => setTemplate(item)}>Edit template</Button>}</div></div></Card>; })}</div>}
    </> : <>
      {tab === "dashboard" && <Card className="mb-4 flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="font-semibold">Certificate workspace</h2><p className="mt-1 text-sm text-on-surface-variant">Twelve templates for student records and staff service, with a saved PDF and verification QR.</p></div>{count(["Requested"]) > 0 && <Button variant="outline" onClick={() => setTab("requests")}>Review {count(["Requested"])} requests</Button>}</Card>}
      <Card className="pt-5"><div className="mb-4 px-5"><h2 className="font-semibold">{tab === "dashboard" ? "Recent certificates" : tab === "requests" ? "Certificate requests" : tab === "drafts" ? "Drafts and unfinished issues" : "Issued certificates"}</h2><p className="mt-1 text-sm text-on-surface-variant">{tab === "drafts" ? "Resume unfinished issues using the reserved certificate number." : tab === "issued" ? "Open a record to download, print, review history or revoke." : "Select a record to review its details."}</p></div>
        {certificates.error ? <div className="p-5"><p role="alert">Could not load certificates.</p><Button variant="outline" className="mt-3" onClick={certificates.reload}>Retry</Button></div> : !certificates.ready ? <LoadingSkeleton variant="table" label="Loading certificates…" /> : <DataTable rows={tableRows} columns={columns} pageSize={10} resetKey={`${tab}:${kind}:${type}`} searchText={tab === "dashboard" ? undefined : (c) => [recipientName(c), c.grn, c.recipientSnapshot?.employeeId, c.refNo, c.title, c.purpose].join(" ")}
          toolbar={tab === "dashboard" ? undefined : <><Select aria-label="Filter certificate type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All certificate types</option>{catalog.filter((c) => kind === "all" || c.kind === kind).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>{tab === "requests" && <Select aria-label="Filter request status" value={requestStatus} onChange={(event) => setRequestStatus(event.target.value)}><option value="Requested">Pending requests</option><option value="Rejected">Rejected / cancelled</option><option value="all">All requests</option></Select>}</>}
          empty={<EmptyState title={tab === "requests" ? "No certificate requests" : "No certificates here"} hint={tab === "requests" ? "Parent requests appear here for the school office to review." : "Issue a certificate or adjust your filters."} />} />}
      </Card>
    </>}</div>
    {templates.error && tab !== "templates" && <p role="alert" className="mt-4 text-sm text-error">Templates could not be loaded. <Button variant="ghost" size="sm" onClick={templates.reload}>Retry</Button></p>}
    {editing && <CertificateEditor key={`${editing.kind}:${editing.target?.id || editing.replaces?.id || "new"}`} {...editing} templates={effectiveTemplates} onKind={(newKind) => setEditing({ kind: newKind })} onClose={() => setEditing(null)} />}
    {details && !editing && <CertificateDetails key={details.id} cert={details} onClose={() => setDetailsId("")} onPrepare={() => { setDetailsId(""); setEditing({ kind: recipientKind(details), target: details }); }} onReplace={() => { setDetailsId(""); setEditing({ kind: recipientKind(details), replaces: details }); }} />}
    {template && <TemplateEditor key={template.type} original={template} onClose={() => setTemplate(null)} />}
  </div>;
}
