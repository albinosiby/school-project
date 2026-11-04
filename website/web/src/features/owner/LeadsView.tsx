"use client";
import Link from "next/link";
import { useState } from "react";
import { Building2, Mail, Phone, Trash2 } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, Field, Modal, PageHeader, Select, SlideOver, Tabs, Textarea, useToast, type Column } from "@/components/ui";
import { deleteLead, ownerError, updateLead } from "./api";
import { useLeads } from "./data";
import { fmtDate, leadStatus, LEAD_STATUSES, type Lead, type LeadStatus } from "./logic";

/** Demo requests sent from the landing page's "Book a demo" form (leads/{id}), worked through a small pipeline. */
export function LeadsView() {
  const toast = useToast();
  const { rows, ready, error } = useLeads();
  const [tab, setTab] = useState<"open" | LeadStatus | "all">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((l) => l.id === openId) ?? null;
  const view = rows.filter((l) => tab === "all" || (tab === "open" ? l.status !== "converted" && l.status !== "closed" : l.status === tab));

  const move = async (l: Lead, status: LeadStatus) => {
    try { await updateLead(l.id, { status, notes: l.notes ?? "", schoolId: l.schoolId ?? "" }); toast(`${l.school}: ${leadStatus(status).label}`); }
    catch (e) { toast(ownerError(e), "error"); }
  };

  const cols: Column<Lead>[] = [
    { key: "school", header: "School", sortValue: (l) => l.school.toLowerCase(), render: (l) => <div><p className="font-semibold">{l.school}</p><p className="text-xs text-on-surface-variant">{l.name}</p></div> },
    { key: "contact", header: "Contact", render: (l) => <div><p>{l.email}</p><p className="text-xs text-on-surface-variant">{l.phone || "—"}</p></div> },
    { key: "message", header: "Message", className: "max-w-xs", render: (l) => <p className="line-clamp-2 text-sm text-on-surface-variant">{l.message || "—"}</p> },
    { key: "date", header: "Received", sortValue: (l) => l.createdAt?.getTime() ?? 0, render: (l) => fmtDate(l.createdAt) },
    { key: "status", header: "Status", sortValue: (l) => LEAD_STATUSES.findIndex((s) => s.value === l.status), render: (l) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Select aria-label={`Status of ${l.school}`} value={l.status} onChange={(e) => move(l, e.target.value as LeadStatus)} className="h-8 w-36 text-xs">
          {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
      </div>) },
  ];

  return (
    <div>
      <PageHeader title="Demo requests" subtitle="Requests from the website's Book a demo form. Turn one into a school when it signs up." />
      {error && <Card className="mb-6 border-error/40 p-4 text-sm text-error">Could not load the requests: {error}</Card>}
      <Card className="pt-4">
        <Tabs className="px-5 pb-3" value={tab} onChange={(t) => setTab(t as typeof tab)} items={[
          { id: "open", label: "Open", count: rows.filter((l) => l.status !== "converted" && l.status !== "closed").length },
          ...LEAD_STATUSES.map((s) => ({ id: s.value, label: s.label, count: rows.filter((l) => l.status === s.value).length })),
          { id: "all", label: "All", count: rows.length },
        ]} />
        {!ready ? <p className="p-6 text-on-surface-variant">Loading requests…</p> : (
          <DataTable rows={view} columns={cols} pageSize={15} onRowClick={(l) => setOpenId(l.id)} searchText={(l) => `${l.school} ${l.name} ${l.email} ${l.phone} ${l.message}`}
            empty={<EmptyState title="No requests here" hint="New requests from the website appear here as they arrive." />} />
        )}
      </Card>
      {open && <LeadPanel key={open.id} lead={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function LeadPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await updateLead(lead.id, { status, notes: notes.trim(), schoolId: lead.schoolId ?? "" }); toast("Saved"); onClose(); }
    catch (e) { toast(ownerError(e), "error"); } finally { setSaving(false); }
  };
  const st = leadStatus(lead.status);
  return (
    <SlideOver open onClose={onClose} title={lead.school} subtitle={`Received ${fmtDate(lead.createdAt)}`}
      footer={<><Button variant="ghost" className="mr-auto text-error" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Delete</Button><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></>}>
      <div className="space-y-5">
        <div className="flex items-center gap-2"><Badge tone={st.tone}>{st.label}</Badge>{lead.source && <span className="text-xs text-outline">from the {lead.source} page</span>}</div>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-on-surface-variant">Contact person</dt><dd className="font-medium">{lead.name}</dd></div>
          <div className="flex items-center gap-2"><Mail size={14} className="text-outline" /><a className="text-secondary hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a></div>
          {lead.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-outline" /><a className="text-secondary hover:underline" href={`tel:${lead.phone.replace(/\s/g, "")}`}>{lead.phone}</a></div>}
        </dl>
        <div><p className="mb-1 text-xs font-semibold text-on-surface-variant">Message</p><p className="whitespace-pre-wrap rounded-lg bg-surface-container-low p-3 text-sm">{lead.message || "No message."}</p></div>
        <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>{LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>
        <Field label="Notes" hint="Only product owners see these."><Textarea maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Called on Monday, demo on Friday 11:00" /></Field>
        {lead.schoolId
          ? <Link href={`/owner/schools/${lead.schoolId}`} onClick={onClose}><Button variant="outline" className="w-full"><Building2 size={16} />Open the school made from this request</Button></Link>
          : <Link href={`/owner/schools/new?lead=${lead.id}`} onClick={onClose}><Button className="w-full"><Building2 size={16} />Create school from this request</Button></Link>}
      </div>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this request?" subtitle={lead.school}
        footer={<><Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" onClick={async () => {
          try { await deleteLead(lead.id); toast("Request deleted"); onClose(); } catch (e) { toast(ownerError(e), "error"); }
        }}>Delete</Button></>}>
        <p className="text-on-surface-variant">Use this for spam. Close the request instead if you want to keep a record of it.</p>
      </Modal>
    </SlideOver>
  );
}
