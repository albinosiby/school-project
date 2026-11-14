"use client";
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { classIdLabel } from "@/lib/academicStreams";
import { scheduleErrors } from "../../../../functions/examOperations";
import { endTime, type Cycle, type Paper } from "./types";
import { examAction, type ScheduleHistory } from "./examService";
import type { Duty } from "./ExamDuties";

export function ScheduleManager({
  cycle,
  papers,
  allPapers,
}: {
  cycle: Cycle;
  papers: Paper[];
  allPapers: Paper[];
}) {
  const history = useCollection<ScheduleHistory>("exm_schedule_history", true, [["cycleId", "==", cycle.id]]);
  const staff = useCollection<{ id: string; name: string; status?: string }>("staff").rows.filter(
    (s) => !/inactive|resigned|terminated|retired|left/i.test(s.status || ""),
  );
  const duties = useCollection<Duty>("exm_duties").rows;
  const [chosen, setChosen] = useState<Paper[] | null>(null);
  const live = cycle.status !== "Draft" && cycle.publicationState !== "scheduled";
  const movable = papers.filter(
    (p) => p.scheduleStatus !== "Cancelled" && p.status !== "Completed" && !p.published?.length,
  );
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Timetable & rescheduling"
          subtitle="Every change keeps the original timetable, reason and actor in history. Times use the school's timezone."
          actions={
            <Button variant="outline" disabled={!live || !movable.length} onClick={() => setChosen(movable)}>
              <CalendarClock size={16} />
              Reschedule examination
            </Button>
          }
        />
        <DataTable
          rows={papers}
          columns={[
            {
              key: "subject",
              header: "Paper / divisions",
              render: (p) => (
                <div className="font-semibold">
                  {p.subject}
                  <span className="block text-xs font-normal text-outline">
                    {p.classIds?.map(classIdLabel).join(", ") || `Grade ${p.grade}`}
                  </span>
                </div>
              ),
            },
            {
              key: "date",
              header: "Date & time",
              sortValue: (p) => p.date + p.start,
              render: (p) =>
                p.date ? (
                  <span>
                    {p.date}
                    <span className="block text-xs text-outline">
                      {p.start} – {endTime(p.start, p.duration)}
                    </span>
                  </span>
                ) : (
                  "New date pending"
                ),
            },
            {
              key: "venue",
              header: "Room / chief",
              render: (p) => (
                <div>
                  {p.venue || "Unassigned"}
                  <span className="block text-xs text-outline">{p.invigilator || "Chief unassigned"}</span>
                </div>
              ),
            },
            {
              key: "state",
              header: "Paper status",
              render: (p) => (
                <Badge
                  tone={
                    p.scheduleStatus === "Postponed"
                      ? "warning"
                      : p.scheduleStatus === "Cancelled"
                        ? "danger"
                        : p.status === "Completed"
                          ? "success"
                          : "neutral"
                  }
                >
                  {p.scheduleStatus && p.scheduleStatus !== "Scheduled" ? p.scheduleStatus : p.status}
                </Badge>
              ),
            },
            {
              key: "action",
              header: "",
              render: (p) => (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!live || p.status === "Completed" || !!p.published?.length}
                  onClick={() => setChosen([p])}
                >
                  Change schedule
                </Button>
              ),
            },
          ]}
          empty={
            <EmptyState
              title="No papers configured"
              hint="Configure subject papers in the exam setup wizard."
            />
          }
        />
      </Card>
      <Card>
        <CardHeader title="Schedule history" subtitle="Approved changes and notification queue status" />
        <DataTable
          rows={[...history.rows].sort((a, b) => b.at.localeCompare(a.at))}
          columns={[
            { key: "paper", header: "Paper", render: (h) => h.subject },
            {
              key: "previous",
              header: "Previous",
              render: (h) =>
                `${h.previous.date || "Unscheduled"} ${h.previous.start || ""} · ${h.previous.venue || "No room"}`,
            },
            {
              key: "next",
              header: "New schedule",
              render: (h) =>
                `${h.next.scheduleStatus} · ${h.next.date || "Date pending"} ${h.next.start || ""} · ${h.next.venue || "No room"}`,
            },
            {
              key: "reason",
              header: "Reason",
              render: (h) => (
                <span>
                  {h.reason}
                  {h.notes && <span className="block text-xs text-outline">{h.notes}</span>}
                </span>
              ),
            },
            {
              key: "actor",
              header: "Changed by",
              render: (h) => (
                <span>
                  {h.actorName}
                  <span className="block text-xs text-outline">
                    {h.at.slice(0, 16).replace("T", " ")} UTC
                  </span>
                </span>
              ),
            },
            {
              key: "notification",
              header: "Notification",
              render: (h) => (
                <Badge tone={h.notificationStatus === "Failed" ? "danger" : "neutral"}>
                  {h.notificationStatus}
                </Badge>
              ),
            },
          ]}
        />
      </Card>
      {chosen && (
        <RescheduleDialog
          key={chosen.map((p) => p.id).join("_")}
          cycle={cycle}
          chosen={chosen}
          allPapers={allPapers}
          duties={duties}
          staff={staff}
          onClose={() => setChosen(null)}
        />
      )}
    </div>
  );
}

