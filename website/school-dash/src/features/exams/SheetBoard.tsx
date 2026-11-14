"use client";
// Sheet board (contract section 3, Marks Entry tab): one row per exm_sheets document of the cycle with the owner,
// status, server-maintained summary and the admin actions of its status. Every mutation is a manageExamination call.
import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Field, Modal, Select, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { examAction } from "./examService";
import type { Cycle } from "./types";
import {
  noteError, sheetActionLabel, sheetActions, sheetCounts, sheetStatusLabel, sheetTone, type Sheet, type SheetAction, type SheetStatus,
} from "./sheets";

export type StaffRow = { id: string; name: string; status?: string };

const fmtAt = (iso?: string) => (iso ? iso.slice(0, 16).replace("T", " ") : "—");
const done: Record<SheetAction, (s: Sheet) => string> = {
  sheetSubmit: (s) => `${s.subject} · ${s.classLabel} submitted`,
  sheetApprove: (s) => `${s.subject} · ${s.classLabel} approved; owner notified`,
  sheetReturn: (s) => `${s.subject} · ${s.classLabel} returned to ${s.ownerName || "the owner"}`,
  sheetReopen: (s) => `${s.subject} · ${s.classLabel} reopened for correction`,
};

/** The admin buttons of one sheet (Submit on behalf / Approve / Return… / Reopen…) with the note and reason modals. */
export function SheetActions({ sheet, size = "sm" }: { sheet: Sheet; size?: "sm" | "md" }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"sheetReturn" | "sheetReopen" | null>(null);
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const close = () => { setModal(null); setText(""); setTouched(false); };
  const run = async (action: SheetAction, payload: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      await examAction(sheet.cycleId, action, { sheetId: sheet.id, ...payload });
      close();
      toast(done[action](sheet));
    } catch (e) { toast(e instanceof Error ? e.message : "Could not update the sheet", "error"); } finally { setBusy(false); }
  };
  const error = noteError(text);
  const isReturn = modal === "sheetReturn";
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {sheetActions(sheet.status).map((action) => (
          <Button key={action} size={size} variant={action === "sheetApprove" ? "primary" : "outline"} disabled={busy}
            onClick={() => (action === "sheetReturn" || action === "sheetReopen" ? setModal(action) : run(action))}>
            {sheetActionLabel[action]}
          </Button>
        ))}
      </div>
      <Modal open={modal !== null} onClose={close}
        title={isReturn ? "Return sheet to the owner" : "Reopen approved sheet"}
        subtitle={isReturn
          ? `${sheet.subject} · ${sheet.classLabel} goes back to ${sheet.ownerName || "the owner"} for correction; they are notified with your note.`
          : `${sheet.subject} · ${sheet.classLabel} becomes editable again (version ${sheet.version + 1}). Subject results of this division are withdrawn and any compiled class result is marked stale.`}
        footer={<>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button disabled={busy || !!error} onClick={() => run(modal!, isReturn ? { note: text.trim() } : { reason: text.trim() })}>
            {isReturn ? "Return sheet" : "Reopen sheet"}
          </Button>
        </>}>
        <Field label={isReturn ? "Note to the owner" : "Reason"} required error={touched ? error : ""} hint="5 to 2000 characters">
          <Textarea value={text} maxLength={2000} onChange={(e) => { setText(e.target.value); setTouched(true); }} />
        </Field>
      </Modal>
    </>
  );
}

function OwnerSelect({ sheet, staff }: { sheet: Sheet; staff: StaffRow[] }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const known = staff.some((s) => s.id === sheet.ownerId);
  const assign = async (ownerId: string) => {
    if (ownerId === sheet.ownerId) return;
    setBusy(true);
    try {
      await examAction(sheet.cycleId, "sheetAssign", { sheetId: sheet.id, ownerId });
      toast(`${sheet.subject} · ${sheet.classLabel} assigned to ${staff.find((s) => s.id === ownerId)?.name || "Unassigned"}`);
    } catch (e) { toast(e instanceof Error ? e.message : "Could not reassign the sheet", "error"); } finally { setBusy(false); }
  };
  return (
    <Select aria-label={`Owner of ${sheet.subject} · ${sheet.classLabel}`} value={sheet.ownerId} disabled={busy || sheet.status === "Locked"}
      onChange={(e) => assign(e.target.value)} className="!h-9 min-w-40">
      <option value="">Unassigned</option>
      {!known && sheet.ownerId && <option value={sheet.ownerId}>{sheet.ownerName || sheet.ownerId}</option>}
      {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </Select>
  );
}

/** Button that creates the cycle's sheets (manageExamination action openEntry; idempotent on the server). */
export function OpenEntryButton({ cycle, size = "md", variant = "primary" }: { cycle: Cycle; size?: "sm" | "md"; variant?: "primary" | "outline" }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      await examAction(cycle.id, "openEntry");
      toast(`Marks entry opened for ${cycle.title}; sheets created for every paper and division`);
    } catch (e) { toast(e instanceof Error ? e.message : "Could not open marks entry", "error"); } finally { setBusy(false); }
  };
  return <Button size={size} variant={variant} onClick={open} disabled={busy}><ClipboardList size={16} />Open marks entry</Button>;
}

