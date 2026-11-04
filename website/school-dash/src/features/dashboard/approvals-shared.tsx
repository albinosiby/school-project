"use client";
import { useState } from "react";
import { AlarmClock, Asterisk, Banknote, CalendarClock, ClipboardList, Lock, ShoppingCart } from "lucide-react";
import { Button, Field, Modal, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { auth } from "@/lib/firebase";
import { toLeaveStatus, useStaffLeaves, type StaffLeave } from "../people/leaves";
import { useRegularizations } from "../people/checkins";
import { errMsg, useApprovals, nowLocal, KIND_LABEL, type Approval } from "./data";
import { leaveDecisionPatch, pendingOnly } from "./logic";

export const KIND_ICON = { leave: CalendarClock, attendance: AlarmClock, fee: Banknote, marks: Lock, pass: Asterisk, po: ShoppingCart } as const;
export const KindIcon = ({ kind, size = 16 }: { kind: Approval["kind"]; size?: number }) => {
  const I = KIND_ICON[kind] ?? ClipboardList;
  return <I size={size} className="shrink-0 text-secondary" aria-hidden />;
};
export { KIND_LABEL };

export function useApprovalActions() {
  const { rows, update } = useApprovals();
  const { rows: leaveRows, update: updateLeave } = useCollection<StaffLeave>("staff_leaves");
  useStaffLeaves(); // keeps the leave mirror rows in the queue
  const regs = useRegularizations(); // and the regularization mirror rows
  const toast = useToast();
  /**
   * Mirror rows decide the record they stand for (contract 9): the staff leave (Approved / Rejected + decidedBy / decidedAt)
   * or the regularization. The source is written FIRST, so a refused write (rules, offline) leaves the approval pending
   * instead of showing a decision the teacher never gets. A leave the teacher has since withdrawn (deleted) is skipped.
   */
  const syncSource = async (id: string, status: Approval["status"], note = "") => {
    const r = rows.find((x) => x.id === id);
    if (r?.source === "staff_regularizations" && r.sourceId) {
      const reg = regs.regs.rows.find((x) => x.id === r.sourceId);
      if (reg) await regs.decide(reg, toLeaveStatus(status), note, { mirror: false });
      return;
    }
    if (r?.source !== "staff_leaves" || !r.sourceId) return;
    if (!leaveRows.some((l) => l.id === r.sourceId)) return;
    await updateLeave(r.sourceId, leaveDecisionPatch(status, auth.currentUser?.uid ?? "", note) as never);
  };
  /** run a decision over pending rows; failures (e.g. permission-denied) surface as an error toast */
  const decide = async (ids: string[], status: "approved" | "rejected", reason = "") => {
    const targets = pendingOnly(rows, ids);
    if (!targets.length) return true;
    const at = nowLocal();
    const res = await Promise.allSettled(targets.map(async (id) => { await syncSource(id, status, reason); await update(id, { status, decidedAt: at, reason }); }));
    const ok = res.filter((r) => r.status === "fulfilled").length, failed = res.find((r): r is PromiseRejectedResult => r.status === "rejected");
    const verb = status === "approved" ? "approved" : "rejected";
    if (ok) toast(ok === 1 ? `Request ${verb}` : `${ok} requests ${verb}`);
    if (failed) toast(errMsg(failed.reason, `${res.length - ok} request${res.length - ok > 1 ? "s" : ""} could not be ${verb}`), "error");
    return !failed;
  };
  const approve = (ids: string[]) => decide(ids, "approved");
  /** throws when any rejection failed, so ReasonModal stays open with the typed reason */
  const reject = async (ids: string[], reason: string) => { if (!(await decide(ids, "rejected", reason))) throw Object.assign(new Error("Some requests could not be rejected — your reason is kept, try again."), { toasted: true }); };
  const reopen = async (id: string) => {
    try { await syncSource(id, "pending"); await update(id, { status: "pending", reason: "", decidedAt: "" }); toast("Request moved back to pending"); }
    catch (e) { toast(errMsg(e, "Could not reopen"), "error"); }
  };
  return { rows, approve, reject, reopen, update };
}

export function ReasonModal({ ids, title, label = "Reason for rejection", cta = "Reject", onClose, onSubmit }: {
  ids: string[] | null; title: string; label?: string; cta?: string; onClose: () => void; onSubmit: (ids: string[], reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const close = () => { setReason(""); setErr(""); onClose(); };
  return (
    <Modal open={!!ids} onClose={close} title={title} subtitle={ids ? `${ids.length} request${ids.length > 1 ? "s" : ""} selected` : undefined}
      footer={<><Button variant="outline" onClick={close}>Cancel</Button>
        <Button variant={cta === "Reject" ? "danger" : "primary"} disabled={busy} onClick={async () => {
          if (reason.trim().length < 5) { setErr("Please enter at least 5 characters."); return; }
          setBusy(true);
          try { await onSubmit(ids!, reason.trim()); close(); }
          catch (e) { const m = e instanceof Error && e.message ? e.message : "Could not save"; setErr(m); if (!(e as { toasted?: boolean })?.toasted) toast(m, "error"); }
          finally { setBusy(false); }
        }}>{busy ? "Saving…" : cta}</Button></>}>
      <Field label={label} required error={err}><Textarea value={reason} onChange={(e) => { setReason(e.target.value); setErr(""); }} placeholder="Visible to the requester and recorded in the audit log" autoFocus /></Field>
    </Modal>
  );
}
