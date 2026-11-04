"use client";
import { useState } from "react";
import { Link2, Mail, Unlink } from "lucide-react";
import { Badge, Button, Input, Modal, useToast } from "@/components/ui";
import { currentSchoolId } from "@/lib/useCollection";
import { consentGiven, linkParent, normEmail, parentError, resendParentInvite, unlinkParent, validEmail, type Consent, type SchoolUser } from "@/lib/parentAccount";

type Stu = { id: string; name: string; guardian: string; email?: string; guardianEmail?: string; guardianUids?: string[] };

const fmtAt = (v: unknown) => {
  const ms = typeof v === "string" ? Date.parse(v) : typeof v === "number" ? v : (v as { toMillis?: () => number } | null)?.toMillis?.() ?? NaN;
  return isNaN(ms) ? "—" : new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const yesNo = (v?: boolean) => v === undefined ? <span className="text-outline">—</span> : v ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>;

/** Student profile > Parent login (data contract 13.1) and consent state (13.3). */
export function ParentLoginSection({ s, students, users, consents }: { s: Stu; students: Stu[]; users: SchoolUser[]; consents: Map<string, Consent> }) {
  const toast = useToast();
  const [email, setEmail] = useState(s.guardianEmail || s.email || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [unlink, setUnlink] = useState<{ uid: string; label: string } | null>(null);
  const uids = s.guardianUids ?? [];
  const linkedEmails = new Set(uids.map((u) => normEmail(users.find((x) => x.id === u)?.email ?? "")));

  async function create() {
    const e = normEmail(email);
    if (!validEmail(e)) { setErr("Enter a valid email address"); return; }
    if (linkedEmails.has(e)) { setErr("This parent login is already linked"); return; }
    const sid = currentSchoolId(); if (!sid) { toast("Not signed in", "error"); return; }
    setErr(""); setBusy("create");
    try {
      const r = await linkParent(sid, s.id, e, s.guardian || "");
      if (!r.created) toast(`Linked the existing parent login ${e}`);
      else if (r.invited) toast(`Parent login created. Password email sent to ${e}`);
      else toast("Parent login created, but the password email could not be sent. Use Resend invite.", "error");
      setErr("");
    } catch (x) { setErr(parentError(x)); } finally { setBusy(null); }
  }
  async function resend(u: SchoolUser) {
    if (!u.email) return;
    setBusy(u.id);
    try { await resendParentInvite(u.email); toast(`Password email sent to ${u.email}`); } catch (x) { toast(parentError(x), "error"); } finally { setBusy(null); }
  }
  async function confirmUnlink() {
    const sid = currentSchoolId(); if (!sid || !unlink) return;
    setBusy(unlink.uid);
    try { await unlinkParent(sid, s.id, unlink.uid); toast("Parent login unlinked"); setUnlink(null); } catch { toast("Could not unlink the parent login", "error"); } finally { setBusy(null); }
  }

  return (
    <section>
      <h3 className="t-label-caps mb-2 text-on-surface-variant">Parent login</h3>
      {uids.length === 0 ? <p className="mb-3 text-sm text-on-surface-variant">No parent app login linked yet.</p> : (
        <ul className="mb-3 space-y-2">{uids.map((uid) => {
          const u = users.find((x) => x.id === uid);
          const c = consents.get(uid);
          const siblings = students.filter((o) => o.id !== s.id && o.guardianUids?.includes(uid)).map((o) => o.name);
          return (
            <li key={uid} className="rounded-lg border border-outline-variant/60 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{u?.name || s.guardian || "Parent"}</div>
                  <div className="truncate text-on-surface-variant">{u?.email ?? <span className="font-mono text-xs text-outline">{uid}</span>}</div>
                  {!u && <Badge tone="warning">Account not found</Badge>}
                  {u && u.role !== "parent" && <Badge tone="danger">Not a parent login ({u.role})</Badge>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {u?.email && <Button size="sm" variant="ghost" disabled={busy === uid} onClick={() => resend(u)}><Mail size={14} />Resend invite</Button>}
                  <Button size="sm" variant="ghost" aria-label="Unlink parent login" disabled={busy === uid} onClick={() => setUnlink({ uid, label: u?.email ?? uid })}><Unlink size={14} className="text-error" />Unlink</Button>
                </div>
              </div>
              <div className="mt-2 border-t border-outline-variant/40 pt-2">
                {consentGiven(c) && c ? (
                  <dl className="grid grid-cols-[110px_1fr] gap-y-1">
                    <dt className="text-outline">Consent</dt><dd><Badge tone="success">Given</Badge> <span className="t-caption text-outline">v{String(c.version ?? "—")} · {fmtAt(c.acceptedAt)}</span></dd>
                    <dt className="text-outline">Photos</dt><dd>{yesNo(c.items?.photos)}</dd>
                    <dt className="text-outline">Notifications</dt><dd>{yesNo(c.items?.notifications)}</dd>
                  </dl>
                ) : c ? <div><span className="text-outline">Consent </span><Badge tone="danger">Withdrawn</Badge><span className="t-caption ml-1 text-outline">{fmtAt(c.acceptedAt) !== "—" ? `given ${fmtAt(c.acceptedAt)}, then withdrawn` : "withdrawn by the parent"}</span></div>
                  : <div><span className="text-outline">Consent </span><Badge tone="warning">Pending</Badge><span className="t-caption ml-1 text-outline">recorded at the parent&apos;s first sign-in</span></div>}
                {siblings.length > 0 && <p className="t-caption mt-1 text-outline">Also linked to {siblings.join(", ")}</p>}
              </div>
            </li>);
        })}</ul>)}
      <div className="flex gap-2">
        <Input type="email" aria-label="Guardian email" placeholder="guardian@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
        <Button className="shrink-0" disabled={busy === "create"} onClick={create}><Link2 size={14} />{busy === "create" ? "Working…" : "Create & invite"}</Button>
      </div>
      {err ? <p className="mt-1 text-xs text-error" role="alert">{err}</p>
        : <p className="t-caption mt-1 text-outline">An existing parent login with this email (e.g. a sibling&apos;s) is linked; otherwise a login is created and a password email is sent.</p>}
      <Modal open={!!unlink} onClose={() => setUnlink(null)} title="Unlink parent login?" subtitle={unlink?.label}
        footer={<><Button variant="ghost" onClick={() => setUnlink(null)}>Cancel</Button><Button variant="danger" disabled={!!unlink && busy === unlink.uid} onClick={confirmUnlink}>{unlink && busy === unlink.uid ? "Unlinking…" : "Unlink"}</Button></>}>
        <p className="text-on-surface-variant">This parent will no longer see {s.name} in the parent app. The login itself is kept (it may be linked to siblings) and can be linked again later.</p>
      </Modal>
    </section>
  );
}
