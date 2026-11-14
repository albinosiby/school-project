"use client";
// Settings → Assessment Scheme → Exam types (`set_exam_types`). What kinds of exam the school runs, which term
// each counts towards and with what weight. The exam wizard offers these in its Exam type picker.
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Checkbox, Field, Input, Modal, Select, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { examTypeError, examTypeId, newExamType, STARTER_EXAM_TYPES, termWeightTotals, type ExamType } from "@/features/exams/assessmentScheme";

type Term = { id: string; name: string; start?: string };
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message.replace(/^Firebase:\s*/, "") : "Unknown error");

export function ExamTypeSettings() {
  const toast = useToast();
  const types = useCollection<ExamType>("set_exam_types");
  const terms = useCollection<Term>("set_terms");
  const [edit, setEdit] = useState<ExamType | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!types.ready || !terms.ready) return <p className="text-sm text-on-surface-variant">Loading exam types…</p>;
  const sortedTerms = [...terms.rows].sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const rows = [...types.rows].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const totals = termWeightTotals(types.rows);
  const termName = (id: string) => terms.rows.find((term) => term.id === id)?.name ?? (id ? "Removed term" : "No term");

  const save = async () => {
    if (!edit) return;
    const problem = examTypeError(edit, types.rows);
    setError(problem);
    if (problem) return;
    const id = edit.id || examTypeId(edit.name);
    if (!edit.id && types.rows.some((row) => row.id === id)) return setError("Another exam type already uses this name");
    setBusy(true);
    try {
      const body = { ...edit, id, name: edit.name.trim(), short: edit.short.trim().toUpperCase() };
      if (edit.id) await types.update(id, body);
      else await types.create(body);
      toast("Exam type saved");
      setEdit(null);
    } catch (cause) {
      setError("Could not save: " + errText(cause));
    } finally {
      setBusy(false);
    }
  };
  const addStarter = async () => {
    setBusy(true);
    try {
      const first = sortedTerms[0]?.id ?? "", second = sortedTerms[1]?.id ?? first;
      for (const type of STARTER_EXAM_TYPES)
        await types.create({ ...type, id: examTypeId(type.name), termId: type.order <= 4 ? first : second });
      toast("Starter exam types added. Adjust weights and terms to match the school.");
    } catch (cause) {
      toast("Could not add exam types: " + errText(cause), "error");
    } finally {
      setBusy(false);
    }
  };
  const field = <K extends keyof ExamType>(key: K, value: ExamType[K]) => setEdit((current) => current && { ...current, [key]: value });

  return <section className="space-y-4" aria-label="Exam types">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold">Exam types</h3>
        <p className="text-sm text-on-surface-variant">Unit tests, half-yearly, annual… Each exam you create picks one of these, which sets its term, weight and marks pattern.</p></div>
      <div className="flex gap-2">
        {!rows.length && <Button variant="outline" size="sm" disabled={busy} onClick={addStarter}>Add CBSE starter set</Button>}
        <Button size="sm" disabled={busy} onClick={() => { setError(""); setEdit(newExamType(rows.length + 1)); }}><Plus size={14} />New exam type</Button>
      </div>
    </div>
    {!rows.length ? <p className="rounded-lg border border-dashed border-outline-variant p-4 text-sm text-on-surface-variant">No exam types yet. The exam wizard falls back to a fixed list until you add some.</p>
      : <div className="overflow-x-auto rounded-lg border border-outline-variant/60"><table className="w-full text-left text-sm">
        <thead className="bg-surface-container-low t-label-caps !text-[11px] text-on-surface-variant"><tr><th className="p-3">Exam type</th><th className="p-3">Term</th><th className="p-3">Weight</th><th className="p-3">Marks pattern</th><th className="p-3">Parents see</th><th className="p-3" /></tr></thead>
        <tbody>{rows.map((type) => <tr key={type.id} className="border-t border-outline-variant/50">
          <td className="p-3"><span className="font-semibold">{type.name}</span> <span className="font-mono text-xs text-outline">{type.short}</span>{!type.active && <Badge tone="neutral" className="ml-2">Inactive</Badge>}</td>
          <td className="p-3">{termName(type.termId)}</td>
          <td className="p-3 font-mono">{type.countsInTerm ? type.weight + "%" : "—"}</td>
          <td className="p-3">{type.pattern === "single" ? "Single paper out of " + type.singleMax : "As per subject scheme"}</td>
          <td className="p-3">{type.shareSubjectWise ? "Each subject as approved" : "Full result on result day"}</td>
          <td className="p-3 text-right"><Button size="sm" variant="ghost" aria-label={"Edit " + type.name} onClick={() => { setError(""); setEdit(type); }}>Edit</Button></td>
        </tr>)}</tbody></table></div>}
    {sortedTerms.length > 0 && rows.length > 0 && <ul className="flex flex-wrap gap-2 text-xs">
      {sortedTerms.map((term) => { const total = totals[term.id] ?? 0; return <li key={term.id}><Badge tone={total === 100 ? "success" : "warning"}>{term.name}: {total}% of 100</Badge></li>; })}
    </ul>}

    <Modal open={!!edit} onClose={() => !busy && setEdit(null)} title={edit?.id ? "Edit exam type" : "New exam type"}
      footer={<><Button variant="ghost" disabled={busy} onClick={() => setEdit(null)}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save exam type"}</Button></>}>
      {edit && <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required><Input value={edit.name} maxLength={60} onChange={(e) => field("name", e.target.value)} /></Field>
        <Field label="Short code" required hint="Printed on report cards, e.g. PT1"><Input value={edit.short} maxLength={8} onChange={(e) => field("short", e.target.value)} /></Field>
        <Field label="Term"><Select value={edit.termId} onChange={(e) => field("termId", e.target.value)}>
          <option value="">No term</option>{sortedTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</Select></Field>
        <Field label="Weight in term (%)" hint="Share of the term result"><Input type="number" min={0} max={100} value={edit.weight} onChange={(e) => field("weight", Number(e.target.value))} /></Field>
        <Field label="Marks pattern"><Select value={edit.pattern} onChange={(e) => field("pattern", e.target.value as ExamType["pattern"])}>
          <option value="scheme">As per subject scheme (theory / practical / internal)</option>
          <option value="single">Single paper out of fixed marks</option></Select></Field>
        {edit.pattern === "single" && <Field label="Maximum marks per subject"><Input type="number" min={1} value={edit.singleMax} onChange={(e) => field("singleMax", Number(e.target.value))} /></Field>}
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={edit.shareSubjectWise} onChange={(e) => field("shareSubjectWise", e.target.checked)} />Share each subject&apos;s marks with parents as soon as its sheet is approved (unit tests)</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={edit.countsInTerm} onChange={(e) => field("countsInTerm", e.target.checked)} />Counts towards the term result</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={edit.active} onChange={(e) => field("active", e.target.checked)} />Active</label>
        {error && <p role="alert" className="text-sm text-error sm:col-span-2">{error}</p>}
      </div>}
    </Modal>
  </section>;
}
