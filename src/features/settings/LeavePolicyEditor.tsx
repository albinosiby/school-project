"use client";
// Settings > Leave policy: set_leave_policy/policy (data contract section 12.2). The teacher app's leave quotas and the
// "late" check-in threshold come from this doc (built-in defaults while it is missing).
import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Badge, Button, Field, Input, useToast } from "@/components/ui";
import { DEFAULT_CHECK_IN_BY, DEFAULT_LEAVE_TYPES, useLeavePolicy, type LeaveType } from "@/features/people/checkins";

type Draft = { types: (LeaveType & { key: string })[]; checkInBy: string };
let seq = 0;
const withKeys = (types: LeaveType[]) => types.map((t) => ({ ...t, key: `k${seq++}` }));

export function LeavePolicyEditor({ onSaved }: { onSaved?: (detail: string) => void }) {
  const toast = useToast();
  const policy = useLeavePolicy();
  const [v, setV] = useState<Draft | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  // first load: start from the saved doc (or the defaults)
  if (!v && policy.ready) setV({ types: withKeys(policy.types), checkInBy: policy.checkInBy });
  if (!v) return <p className="text-on-surface-variant">Loading leave policy…</p>;

  const upd = (key: string, patch: Partial<LeaveType>) => setV({ ...v, types: v.types.map((t) => (t.key === key ? { ...t, ...patch } : t)) });
  const saved = JSON.stringify({ types: policy.types, checkInBy: policy.checkInBy });
  const clean = { types: v.types.map(({ key: _k, ...t }) => { void _k; return { id: t.id.trim().toUpperCase(), name: t.name.trim(), type: t.type.trim(), total: Number(t.total) }; }), checkInBy: v.checkInBy };
  const dirty = !policy.exists || JSON.stringify(clean) !== saved;

  const save = async () => {
    const ids = clean.types.map((t) => t.id);
    if (!clean.types.length) return setErr("Add at least one leave type");
    if (clean.types.some((t) => !t.id || !t.name || !t.type)) return setErr("Every leave type needs a code, a label and a leave type");
    if (new Set(ids).size !== ids.length) return setErr("Leave codes must be unique");
    if (new Set(clean.types.map((t) => t.type.toLowerCase())).size !== ids.length) return setErr("Each leave type can appear only once");
    if (clean.types.some((t) => !Number.isInteger(t.total) || t.total < 0 || t.total > 365)) return setErr("Yearly totals must be whole numbers between 0 and 365");
    if (!/^\d{2}:\d{2}$/.test(clean.checkInBy)) return setErr("Enter the check-in time");
    setErr(""); setSaving(true);
    try {
      await policy.save(clean);
      onSaved?.(`${clean.types.length} leave types · check-in by ${clean.checkInBy}`);
      toast("Leave policy saved");
    } catch { toast("Could not save the leave policy", "error"); } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-outline-variant/60"><table className="w-full text-left">
        <thead className="bg-surface-container-low t-label-caps !text-[11px] text-on-surface-variant"><tr><th className="p-3">Code</th><th className="p-3">Label</th><th className="p-3">Leave type</th><th className="p-3">Days / year</th><th className="p-3" /></tr></thead>
        <tbody>{v.types.map((t) => (
          <tr key={t.key} className="border-t border-outline-variant/50">
            <td className="p-2 w-24"><Input aria-label="Leave code" value={t.id} onChange={(e) => upd(t.key, { id: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} className="font-mono" /></td>
            <td className="p-2"><Input aria-label="Label" value={t.name} onChange={(e) => upd(t.key, { name: e.target.value })} placeholder="Casual (CL)" /></td>
            <td className="p-2"><Input aria-label="Leave type" value={t.type} onChange={(e) => upd(t.key, { type: e.target.value })} placeholder="Casual Leave" /></td>
            <td className="p-2 w-28"><Input aria-label="Days per year" type="number" min={0} max={365} value={Number.isNaN(t.total) ? "" : t.total} onChange={(e) => upd(t.key, { total: e.target.value === "" ? NaN : Number(e.target.value) })} /></td>
            <td className="p-2 text-right"><Button size="sm" variant="ghost" aria-label={`Remove ${t.id || "type"}`} onClick={() => setV({ ...v, types: v.types.filter((x) => x.key !== t.key) })}><Trash2 size={14} className="text-error" /></Button></td>
          </tr>))}</tbody></table></div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Button size="sm" variant="outline" onClick={() => setV({ ...v, types: [...v.types, ...withKeys([{ id: "", name: "", type: "", total: 0 }])] })}><Plus size={14} />Add leave type</Button>
        <Button size="sm" variant="ghost" onClick={() => setV({ types: withKeys(DEFAULT_LEAVE_TYPES), checkInBy: DEFAULT_CHECK_IN_BY })}>Reset to defaults</Button>
        <Field label="Check in by (late after)" className="ml-auto w-44"><Input type="time" value={v.checkInBy} onChange={(e) => setV({ ...v, checkInBy: e.target.value })} /></Field>
        <Button onClick={save} disabled={saving || !dirty}><Save size={16} />{saving ? "Saving…" : "Save leave policy"}</Button>
      </div>
      {err && <p className="mt-2 text-xs text-error">{err}</p>}
      <p className="mt-2 text-xs text-outline">{policy.exists ? <>Teachers&apos; quotas in the app use these totals; used days come from approved leave requests of the same type.</> : <><Badge tone="warning">Not saved yet</Badge> The app is using the built-in defaults shown here.</>}</p>
    </div>
  );
}
