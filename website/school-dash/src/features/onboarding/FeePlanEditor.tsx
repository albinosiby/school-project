"use client";

import { useId, useState } from "react";
import { ArrowDownToLine, Bus, CalendarDays, ChevronDown, GraduationCap, Plus, ReceiptText, ShieldCheck, Trash2, Wallet } from "lucide-react";
import { Badge, Button, Checkbox, Field, Input, Select, Switch } from "@/components/ui";
import { inrFull } from "@/lib/format";
import { annualFee, classLabel, FEE_FREQUENCIES, recurringTotal, type FeeFrequency, type FeeItem, type FeePlan } from "@/features/fees/feePlan";
import { parseFeeScope } from "@/lib/academicStreams";

/** Fee configuration only: saving the plan never creates invoices or charges parents. */
export function FeePlanEditor({ value, onChange, disabled = false, compact = false }: { value: FeePlan; onChange: (value: FeePlan) => void; disabled?: boolean; compact?: boolean }) {
  const [previewGrade, setPreviewGrade] = useState(value.grades[0] ?? "");
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const panelPrefix = useId();
  const grade = value.grades.includes(previewGrade) ? previewGrade : value.grades[0] ?? "";
  const preview = value.items.filter((item) => item.grades.includes(grade));
  const covered = new Set(value.items.flatMap((item) => item.grades));
  const hasStreams = value.grades.some((key) => !!parseFeeScope(key).streamId);
  const edit = (id: string, patch: Partial<FeeItem>) => onChange({ ...value, items: value.items.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const add = () => {
    const item: FeeItem = { id: `fee_${crypto.randomUUID()}`, name: "", amount: 0, grades: [...value.grades], frequency: "Monthly", dueDate: "", mandatory: true, newStudentsOnly: false };
    onChange({ ...value, items: [item, ...value.items] });
    setExpandedItems((previous) => ({ ...previous, [item.id]: true }));
  };

  return <fieldset disabled={disabled} className="min-w-0 space-y-6">
    <legend className="sr-only">Fee plan configuration</legend>
    {!compact && <>
      <div className="rounded-xl border border-secondary/15 bg-info-container/35 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-container-lowest text-secondary"><Wallet size={20} aria-hidden="true" /></span>
          <div><p className="font-semibold">A clear fee plan for every class</p><p className="mt-1 text-sm leading-6 text-on-surface-variant">Define what families pay, who it applies to, and when it is collected. Amounts are per student, per collection.</p></div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Academic year"><Input value={value.academicYear} placeholder="2026-27" onChange={(event) => onChange({ ...value, academicYear: event.target.value })} /></Field>
          <Field label="Terms per year" hint="Used for term-wise annual estimates"><Select value={value.termsPerYear} onChange={(event) => onChange({ ...value, termsPerYear: Number(event.target.value) })}>{[1, 2, 3, 4].map((terms) => <option key={terms} value={terms}>{terms} {terms === 1 ? "term" : "terms"}</option>)}</Select></Field>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-outline-variant/60 p-4"><p className="flex items-center gap-2 text-xs text-on-surface-variant"><ReceiptText size={14} aria-hidden="true" />Fee items</p><p className="mt-2 text-2xl font-semibold">{value.items.length}</p></div>
        <div className="rounded-lg border border-outline-variant/60 p-4"><p className="flex items-center gap-2 text-xs text-on-surface-variant"><GraduationCap size={14} aria-hidden="true" />Classes covered</p><p className="mt-2 text-2xl font-semibold">{covered.size}<span className="text-sm font-normal text-on-surface-variant"> / {value.grades.length}</span></p></div>
      </div>
    </>}

    <section aria-labelledby="fee-items-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 id="fee-items-heading" className="font-semibold">Fee items</h3><p className="mt-1 text-sm text-on-surface-variant">Use a separate item when the amount or schedule differs by class or stream.</p></div>
        <Button type="button" size="sm" onClick={() => add()}><Plus size={15} aria-hidden="true" />Add fee item</Button>
      </div>
      <p className="flex items-start gap-2 rounded-lg bg-surface-container-low p-3 text-xs leading-5 text-on-surface-variant"><Bus size={16} className="mt-0.5 shrink-0" aria-hidden="true" />Set each student’s transport amount when assigning a bus or editing student details → Transport.</p>
      {hasStreams && <p className="text-xs leading-5 text-on-surface-variant">Grades 11–12 use the streams configured in Classes &amp; Sections. Select a class and stream below to give Science, Commerce, or Humanities its own fee amount.</p>}
      {value.items.length === 0 && <div className="rounded-xl border border-dashed border-outline-variant px-5 py-9 text-center"><ReceiptText size={28} className="mx-auto text-outline" aria-hidden="true" /><p className="mt-3 font-semibold">Start with your first fee item</p><p className="mt-1 text-sm text-on-surface-variant">Add tuition, admission, or a fee specific to your school.</p></div>}
      {value.items.map((item, index) => <fieldset key={item.id} className="min-w-0 overflow-hidden rounded-xl border border-outline-variant/60">
        <legend className="sr-only">Fee item {index + 1}</legend>
        <div className={`flex items-center gap-1 bg-surface-container-low/70 pr-3 ${expandedItems[item.id] ? "border-b border-outline-variant/40" : ""}`}>
          <button type="button" className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-4 text-left hover:bg-surface-container-low focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary"
            aria-expanded={!!expandedItems[item.id]} aria-controls={`${panelPrefix}-${item.id}`}
            aria-label={`${expandedItems[item.id] ? "Collapse" : "Expand"} fee item ${index + 1}: ${item.name || "Untitled fee"}`}
            onClick={() => setExpandedItems((previous) => ({ ...previous, [item.id]: !previous[item.id] }))}>
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-info-container text-xs font-semibold text-secondary">{String(index + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="break-words text-sm font-semibold">{item.name || "Untitled fee"}</span><Badge tone={item.mandatory ? "info" : "neutral"}>{item.mandatory ? "Mandatory" : "Optional"}</Badge></span><span className="mt-1 block text-xs text-on-surface-variant">{inrFull(item.amount)} · {item.frequency} · {item.grades.length} {item.grades.length === 1 ? "class" : "classes"}</span></span>
            <ChevronDown size={17} aria-hidden="true" className={`shrink-0 text-on-surface-variant transition-transform motion-reduce:transition-none ${expandedItems[item.id] ? "rotate-180" : ""}`} />
          </button>
          <Button type="button" size="sm" variant="ghost" aria-label={`Remove fee item ${index + 1}`} onClick={() => {
            onChange({ ...value, items: value.items.filter((row) => row.id !== item.id) });
            setExpandedItems((previous) => { const next = { ...previous }; delete next[item.id]; return next; });
          }}><Trash2 size={15} aria-hidden="true" /></Button>
        </div>
        <div id={`${panelPrefix}-${item.id}`} hidden={!expandedItems[item.id]} className="space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Field label="Fee name"><Input value={item.name} maxLength={80} placeholder="e.g. Tuition fee" onChange={(event) => edit(item.id, { name: event.target.value })} /></Field>
            <Field label="Amount per collection (₹)"><Input type="number" min={0.01} max={10000000} step={0.01} value={item.amount || ""} placeholder="0.00" onChange={(event) => edit(item.id, { amount: Number(event.target.value) })} /></Field>
            <Field label="Collection frequency"><Select value={item.frequency} onChange={(event) => edit(item.id, { frequency: event.target.value as FeeFrequency })}>{FEE_FREQUENCIES.map((frequency) => <option key={frequency}>{frequency}</option>)}</Select></Field>
            <Field label="First due date (optional)"><Input type="date" value={item.dueDate} onChange={(event) => edit(item.id, { dueDate: event.target.value })} /></Field>
          </div>
          <details className="rounded-lg border border-outline-variant/50">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm"><span><span className="font-medium">Applicable classes</span><span className="ml-2 text-xs text-on-surface-variant">{item.grades.length === value.grades.length ? "All classes" : `${item.grades.length} selected`}</span></span><ChevronDown size={15} aria-hidden="true" /></summary>
            <div className="border-t border-outline-variant/40 p-3">
              <div className="mb-3 flex gap-3"><button type="button" className="cursor-pointer text-xs font-semibold text-secondary" onClick={() => edit(item.id, { grades: [...value.grades] })}>Select all</button><button type="button" className="cursor-pointer text-xs text-on-surface-variant" onClick={() => edit(item.id, { grades: [] })}>Clear</button></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{value.grades.map((classId) => <label key={classId} className="flex min-h-9 items-center gap-2 text-sm"><Checkbox checked={item.grades.includes(classId)} onChange={(event) => edit(item.id, { grades: event.target.checked ? [...item.grades, classId] : item.grades.filter((id) => id !== classId) })} />{classLabel(classId)}</label>)}</div>
            </div>
          </details>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Collection type"><Select value={item.mandatory ? "mandatory" : "optional"} onChange={(event) => edit(item.id, { mandatory: event.target.value === "mandatory" })}><option value="mandatory">Mandatory</option><option value="optional">Optional / opt-in</option></Select></Field>
            <Field label="Student eligibility"><Select value={item.newStudentsOnly ? "new" : "all"} onChange={(event) => edit(item.id, { newStudentsOnly: event.target.value === "new" })}><option value="all">All students in selected classes</option><option value="new">New admissions only</option></Select></Field>
          </div>
          <p className="flex items-center gap-2 text-xs text-on-surface-variant"><CalendarDays size={13} className="shrink-0" aria-hidden="true" />{item.frequency === "One-time" ? "Collected once per eligible student." : `${inrFull(annualFee(item, value.termsPerYear))} per student / year, before concessions.`}</p>
        </div>
      </fieldset>)}
    </section>

    {!compact && <>
      <section aria-labelledby="fee-preview-heading" className="overflow-hidden rounded-xl border border-outline-variant/60">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low px-4 py-3"><div><h3 id="fee-preview-heading" className="text-sm font-semibold">Class fee preview</h3><p className="mt-1 text-xs text-on-surface-variant">For one student, before concessions</p></div><Select aria-label="Preview class" value={grade} className="w-36" onChange={(event) => setPreviewGrade(event.target.value)}>{value.grades.map((classId) => <option key={classId} value={classId}>{classLabel(classId)}</option>)}</Select></div>
        <ul className="divide-y divide-outline-variant/40">{preview.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><div className="min-w-0"><p className="break-words font-medium">{item.name || "Untitled fee"}</p><p className="mt-0.5 text-xs text-on-surface-variant">{item.frequency}{!item.mandatory && " · Optional"}{item.newStudentsOnly && " · New admissions only"}</p></div><span className="font-mono">{inrFull(item.amount)} / collection</span></li>)}</ul>
        {preview.length === 0 && <p className="px-4 py-5 text-sm text-on-surface-variant">No fees assigned to this class.</p>}
        <div className="border-t border-outline-variant/60 bg-info-container/25 px-4 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">Mandatory recurring total / year</span><b className="text-lg text-secondary">{inrFull(recurringTotal(preview, value.termsPerYear))}</b></div><p className="mt-1 text-xs leading-5 text-on-surface-variant">Assumes 12 monthly collections or {value.termsPerYear} terms. Excludes optional, one-time, and new-admission-only fees.</p></div>
      </section>

      <section aria-labelledby="transport-fees-heading" className="space-y-3 rounded-xl border border-outline-variant/60 p-4">
        <div><h3 id="transport-fees-heading" className="font-semibold">Transport payments</h3><p className="mt-1 text-sm text-on-surface-variant">Amounts are set separately for each student in their Transport details. Choose how often those amounts are collected here.</p></div>
        <Field label="Transport collection frequency" hint="Saving this setting does not create invoices or charge families.">
          <Select value={value.transportFrequency ?? ""} onChange={(event) => onChange({ ...value, transportFrequency: event.target.value as FeeFrequency | "" })}>
            <option value="">Not configured</option>{FEE_FREQUENCIES.map((frequency) => <option key={frequency}>{frequency}</option>)}
          </Select>
        </Field>
      </section>

      <section aria-labelledby="payment-rules-heading" className="space-y-4 rounded-xl border border-outline-variant/60 p-4">
        <div><h3 id="payment-rules-heading" className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} className="text-secondary" aria-hidden="true" />Payment preferences</h3><p className="mt-1 text-sm text-on-surface-variant">Set your collection preferences for this academic year.</p></div>
        <Field label="Late fee per month (%)" hint="Set to 0 for no late fee. Review and add applicable late charges when issuing an invoice."><Input type="number" min={0} max={10} step={0.01} value={value.late} className="max-w-40" onChange={(event) => onChange({ ...value, late: Number(event.target.value) })} /></Field>
        <div className="divide-y divide-outline-variant/40 rounded-lg border border-outline-variant/60">
          <div className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-medium">UPI payments</p><p className="mt-0.5 text-xs text-on-surface-variant">Accept UPI when payment integration is enabled.</p></div><Switch checked={value.upi} onChange={(upi) => onChange({ ...value, upi })} label="UPI payments" /></div>
          <div className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-medium">Card payments</p><p className="mt-0.5 text-xs text-on-surface-variant">Accept cards when payment integration is enabled.</p></div><Switch checked={value.card} onChange={(card) => onChange({ ...value, card })} label="Card payments" /></div>
        </div>
      </section>
      <p className="flex items-start gap-2 rounded-lg bg-surface-container-low p-3 text-xs leading-5 text-on-surface-variant"><ArrowDownToLine size={15} className="mt-0.5 shrink-0" aria-hidden="true" />Save the fee plan now and set due dates when you start collection. Saving does not create invoices or charge families. Optional and admission-only items are billed individually.</p>
    </>}
  </fieldset>;
}
