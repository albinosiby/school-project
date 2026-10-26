"use client";
import { useEffect, useMemo, useState } from "react";
import { Bell, Code2, Download, FileText, Image as ImageIcon, Link2, MessageSquare, Printer, Send, Share2 } from "lucide-react";
import { Badge, Button, Card, LineChart, Modal, ProgressBar, Switch, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { inrFull } from "@/lib/format";
import { DynamicForm } from "./DynamicForm";
import { copyText, downloadBlob, pct, useAdm } from "./lib";
import { qrSvg } from "./qr";
import { gradeIdFromLabel, type FormDoc } from "./types";

export function PublicFormPortal() {
  const { enq, apps, config, cfg, createEnquiry, logMessage, ready } = useAdm();
  const form = useCollection<FormDoc>("adm_form").rows[0];
  const toast = useToast();
  const [origin, setOrigin] = useState("");
  const [fillOpen, setFillOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setOrigin(window.location.origin);
      if (new URLSearchParams(window.location.search).get("apply") === "1") setFillOpen(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const link = `${origin || "https://admissions.greenfield.edu.in"}/admissions/public-form?apply=1`;
  const svg = useMemo(() => qrSvg(link, { margin: 1 }), [link]);
  const stats = config?.stats;
  const web = enq.rows.filter((e) => e.source === "Website Form");
  const submitted = apps.rows.filter((a) => a.feePaid).length;
  const visitors = (stats?.visitors ?? 0) + web.length;
  const begun = (stats?.begun ?? 0) + web.length;
  const snippet = `<iframe src="${link}&embed=1" width="100%" height="900" style="border:0" title="Greenfield admissions form"></iframe>`;

  const copy = async (t: string, what: string) => { const ok = await copyText(t); toast(ok ? `${what} copied to clipboard` : "Copy failed — select and copy manually", ok ? "success" : "error"); };
  const dl = (kind: "svg" | "png") => {
    if (kind === "svg") { downloadBlob("greenfield-admissions-qr.svg", new Blob([svg], { type: "image/svg+xml" })); return toast("Vector SVG downloaded"); }
    const img = new Image(), c = document.createElement("canvas"); c.width = c.height = 1200;
    img.onload = () => { const x = c.getContext("2d")!; x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, 1200, 1200); c.toBlob((b) => { if (b) { downloadBlob("greenfield-admissions-qr-300dpi.png", b); toast("PNG downloaded"); } }); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };
  const simulate = async (kind: string, to: string, text: string, toastMsg: string) => { try { await logMessage(kind, to, text); toast(toastMsg); } catch { toast("Could not log the send", "error"); } };

  async function onSubmit(v: Record<string, string>) {
    // enforce the cap and dedupe toggles shown on this page (errors are shown inside the form)
    if (web.length >= cap) throw new Error("Online submissions are closed for now (cap reached). Please contact the admissions office.");
    if (config?.safeguards.dedupe) {
      const digits = (x: string) => x.replace(/\D/g, "");
      const dup = enq.rows.find((e) => e.dob && e.dob === v.dob && ((v.aadhaar && digits(e.answers?.aadhaar ?? "") === digits(v.aadhaar)) || (e.name.trim().toLowerCase() === (v.name ?? "").trim().toLowerCase() && digits(e.phone) === digits(v.phone ?? ""))));
      if (dup) throw new Error(`An enquiry for this child already exists (${dup.ref}).`);
    }
    const core = new Set(["name", "grade", "dob", "guardian", "phone", "email", "prevSchool", "area"]);
    const answers = Object.fromEntries(Object.entries(v).filter(([k, x]) => !core.has(k) && x));
    const row = await createEnquiry({
      name: v.name ?? "", grade: gradeIdFromLabel(v.grade ?? ""), dob: v.dob ?? "", guardian: v.guardian ?? "", phone: v.phone ?? "", email: v.email ?? "", prevSchool: v.prevSchool ?? "", area: v.area ?? "",
      source: "Website Form", answers,
    });
    if (config) cfg.update("config", { stats: { ...config.stats, scansToday: config.stats.scansToday + 1 } }).catch(() => {}); // stats only; never block the parent
    if (config?.safeguards.receipts) await logMessage("Acknowledgement receipt", v.phone ?? "", `Receipt for ${row.ref}: ${v.name}. Interview docket will follow.`);
    setDone(row.ref);
  }

  const hourly = stats?.hourly ?? [];
  const sg = config?.safeguards;
  const cap = config?.submissionCap ?? 500;
  const setSg = (k: keyof NonNullable<typeof sg>, v: boolean) => config && cfg.update("config", { safeguards: { ...config.safeguards, [k]: v } }).catch(() => toast("Could not save setting", "error"));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3"><Badge tone="info" className="!bg-info-container uppercase">Intake channel active</Badge><span className="text-sm text-on-surface-variant">Zone: Greenfield Main Campus · Bengaluru North</span></div>
          <h1 className="t-headline-lg mt-2">Public Admission Form &amp; QR Code Portal</h1>
          <p className="mt-1 max-w-xl text-on-surface-variant">Shareable multi-channel digital intake link, print-ready campus QR stands, and direct WhatsApp onboarding links for AY 2026-27.</p>
        </div>
        <Card className="flex divide-x divide-outline-variant/60">
          {[["TODAY'S SCANS", String(stats?.scansToday ?? 0)], ["TOTAL INTAKE", String(enq.rows.length)], ["FEE CAPTURED", inrFull(apps.rows.filter((a) => a.feePaid).length * (config?.appFee ?? 2500))]].map(([k, v]) => (
            <div key={k} className="px-5 py-3"><div className="t-caption text-on-surface-variant">{k}</div><div className="text-xl font-semibold">{v}</div></div>))}
        </Card>
      </header>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-start justify-between"><div><div className="t-label-caps text-secondary">High-fidelity code</div><h2 className="t-headline-md !text-[18px]">Campus QR Identity</h2></div><Badge tone="success">Active &amp; Accepting</Badge></div>
            <div className="mt-4 rounded-lg bg-surface-container-low p-6 text-center">
              <div role="img" aria-label="QR code for the admissions form" className="mx-auto w-56 rounded bg-white p-3 shadow-card" dangerouslySetInnerHTML={{ __html: svg }} />
              <p className="mt-3 text-sm font-semibold">Scan to Apply · AY 2026-27</p><p className="text-xs text-on-surface-variant">Direct Admissions Intake Link</p>
            </div>
            <div className="mt-4"><div className="mb-1.5 text-xs font-semibold text-on-surface-variant">Admissions Intake Permalink</div>
              <div className="flex items-center gap-2 rounded bg-surface-container-low p-1.5 pl-3"><Link2 size={14} className="shrink-0 text-outline" /><input readOnly value={link} aria-label="Permalink" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /><Button size="sm" variant="outline" onClick={() => copy(link, "Link")}>Copy Link</Button></div></div>
            <div className="mt-4"><div className="t-label-caps mb-2 text-on-surface-variant">Production &amp; display exports</div>
              <div className="grid grid-cols-3 gap-2"><Button variant="outline" onClick={() => dl("svg")}><Download size={14} />Vector SVG</Button><Button variant="outline" onClick={() => dl("png")}><ImageIcon size={14} />300 DPI PNG</Button>
                <Button onClick={() => simulate("Standee PDF", "print-desk", "A4 standee PDF generated for reception.", "Standee PDF queued to the print desk (simulated)")}><Printer size={14} />Standee PDF</Button></div></div>
            <Button className="mt-4 w-full" onClick={() => { setDone(null); setFillOpen(true); }}><FileText size={16} />Open live application form</Button>
          </Card>
          <Card className="p-5">
            <div className="flex items-start justify-between"><div><div className="t-label-caps text-secondary">Physical reception asset</div><h2 className="t-headline-md !text-[18px]">Counter Standee Layout</h2></div><Badge>A4 Vertical</Badge></div>
            <div className="mt-4 rounded-lg bg-surface-container-low p-5"><div className="mx-auto max-w-[220px] rounded border-t-4 border-secondary bg-white p-4 text-center shadow-card">
              <div className="text-xs font-bold">GREENFIELD INT.</div><div className="t-caption text-outline">CAMPUS ADMISSIONS DESK</div>
              <div className="mx-auto my-3 w-28" dangerouslySetInnerHTML={{ __html: svg }} />
              <ul className="space-y-1 rounded bg-surface-container-low p-2 text-left text-[11px]"><li>Scan via Camera or UPI app</li><li>Quick {form?.sections.reduce((n, s) => n + s.fields.length, 0) ?? 14}-field intake</li><li>Instant SMS verification</li></ul></div></div>
            <p className="mt-3 text-sm text-on-surface-variant">Ready for placement at Security Gate 1, Administrative Front Desk, and Visitor Lounge. Form tracks source tags automatically (<code className="text-secondary">?ref=reception_standee</code>).</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-start justify-between"><div><div className="t-label-caps text-on-surface-variant">Multi-channel ingestion</div><h2 className="t-headline-md !text-[18px]">Direct Share Triggers</h2></div><Badge tone="warning">Sends simulated</Badge></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                { icon: <MessageSquare size={16} />, c: "text-success", t: "WhatsApp Blast", d: `${enq.rows.filter((e) => e.stage === "new" || e.stage === "contacted").length} verified phone enquiries pending application.`, b: "Dispatch Blast", icon2: <Send size={14} />, act: () => simulate("WhatsApp blast", "pending enquiries", "Application link blast to pending enquiries.", "WhatsApp blast logged (simulated — gateway not connected)") },
                { icon: <Share2 size={16} />, c: "text-secondary", t: "Social Bio Link", d: "Optimized for Instagram, Facebook & LinkedIn campus linktrees.", b: "Copy Bio URL", icon2: <Link2 size={14} />, act: () => copy(`${link}&ref=bio`, "Bio URL") },
                { icon: <Bell size={16} />, c: "text-error", t: "Sibling Push", d: "Push alert to enrolled parents for sibling preferential intake.", b: "Queue Push", icon2: <Bell size={14} />, act: () => simulate("Sibling push", "enrolled parents", "Sibling preferential intake push notification.", "Sibling push logged (simulated — parent app not built yet)") },
              ].map((x) => (
                <div key={x.t} className="flex flex-col rounded-lg bg-surface-container-low p-4"><div className={`flex items-center gap-2 font-semibold ${x.c}`}>{x.icon}{x.t}</div><p className="my-2 flex-1 text-sm text-on-surface-variant">{x.d}</p><Button variant="outline" size="sm" onClick={x.act}>{x.b}{x.icon2}</Button></div>))}
            </div>
            <div className="mt-4"><div className="mb-1.5 flex justify-between text-sm"><b>Website Responsive Embed (iFrame Widget)</b><span className="text-xs text-outline">{form ? `Form v${form.version}` : ""}</span></div>
              <div className="flex items-center gap-2 rounded bg-surface-container-low p-2"><Code2 size={14} className="text-outline" /><code className="min-w-0 flex-1 truncate font-mono text-xs">{snippet}</code><Button size="sm" variant="outline" onClick={() => copy(snippet, "Embed snippet")}>Copy Snippet</Button></div></div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between"><div><div className="t-label-caps text-on-surface-variant">Ingestion telemetry</div><h2 className="t-headline-md !text-[18px]">Intake Funnel &amp; Conversion Health</h2></div><span className="text-xs font-semibold text-success">Live from data</span></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[["Unique Visitors", visitors, 100, "Across Standees & Web"], ["Form Begun (OTP)", begun, pct(begun, visitors), "Verified Phone OTP"], ["Submitted & Paid", submitted, pct(submitted, visitors), "Completed"]].map(([k, n, p, s]) => (
                <div key={k as string} className="rounded-lg bg-surface-container-low p-4"><div className="flex justify-between text-sm text-on-surface-variant"><span>{k}</span><span>{p}%</span></div><div className="my-1 text-2xl font-semibold">{(n as number).toLocaleString("en-IN")}</div><ProgressBar value={p as number} /><p className="mt-2 text-xs text-on-surface-variant">{s}</p></div>))}
            </div>
            <div className="mt-4 rounded-lg bg-surface-container-low p-4"><div className="mb-2 flex justify-between text-sm"><b>Hourly Scan Distribution (IST)</b><span className="text-xs text-outline">Peak: {hourly.length ? `${String(hourly.indexOf(Math.max(...hourly))).padStart(2, "0")}:00` : "—"}</span></div>
              <LineChart values={hourly} labels={hourly.map((_, i) => `${String(i).padStart(2, "0")}h`)} /></div>
          </Card>

          <Card className="p-5">
            <div className="t-label-caps text-on-surface-variant">Security &amp; safeguards</div><h2 className="t-headline-md !text-[18px]">Intake Parameters &amp; Anti-Spam Controls</h2>
            <div className="mt-4 rounded-lg bg-surface-container-low p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><b>Submission Cap Control</b><span className="text-secondary font-semibold">{web.length} / {cap} Cap</span></div><ProgressBar className="my-2" value={pct(web.length, cap)} />
              <p className="flex justify-between text-xs text-on-surface-variant"><span>{Math.round(pct(web.length, cap))}% Cap utilized</span><span className="text-success">{Math.max(0, cap - web.length)} online submissions left before the form closes</span></p></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {([["razorpay", "Razorpay Application Fee", "Mandate ₹2,500 non-refundable prospectus fee prior to registration submission.", "UPI / NetBanking"], ["otp", "Mandatory Mobile OTP (+91)", "Require 6-digit SMS OTP verification before granting candidate form access.", "2FA Active"], ["dedupe", "Aadhaar & DOB Deduplication", "Instantly block multiple registration attempts using matching child Aadhaar & birth date.", "UIDAI Format"], ["receipts", "Multi-Receipt Dispatch", "Automate immediate PDF acknowledgement receipt and interview docket to primary guardian.", "WhatsApp + SMS"]] as const).map(([k, t, d, tag]) => (
                <div key={k} className="rounded-lg bg-surface-container-low p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{t}</div><Badge tone="info" className="mt-1">{tag}</Badge></div><Switch label={t} checked={!!sg?.[k]} onChange={(v) => setSg(k, v)} /></div><p className="mt-2 text-sm text-on-surface-variant">{d}</p></div>))}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={fillOpen} onClose={() => setFillOpen(false)} width="max-w-2xl" title={done ? "Application received" : form?.name ?? "Admission form"} subtitle={done ? undefined : form ? `Live form v${form.version} — submissions create an enquiry` : undefined}>
        {done ? (
          <div className="py-6 text-center"><div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-success-container text-success">✓</div><p className="t-headline-md">Thank you!</p><p className="mt-1 text-on-surface-variant">Your enquiry reference is <b className="font-mono text-secondary">{done}</b>. An admissions counsellor will contact you shortly{sg?.razorpay ? ` to collect the ${inrFull(config?.appFee ?? 2500)} application fee` : ""}.</p>
            <div className="mt-4 flex justify-center gap-2"><Button variant="outline" onClick={() => setDone(null)}>Submit another</Button><Button onClick={() => setFillOpen(false)}>Close</Button></div></div>
        ) : !ready || !form ? <p>Loading…</p> : <DynamicForm sections={form.published} onSubmit={onSubmit} />}
      </Modal>
    </div>
  );
}