export function SheetBoard({ cycle, onSelect, selectedId }: { cycle: Cycle; onSelect?: (sheet: Sheet) => void; selectedId?: string }) {
  const sheets = useCollection<Sheet>("exm_sheets", true, [["cycleId", "==", cycle.id]]).rows.filter((s) => s.cycleId === cycle.id);
  const staff = useCollection<StaffRow>("staff").rows.filter((s) => s.status !== "Inactive" && s.status !== "Left");
  const counts = sheetCounts(sheets);
  const rows = [...sheets].sort((a, b) => a.classLabel.localeCompare(b.classLabel, "en", { numeric: true }) || a.subject.localeCompare(b.subject));
  return (
    <Card className="mt-5">
      <CardHeader
        title="Mark sheets"
        subtitle={sheets.length
          ? "One sheet per subject paper and division. Teachers submit from the app; approve, return or reopen them here."
          : "Marks entry has not been opened. Opening it creates one sheet per subject paper and division and assigns each to its subject teacher."}
        actions={sheets.length
          ? <div className="flex flex-wrap gap-1">
              {(["NotStarted", "InProgress", "Returned", "Submitted", "Approved", "Locked"] as SheetStatus[]).filter((s) => counts[s] > 0).map((s) => (
                <Badge key={s} tone={sheetTone(s)}>{counts[s]} {sheetStatusLabel[s].toLowerCase()}</Badge>
              ))}
            </div>
          : <OpenEntryButton cycle={cycle} />}
      />
      <DataTable
        rows={rows}
        pageSize={12}
        searchText={(s) => `${s.subject} ${s.classLabel} ${s.ownerName}`}
        onRowClick={onSelect}
        columns={[
          { key: "paper", header: "Subject · division", sortValue: (s) => `${s.classLabel} ${s.subject}`, render: (s) => (
            <span className={s.id === selectedId ? "font-semibold text-secondary" : "font-semibold"}>
              {s.subject} · {s.classLabel}
              {s.version > 1 && <span className="ml-1 text-xs font-normal text-outline">v{s.version}</span>}
            </span>) },
          { key: "owner", header: "Owner", render: (s) => <span onClick={(e) => e.stopPropagation()}><OwnerSelect sheet={s} staff={staff} /></span> },
          { key: "status", header: "Status", sortValue: (s) => s.status, render: (s) => (
            <span className="flex flex-col gap-1">
              <Badge tone={sheetTone(s.status)}>{sheetStatusLabel[s.status]}</Badge>
              {s.status === "Returned" && s.returnNote && <span className="max-w-48 truncate text-xs text-outline" title={s.returnNote}>{s.returnNote}</span>}
            </span>) },
          { key: "entered", header: "Entered / total", sortValue: (s) => s.summary?.entered ?? 0, render: (s) => `${s.summary?.entered ?? 0} / ${s.summary?.total ?? s.rosterIds?.length ?? 0}` },
          { key: "absent", header: "Absent", render: (s) => s.summary?.absent ?? 0 },
          { key: "range", header: "Out of range", render: (s) => (s.summary?.outOfRange ? <span className="font-semibold text-error">{s.summary.outOfRange}</span> : 0) },
          { key: "submitted", header: "Submitted at", sortValue: (s) => s.submittedAt ?? "", render: (s) => fmtAt(s.submittedAt) },
          { key: "actions", header: "Actions", render: (s) => <span onClick={(e) => e.stopPropagation()}><SheetActions sheet={s} /></span> },
        ]}
        empty={<EmptyState title="No mark sheets yet" hint="Open marks entry once the papers have been written. Until then the grid below works the legacy way." />}
      />
    </Card>
  );
}
