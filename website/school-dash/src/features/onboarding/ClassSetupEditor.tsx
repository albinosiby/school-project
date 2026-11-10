"use client";
import { Checkbox, Field, Input, Select } from "@/components/ui";
import { isSeniorGrade, SENIOR_STREAMS, type StreamId } from "@/lib/academicStreams";
import { gradeCapacity, gradeName, sectionCount, type GradeCfg, type StreamCfg } from "./classSetup";

const counts = Array.from({ length: 9 }, (_, index) => index);
export function ClassSetupEditor({ value, onChange, disabled = false }: { value: GradeCfg[]; onChange: (value: GradeCfg[]) => void; disabled?: boolean }) {
  const edit = (grade: string, patch: Partial<GradeCfg>) => onChange(value.map((row) => row.grade === grade ? { ...row, ...patch } : row));
  const editStream = (row: GradeCfg, id: StreamId, patch: Partial<StreamCfg> | null) => {
    const previous = row.streams ?? [];
    const next = patch === null ? previous.filter((stream) => stream.id !== id) : previous.some((stream) => stream.id === id) ? previous.map((stream) => stream.id === id ? { ...stream, ...patch } : stream) : [...previous, { id, sections: 1, cap: row.cap || 30, ...patch }];
    const streams = SENIOR_STREAMS.flatMap((stream) => next.filter((item) => item.id === stream.id));
    edit(row.grade, { streams, sections: streams.reduce((sum, stream) => sum + stream.sections, 0) });
  };
  const active = value.filter((row) => sectionCount(row) > 0);
  return <fieldset disabled={disabled} className="min-w-0 space-y-6">
    <legend className="sr-only">Class and stream configuration</legend>
    <section aria-labelledby="regular-classes-heading">
      <h3 id="regular-classes-heading" className="mb-1 font-semibold">LKG to Grade 10</h3>
      <p className="mb-4 text-sm text-on-surface-variant">Set sections and seat capacity for each class.</p>
      <div className="overflow-x-auto rounded-lg border border-outline-variant/60"><table className="w-full text-left text-sm">
        <thead className="bg-surface-container-low"><tr><th className="px-4 py-2.5">Class</th><th className="px-4 py-2.5">Sections</th><th className="px-4 py-2.5">Seats / section</th><th className="px-4 py-2.5">Total seats</th></tr></thead>
        <tbody>{value.filter((row) => !isSeniorGrade(row.grade)).map((row) => <tr key={row.grade} className="border-t border-outline-variant/40">
          <td className="px-4 py-2 font-medium">{gradeName(row.grade)}</td>
          <td className="px-4 py-2"><Select aria-label={`${gradeName(row.grade)} sections`} value={row.sections} onChange={(event) => edit(row.grade, { sections: Number(event.target.value) })} className="w-24">{counts.map((count) => <option key={count} value={count}>{count || "—"}</option>)}</Select></td>
          <td className="px-4 py-2"><Input aria-label={`${gradeName(row.grade)} seats per section`} type="number" min={10} max={60} disabled={!row.sections} value={row.cap} onChange={(event) => edit(row.grade, { cap: Number(event.target.value) })} className="w-24" /></td>
          <td className="px-4 py-2 font-mono">{gradeCapacity(row) || "—"}</td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <section aria-labelledby="senior-classes-heading" className="space-y-4">
      <div><h3 id="senior-classes-heading" className="font-semibold">Grades 11 &amp; 12 · Streams</h3><p className="mt-1 text-sm leading-6 text-on-surface-variant">Choose the streams offered in each class, then set their sections and capacity. Section letters restart in every stream: Science A and Commerce A are separate classes.</p></div>
      {value.filter((row) => isSeniorGrade(row.grade)).map((row) => <fieldset key={row.grade} className="min-w-0 rounded-xl border border-outline-variant/60 p-4">
        <legend className="px-1 text-sm font-semibold">{gradeName(row.grade)}</legend>
        {!!row.sections && !row.streams?.length && <p className="mb-3 text-xs text-warning">This class has older section settings. Choose its streams before saving. Existing student records will be retained.</p>}
        <div className="space-y-3">{SENIOR_STREAMS.map((stream) => {
          const current = row.streams?.find((item) => item.id === stream.id);
          return <fieldset key={stream.id} className="min-w-0 rounded-lg border border-outline-variant/50 p-3">
            <legend className="sr-only">{gradeName(row.grade)} {stream.name}</legend>
            <label className="mb-3 flex min-h-8 items-center gap-2 text-sm font-medium"><Checkbox checked={!!current} onChange={(event) => editStream(row, stream.id, event.target.checked ? {} : null)} />{stream.name}</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Sections"><Select aria-label={`${gradeName(row.grade)} ${stream.name} sections`} disabled={!current} value={current?.sections ?? 0} onChange={(event) => editStream(row, stream.id, { sections: Number(event.target.value) })}>{counts.map((count) => <option key={count} value={count}>{count ? `${count} ${count === 1 ? "section" : "sections"}` : "None"}</option>)}</Select></Field>
              <Field label="Seats per section"><Input aria-label={`${gradeName(row.grade)} ${stream.name} seats per section`} type="number" min={10} max={60} disabled={!current || !current.sections} value={current?.cap ?? row.cap} onChange={(event) => editStream(row, stream.id, { cap: Number(event.target.value) })} /></Field>
            </div>
          </fieldset>;
        })}</div>
      </fieldset>)}
    </section>
    <p className="text-sm text-on-surface-variant">{active.length} classes · {active.reduce((sum, row) => sum + sectionCount(row), 0)} sections · <b className="text-on-surface">{active.reduce((sum, row) => sum + gradeCapacity(row), 0).toLocaleString("en-IN")}</b> total seats</p>
  </fieldset>;
}