function RescheduleDialog({
  cycle,
  chosen,
  allPapers,
  duties,
  staff,
  onClose,
}: {
  cycle: Cycle;
  chosen: Paper[];
  allPapers: Paper[];
  duties: Duty[];
  staff: { id: string; name: string }[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [changes, setChanges] = useState(
    chosen.map((p) => ({ ...p, scheduleStatus: "Scheduled" as NonNullable<Paper["scheduleStatus"]> })),
  );
  const [mode, setMode] = useState("Scheduled");
  const [window, setWindow] = useState({ start: cycle.start, end: cycle.end });
  const [reason, setReason] = useState(""),
    [notes, setNotes] = useState("");
  const [notify, setNotify] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const all = chosen.length > 1;
  const update = (id: string, patch: Partial<Paper>) =>
    setChanges((current) => current.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const submit = async () => {
    setError("");
    if (reason.trim().length < 5) return setError("Enter a reason with at least five characters.");
    const next = changes.map((p) => ({ ...p, scheduleStatus: mode as Paper["scheduleStatus"] }));
    const errors = scheduleErrors(next, allPapers, duties, window);
    if (errors.length) return setError(errors.join("\n"));
    setBusy(true);
    try {
      await examAction(cycle.id, "schedule", {
        changes: next.map((p) => ({
          paperId: p.id,
          revision: p.scheduleRevision || 0,
          date: p.date,
          start: p.start,
          duration: p.duration,
          venue: p.venue,
          invigilatorId: p.invigilatorId || "",
          scheduleStatus: p.scheduleStatus,
        })),
        window,
        reason,
        notes,
        notify,
      });
      toast(
        mode === "Postponed" ? "Examination postponed; history saved" : "Timetable updated; history saved",
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update timetable");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={all ? "Reschedule examination" : "Change paper schedule"}
      subtitle={`${cycle.title} · ${chosen.length} paper(s)`}
      width="max-w-4xl"
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Confirm change"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Action">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="Scheduled">Reschedule / change room or chief</option>
            <option value="Postponed">Postpone without a new date</option>
            {!all && <option value="Cancelled">Cancel paper</option>}
          </Select>
        </Field>
        {mode === "Scheduled" && all && (
          <div className="rounded border border-outline-variant/60 p-4">
            <Field
              label="Move the first paper to"
              hint="Moves all selected papers by the same number of days and shifts the exam window."
            >
              <Input
                type="date"
                onChange={(e) => {
                  if (!e.target.value) return;
                  const first = [...chosen]
                    .filter((p) => p.date)
                    .sort((a, b) => a.date.localeCompare(b.date))[0];
                  if (!first) return;
                  const delta =
                    Date.parse(e.target.value + "T12:00:00Z") - Date.parse(first.date + "T12:00:00Z");
                  const shift = (date: string) =>
                    date ? new Date(Date.parse(date + "T12:00:00Z") + delta).toISOString().slice(0, 10) : "";
                  setChanges(chosen.map((p) => ({ ...p, date: shift(p.date), scheduleStatus: "Scheduled" })));
                  setWindow({
                    start: [cycle.start, shift(cycle.start)].sort()[0],
                    end: [cycle.end, shift(cycle.end)].sort().at(-1)!,
                  });
                }}
              />
            </Field>
          </div>
        )}
        {mode === "Scheduled" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Examination window starts">
              <Input
                type="date"
                value={window.start}
                onChange={(e) => setWindow({ ...window, start: e.target.value })}
              />
            </Field>
            <Field label="Examination window ends">
              <Input
                type="date"
                value={window.end}
                onChange={(e) => setWindow({ ...window, end: e.target.value })}
              />
            </Field>
          </div>
        )}
        {changes.map((p) => (
          <div key={p.id} className="rounded border border-outline-variant/60 p-4">
            <p className="font-semibold">
              Grade {p.grade} · {p.subject}
            </p>
            <p className="mt-1 text-xs text-outline">
              Existing: {chosen.find((c) => c.id === p.id)?.date || "Date pending"} ·{" "}
              {chosen.find((c) => c.id === p.id)?.start || "Time pending"} ·{" "}
              {chosen.find((c) => c.id === p.id)?.venue || "Room unassigned"}
            </p>
            {mode === "Scheduled" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Field label="New date">
                  <Input
                    type="date"
                    value={p.date}
                    onChange={(e) => update(p.id, { date: e.target.value })}
                  />
                </Field>
                <Field label="Start time">
                  <Input
                    type="time"
                    value={p.start}
                    onChange={(e) => update(p.id, { start: e.target.value })}
                  />
                </Field>
                <Field label="Duration (minutes)">
                  <Input
                    type="number"
                    min={1}
                    max={360}
                    value={Math.round(p.duration * 60)}
                    onChange={(e) => update(p.id, { duration: Number(e.target.value) / 60 })}
                  />
                </Field>
                <Field label="Room">
                  <Input value={p.venue} onChange={(e) => update(p.id, { venue: e.target.value })} />
                </Field>
                <Field label="Chief invigilator" className="sm:col-span-2">
                  <Select
                    value={p.invigilatorId || ""}
                    onChange={(e) => update(p.id, { invigilatorId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
          </div>
        ))}
        <Field label="Reason" required>
          <Textarea value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Additional notes">
          <Textarea value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Notify affected teachers, invigilators and families in the app
        </label>
        {error && (
          <p role="alert" className="whitespace-pre-line text-sm text-error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
