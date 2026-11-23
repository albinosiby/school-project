"use client";
// Staff portal › Parent messages: the teacher's msg_threads (teacherId == staffId) with the guardians of her students,
// the messages of a thread (msg_messages, listed by teacherId and grouped client-side), sending (create a message +
// reset the own unread counter, the only thread update a teacher may write) and starting a thread with a student who
// has a parent login (thr_{studentId}_{staffId}, parentUids = the student's guardianUids). Mirrors MessagesAdapter.
import { useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Select, Textarea, useToast } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { useCollection } from "@/lib/useCollection";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";
import { classIdLabel } from "@/lib/academicStreams";
import { messageDoc, messageableStudents, myClassIds, threadDoc, threadIdOf, threadMessages, threadReadPatch, threadRole, type MessageDoc, type StudentDoc, type ThreadDoc } from "../exams";

type Teaching = { id: string; teacherId?: string; classId?: string; subject?: string };
const when = (iso: string) => (iso ? iso.slice(0, 16).replace("T", " ") : "");

export function MessagesView() {
  const toast = useToast();
  const { user } = useAuth();
  const { staffId, teaching, name, record } = useStaffProfile();
  const threadStore = useCollection<ThreadDoc>("msg_threads", teaching, [["teacherId", "==", staffId]]);
  const messageStore = useCollection<MessageDoc>("msg_messages", teaching, [["teacherId", "==", staffId]]);
  // the queries already carry the rules' teacherId filter; keep the same guard client-side
  const threads = { ...threadStore, rows: threadStore.rows.filter((t) => t.teacherId === staffId) };
  const messages = { ...messageStore, rows: messageStore.rows.filter((m) => m.teacherId === staffId) };
  const students = useCollection<StudentDoc>("students", teaching);
  const classes = useCollection<{ id: string; classTeacherId?: string }>("classes", teaching);
  const assignments = useCollection<Teaching>("assignments", teaching, [["teacherId", "==", staffId]]);
  const periods = useCollection<Teaching>("ops_periods", teaching, [["teacherId", "==", staffId]]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [composing, setComposing] = useState(false);
  const [newStudentId, setNewStudentId] = useState("");
  const [firstText, setFirstText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!teaching) return <EmptyState title="Only teachers message parents" hint="Parent conversations belong to the student's teachers." />;

  const studentOf = (t: ThreadDoc) => students.rows.find((s) => s.id === t.studentId);
  const nameOf = (t: ThreadDoc) => t.studentName || studentOf(t)?.name || t.studentId;
  const lastOf = (t: ThreadDoc) => { const ms = threadMessages(messages.rows, t.id); return ms[ms.length - 1]; };
  const sorted = [...threads.rows].sort((a, b) => (lastOf(b)?.at ?? b.updatedAt ?? "").localeCompare(lastOf(a)?.at ?? a.updatedAt ?? ""));
  const selected = selectedId ? threads.rows.find((t) => t.id === selectedId) : undefined;
  const thread = selected ? threadMessages(messages.rows, selected.id) : [];
  const classIds = myClassIds(staffId, assignments.rows, periods.rows, classes.rows);
  const candidates = messageableStudents(students.rows, classIds);
  const fail = (error: unknown, fallback: string) => toast(error instanceof Error && error.message ? error.message : fallback, "error");

  const markRead = async (t: ThreadDoc) => {
    if (!(t.unreadTeacher ?? 0)) return;
    try { await threads.update(t.id, threadReadPatch()); } catch (error) { fail(error, "Could not update the thread"); }
  };
  const open = (t: ThreadDoc) => { setSelectedId(t.id); setText(""); void markRead(t); };
  const sendTo = async (t: ThreadDoc, body: string) => {
    const now = new Date().toISOString();
    await messages.create(messageDoc(t, user?.id ?? "", name, body, now));
    // the reply is read on this side: reset the own counter (also stamps updatedAt / updatedBy on the thread)
    await threads.update(t.id, threadReadPatch());
  };
  const send = async () => {
    if (!selected || !text.trim()) return;
    setBusy(true);
    try { await sendTo(selected, text); setText(""); } catch (error) { fail(error, "Could not send the message"); }
    finally { setBusy(false); }
  };
  const startThread = async () => {
    const student = candidates.find((s) => s.id === newStudentId);
    if (!student) return toast("Pick a student", "error");
    if (student.blocked) return toast(student.blocked, "error");
    setBusy(true);
    try {
      const id = threadIdOf(student.id, staffId);
      let t = threads.rows.find((row) => row.id === id);
      if (!t) {
        const now = new Date().toISOString();
        const role = threadRole(student.classId ?? "", staffId, classes.rows, assignments.rows, record?.subjects || record?.department || "Teacher");
        t = await threads.create({ id, ...threadDoc(student, staffId, name, role, now) } as ThreadDoc);
      }
      if (firstText.trim()) await sendTo(t, firstText);
      setComposing(false); setNewStudentId(""); setFirstText("");
      setSelectedId(id); setText("");
      toast(firstText.trim() ? "Message sent" : "Conversation started");
    } catch (error) { fail(error, "Could not start the conversation"); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <PageHeader title="Parent messages" subtitle="Conversations with the guardians of your students." actions={<Button onClick={() => setComposing(true)}>New thread</Button>} />
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card className="max-h-[70vh] overflow-y-auto">
        {!threads.ready ? <p className="p-4 text-on-surface-variant">Loading…</p>
          : !sorted.length ? <EmptyState title="No conversations yet" hint="Start a thread with a student's guardian." />
          : <ul className="divide-y divide-outline-variant/60">
            {sorted.map((t) => {
              const last = lastOf(t);
              const unread = t.unreadTeacher ?? 0;
              return <li key={t.id}>
                <button type="button" aria-label={`Open thread with ${nameOf(t)}`} onClick={() => open(t)}
                  className={`flex w-full cursor-pointer items-start justify-between gap-2 px-4 py-3 text-left hover:bg-surface-container-low ${t.id === selectedId ? "bg-info-container/40" : ""}`}>
                  <div className="min-w-0">
                    <p className="font-semibold">{nameOf(t)}</p>
                    <p className="text-xs text-on-surface-variant">{[t.classId && classIdLabel(t.classId), t.guardian || studentOf(t)?.guardian].filter(Boolean).join(" · ")}</p>
                    {last && <p className="truncate text-xs text-outline">{last.from === "teacher" ? "You: " : ""}{last.text}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-outline">
                    <span>{when(last?.at ?? t.updatedAt ?? "")}</span>
                    {unread > 0 && <span aria-label={`${unread} unread from ${nameOf(t)}`}><Badge tone="brand">{unread}</Badge></span>}
                  </div>
                </button>
              </li>;
            })}
          </ul>}
      </Card>
      <Card className="flex min-h-[50vh] flex-col">
        {!selected ? <EmptyState title="Select a conversation" hint="Messages with the guardian appear here." />
          : <>
            <div className="border-b border-outline-variant/60 p-4">
              <p className="font-semibold">{nameOf(selected)}</p>
              <p className="text-xs text-on-surface-variant">{[selected.classId && classIdLabel(selected.classId), selected.guardian || studentOf(selected)?.guardian, selected.role].filter(Boolean).join(" · ")}</p>
            </div>
            <ul className="flex-1 space-y-2 overflow-y-auto p-4" aria-label="Messages">
              {!thread.length && <li className="text-sm text-on-surface-variant">No messages yet. Say hello.</li>}
              {thread.map((m) => <li key={m.id} className={`flex ${m.from === "teacher" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.from === "teacher" ? "bg-info-container text-on-surface" : "bg-surface-container-low"}`}>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <p className="mt-1 text-[11px] text-outline">{m.from === "teacher" ? "You" : m.name || selected.guardian || "Parent"} · {when(m.at)}</p>
                </div>
              </li>)}
            </ul>
            <div className="flex items-end gap-2 border-t border-outline-variant/60 p-3">
              <Textarea aria-label="Message" value={text} placeholder="Write a message to the guardian…" className="min-h-16" onChange={(e) => setText(e.target.value)} />
              <Button onClick={send} disabled={busy || !text.trim()}>Send</Button>
            </div>
          </>}
      </Card>
    </div>
    <Modal open={composing} onClose={() => setComposing(false)} title="New thread" subtitle="Message the guardian of one of your students"
      footer={<><Button variant="ghost" onClick={() => setComposing(false)}>Close</Button><Button onClick={startThread} disabled={busy}>Start</Button></>}>
      <div className="space-y-4">
        <Field label="Student" required hint="Guardians without a parent app login cannot be messaged yet">
          <Select value={newStudentId} onChange={(e) => setNewStudentId(e.target.value)}>
            <option value="">Select student</option>
            {candidates.map((s) => <option key={s.id} value={s.id} disabled={!!s.blocked}>{s.name} · {s.classId ? classIdLabel(s.classId) : ""}{s.blocked ? ` (${s.blocked})` : ""}</option>)}
          </Select>
        </Field>
        <Field label="First message"><Textarea value={firstText} placeholder="Optional" onChange={(e) => setFirstText(e.target.value)} /></Field>
      </div>
    </Modal>
  </div>;
}
