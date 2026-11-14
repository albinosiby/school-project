"use client";
// Results tab (contract section 3): one card per class with its sheet approval count, compiled class result (status,
// version, stale flag, pass %) and the Compile → Approve → Publish → Withdraw buttons; below it the existing
// ExamSummary grid for the selected class with the "Term so far" column from exm_results.term.pct.
import { useState } from "react";
import { CheckCircle2, FileCheck2, RotateCcw, Send } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Textarea, useToast, type Tone } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { useSchoolClock } from "@/lib/useSchoolClock";
import { classIdLabel } from "@/lib/academicStreams";
import { examAction } from "./examService";
import { ExamSummary } from "./ExamSummary";
import { publicationDate } from "./publicationTime";
import { classResultActions, noteError, sheetCounts, type ClassResult, type Sheet, type StudentResult } from "./sheets";
import type { Candidate, Cycle, Mark, Paper } from "./types";

const resultTone = (status?: ClassResult["status"]): Tone =>
  status === "Published" ? "success" : status === "Approved" ? "brand" : status === "Compiled" ? "info" : "neutral";
const fmtAt = (iso?: string) => (iso ? iso.slice(0, 16).replace("T", " ") : "");

type ClassCard = { classId: string; label: string; sheets: Sheet[]; result?: ClassResult };

