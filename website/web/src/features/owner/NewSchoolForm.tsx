"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, Copy, Eye, EyeOff, Sparkles } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, PageHeader, Select } from "@/components/ui";
import { siteUrls } from "@/lib/sites";
import { createSchool, ownerError } from "./api";
import { useLeads } from "./data";
import { BOARDS, fromLead, generatePassword, PLANS, validateNewSchool, type NewSchoolErrors, type NewSchoolInput } from "./logic";

const EMPTY: NewSchoolInput = { name: "", city: "", board: "CBSE", plan: "Trial", phone: "", adminName: "", adminEmail: "", password: "" };

/** Where the new admin signs in: the admin site's login page (lib/sites.ts). */
const loginUrl = () => (typeof window === "undefined" ? "/login" : `${siteUrls(window.location).admin}/login`);

export function NewSchoolForm({ leadId = "" }: { leadId?: string }) {
  const leads = useLeads();
  const lead = leadId ? leads.rows.find((l) => l.id === leadId) : undefined;
  const [v, setV] = useState<NewSchoolInput>(EMPTY);
  const [errs, setErrs] = useState<NewSchoolErrors>({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [done, setDone] = useState<{ sid: string; email: string; password: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [filled, setFilled] = useState(false);
  // prefill once, when the demo request has loaded (state adjusted during render)
  if (lead && !filled) { setFilled(true); setV((x) => ({ ...x, ...fromLead(lead) })); }

  const set = (k: keyof NewSchoolInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setV((x) => ({ ...x, [k]: e.target.value })); setErrs((x) => ({ ...x, [k]: undefined })); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setFail("");
    const found = validateNewSchool(v);
    setErrs(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const sid = await createSchool(v, leadId);
      setDone({ sid, email: v.adminEmail.trim().toLowerCase(), password: v.password, name: v.name.trim() });
    } catch (err) { setFail(ownerError(err)); } finally { setBusy(false); }
  };

  if (done) {
    const text = `${done.name}\nSign in: ${loginUrl()}\nEmail: ${done.email}\nPassword: ${done.password}\nChange the password after the first sign-in (My Profile > Password).`;
    return (
      <div className="mx-auto max-w-xl">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-success-container text-success"><Check size={20} /></span>
            <div><h1 className="t-headline-md">{done.name} is ready</h1><p className="text-on-surface-variant">Share these sign-in details with the school&apos;s admin.</p></div></div>
          <dl className="space-y-2 rounded-lg border border-outline-variant/60 bg-surface-container-low p-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">Sign in at</dt><dd className="truncate font-medium">{loginUrl()}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">Email</dt><dd className="font-medium">{done.email}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">Password</dt><dd className="font-mono font-medium">{done.password}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-on-surface-variant">The admin can change this password from My Profile. The school starts with the setup wizard.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" onClick={async () => { await navigator.clipboard?.writeText(text).catch(() => {}); setCopied(true); }}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy details"}</Button>
            <Link href={`/owner/schools/${done.sid}`}><Button>Open school page</Button></Link>
            <Button variant="ghost" onClick={() => { setDone(null); setV(EMPTY); setCopied(false); }}>Add another school</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/owner/schools" className="mb-3 inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"><ArrowLeft size={14} />Schools</Link>
      <PageHeader title="Add school" subtitle={lead ? `From the demo request of ${lead.name} (${lead.school}).` : "Creates the school with its starter settings and an admin login."} />
      <form onSubmit={submit} noValidate className="space-y-6">
        <Card>
          <CardHeader title="School" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="School name" required error={errs.name} className="sm:col-span-2"><Input value={v.name} onChange={set("name")} placeholder="Greenfield International School" /></Field>
            <Field label="City" error={errs.city}><Input value={v.city} onChange={set("city")} placeholder="Kochi" /></Field>
            <Field label="Phone" error={errs.phone}><Input value={v.phone} onChange={set("phone")} placeholder="+91" inputMode="tel" /></Field>
            <Field label="Board"><Select value={v.board} onChange={set("board")}>{BOARDS.map((b) => <option key={b}>{b}</option>)}</Select></Field>
            <Field label="Plan"><Select value={v.plan} onChange={set("plan")}>{PLANS.map((p) => <option key={p}>{p}</option>)}</Select></Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Admin login" subtitle="The person who runs the school in Edvio. They sign in with this email and password." />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Admin name" required error={errs.adminName}><Input value={v.adminName} onChange={set("adminName")} autoComplete="off" /></Field>
            <Field label="Admin email (sign-in id)" required error={errs.adminEmail}><Input type="email" value={v.adminEmail} onChange={set("adminEmail")} autoComplete="off" /></Field>
            <Field label="Password" required hint="At least 8 characters. The admin can change it later." error={errs.password} className="sm:col-span-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input type={show ? "text" : "password"} value={v.password} onChange={set("password")} autoComplete="new-password" className="pr-10 font-mono" />
                  <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-outline hover:text-on-surface">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
                <Button type="button" variant="outline" onClick={() => { setV((x) => ({ ...x, password: generatePassword() })); setShow(true); setErrs((x) => ({ ...x, password: undefined })); }}><Sparkles size={16} />Generate</Button>
              </div>
            </Field>
          </div>
        </Card>
        {fail && <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{fail}</p>}
        <div className="flex justify-end gap-2">
          <Link href="/owner/schools"><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={busy}>{busy ? "Creating school…" : "Create school"}</Button>
        </div>
      </form>
    </div>
  );
}