export function ClassResultsPanel({ cycle, papers, candidates, marks }: { cycle: Cycle; papers: Paper[]; candidates: Candidate[]; marks: Mark[] }) {
  const toast = useToast();
  const { timezone } = useSchoolClock();
  const sheets = useCollection<Sheet>("exm_sheets", true, [["cycleId", "==", cycle.id]]).rows.filter((s) => s.cycleId === cycle.id);
  const classResults = useCollection<ClassResult>("exm_class_results", true, [["cycleId", "==", cycle.id]]).rows.filter((r) => r.cycleId === cycle.id);
  const results = useCollection<StudentResult>("exm_results", true, [["cycleId", "==", cycle.id]]).rows.filter((r) => r.cycleId === cycle.id && !/__v\d+$/.test(r.id)); // archived versions keep the canonical id + "__v{n}"
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState("");
  const [modal, setModal] = useState<{ kind: "publish" | "withdraw"; card: ClassCard } | null>(null);
  const [publishAt, setPublishAt] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const tz = cycle.publicationTimezone || timezone;

  const classIds = [...new Set([...sheets.map((s) => s.classId), ...classResults.map((r) => r.classId)])];
  const cards: ClassCard[] = classIds
    .map((classId) => {
      const own = sheets.filter((s) => s.classId === classId), result = classResults.find((r) => r.classId === classId);
      return { classId, label: result?.classLabel || own[0]?.classLabel || classIdLabel(classId), sheets: own, result };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
  const current = cards.find((c) => c.classId === selected) ?? cards[0];
  const close = () => { setModal(null); setPublishAt(""); setReason(""); setTouched(false); };

  const run = async (card: ClassCard, action: string, payload: Record<string, unknown>, message: string) => {
    setBusy(card.classId + action);
    try {
      await examAction(cycle.id, action, payload);
      close();
      toast(message);
    } catch (e) { toast(e instanceof Error ? e.message : "Could not update the class result", "error"); } finally { setBusy(""); }
  };
  const publishError = publishAt && Number.isNaN(+publicationDate(publishAt, tz)) ? "Enter a valid date and time" : "";
  const publish = (card: ClassCard) => {
    if (publishError) return;
    const when = publishAt ? publicationDate(publishAt, tz) : null;
    if (when && +when <= Date.now()) { setTouched(true); return toast("The scheduled time has already passed; leave it blank to publish now", "error"); }
    return run(card, "publishResults", { classIds: [card.classId], ...(when ? { publishAt: when.toISOString() } : {}) },
      when ? `${card.label} results scheduled for ${publishAt.replace("T", " ")} (${tz})` : `${card.label} results published to parents`);
  };
  const reasonError = noteError(reason);

  // "Term so far" from exm_results.term.pct for the selected class (shown only when the server has computed it)
  const termPct = Object.fromEntries(results.filter((r) => r.term && r.classId === current?.classId).map((r) => [r.studentId, r.term!.pct]));
  const classCandidates = current ? candidates.filter((c) => (c.classId || "") === current.classId || c.cls === current.label) : candidates;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Class results"
          subtitle="Compile a class once every mark sheet is approved, then sign off and publish. Reopening a sheet marks the compiled result stale until it is compiled again." />
        {!cards.length ? (
          <EmptyState title="No classes to compile yet" hint="Open marks entry on the Marks Entry tab; class results appear here once sheets exist." />
        ) : (
          <div className="grid gap-4 px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
              const counts = sheetCounts(card.sheets), actions = classResultActions(card.result, cycle, card.sheets), r = card.result;
              const busyHere = busy.startsWith(card.classId);
              return (
                <div key={card.classId} role="group" aria-label={`Class ${card.label}`}
                  className={`rounded-lg border p-4 ${current?.classId === card.classId ? "border-secondary bg-info-container/20" : "border-outline-variant/60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="cursor-pointer text-left text-lg font-semibold hover:underline" onClick={() => setSelected(card.classId)}>{card.label}</button>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Badge tone={resultTone(r?.status)}>{r ? r.status : "Not compiled"}</Badge>
                      {r && <Badge>v{r.version}</Badge>}
                      {r?.stale && <Badge tone="warning">Stale</Badge>}
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    <dt className="text-on-surface-variant">Sheets approved</dt><dd className="font-semibold">{counts.approved} / {counts.total}</dd>
                    <dt className="text-on-surface-variant">Pass %</dt><dd className="font-semibold">{r?.passPct != null ? `${r.passPct}%` : "—"}</dd>
                    {r && <><dt className="text-on-surface-variant">Students</dt><dd>{r.students} · {r.passed} pass · {r.failed} fail{r.incomplete ? ` · ${r.incomplete} incomplete` : ""}</dd></>}
                    {r?.publishAt && r.status !== "Published" && <><dt className="text-on-surface-variant">Scheduled</dt><dd>{`${fmtAt(r.publishAt)} UTC`}</dd></>}
                    {r?.publishedAt && <><dt className="text-on-surface-variant">Published</dt><dd>{`${fmtAt(r.publishedAt)} UTC`}</dd></>}
                  </dl>
                  {actions.reason && <p className="mt-3 text-xs text-on-surface-variant">{actions.reason}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {actions.canCompile && (
                      <Button size="sm" variant={r ? "outline" : "primary"} disabled={busyHere}
                        onClick={() => run(card, "compile", { classId: card.classId }, `${card.label} compiled${r ? ` (version ${r.status === "Published" ? r.version + 1 : Math.max(r.version, 1)})` : ""}; sheets locked`)}>
                        <FileCheck2 size={14} />{r ? "Recompile" : "Compile"}
                      </Button>
                    )}
                    {actions.canApprove && (
                      <Button size="sm" disabled={busyHere} onClick={() => run(card, "signOff", { classId: card.classId }, `${card.label} results approved`)}>
                        <CheckCircle2 size={14} />Approve
                      </Button>
                    )}
                    {actions.canPublish && (
                      <Button size="sm" disabled={busyHere} onClick={() => setModal({ kind: "publish", card })}><Send size={14} />Publish…</Button>
                    )}
                    {actions.canWithdraw && (
                      <Button size="sm" variant="outline" disabled={busyHere} onClick={() => setModal({ kind: "withdraw", card })}><RotateCcw size={14} />Withdraw…</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      {current && (
        <ExamSummary key={current.classId} cycle={cycle} papers={papers} candidates={classCandidates} marks={marks}
          initialClass={current.label} termPct={Object.keys(termPct).length ? termPct : undefined} />
      )}
      <Modal open={modal?.kind === "publish"} onClose={close} title={`Publish ${modal?.card.label ?? ""} results`}
        subtitle="Parents receive the full result card. Leave the time blank to publish now."
        footer={<>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button disabled={!!busy || !!publishError} onClick={() => modal && publish(modal.card)}>{publishAt ? "Schedule publication" : "Publish now"}</Button>
        </>}>
        <Field label="Publish at" hint={`${tz}. Optional.`} error={touched ? publishError : ""}>
          <Input type="datetime-local" value={publishAt} onChange={(e) => { setPublishAt(e.target.value); setTouched(true); }} />
        </Field>
      </Modal>
      <Modal open={modal?.kind === "withdraw"} onClose={close} title={`Withdraw ${modal?.card.label ?? ""} results`}
        subtitle="Results go back to Approved and disappear from the parent app until published again. Use this before a correction when stale results must not stay visible."
        footer={<>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="danger" disabled={!!busy || !!reasonError}
            onClick={() => modal && run(modal.card, "withdrawResults", { classId: modal.card.classId, reason: reason.trim() }, `${modal.card.label} results withdrawn`)}>
            Withdraw results
          </Button>
        </>}>
        <Field label="Reason" required error={touched ? reasonError : ""} hint="5 to 2000 characters">
          <Textarea value={reason} maxLength={2000} onChange={(e) => { setReason(e.target.value); setTouched(true); }} />
        </Field>
      </Modal>
    </div>
  );
}
