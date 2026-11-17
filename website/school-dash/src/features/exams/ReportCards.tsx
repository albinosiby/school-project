"use client";
import Image from "next/image";
import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { LoadingSkeleton,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  DataTable,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { classIdLabel } from "@/lib/academicStreams";
import { consolidated, readyForReport, type ResultRow } from "../../../../functions/examOperations";
import { downloadReport, examAction, type ReportBatch, type ReportTemplate } from "./examService";
import type { Candidate, Cycle, Mark, Paper } from "./types";

type Remark = {
  id: string;
  studentId: string;
  cycleId: string;
  classTeacher?: string;
  principal?: string;
  attendancePresent?: number | null;
  attendanceTotal?: number | null;
};
type ReportCard = ResultRow & {
  batchId: string;
  exam: string;
  academicYear: string;
  school: { name: string; city: string };
  template: ReportTemplate;
  remarks: Remark;
  status: string;
};
const initialTemplate: ReportTemplate = {
  id: "standard",
  name: "Standard report card",
  classIds: [],
  showComponents: true,
  showAttendance: false,
  showRemarks: true,
  showRank: true,
  teacherSignature: "Class teacher",
  principalSignature: "Principal",
  footer: "",
};

export function ReportCards({
  cycle,
  papers,
  candidates,
  marks,
}: {
  cycle: Cycle;
  papers: Paper[];
  candidates: Candidate[];
  marks: Mark[];
}) {
  const toast = useToast();
  const batches = useCollection<ReportBatch>("exm_report_batches", true, [["cycleId", "==", cycle.id]]).rows;
  const templates = useCollection<ReportTemplate>("exm_report_templates").rows;
  const remarks = useCollection<Remark>("exm_report_remarks", true, [["cycleId", "==", cycle.id]]).rows;
  const cards = useCollection<ReportCard>("exm_report_cards", true, [["cycleId", "==", cycle.id]]).rows;
  const classes = useCollection<{ id: string; streamId?: string; stream?: string }>("classes").rows;
  const resultRows = consolidated(cycle, papers, candidates, marks, classes);
  const divisions = [...new Set(resultRows.map((r) => r.classId))];
  const [chosenClass, setChosenClass] = useState(""),
    [templateId, setTemplateId] = useState("");
  const [template, setTemplate] = useState<ReportTemplate | null>(null),
    [remarkFor, setRemarkFor] = useState<ResultRow | null>(null);
  const [previewId, setPreviewId] = useState(""),
    [studentId, setStudentId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const cls = divisions.includes(chosenClass) ? chosenClass : divisions[0] || "";
  const students = resultRows.filter((r) => r.classId === cls);
  const ready = students.filter((r) => readyForReport(r, cycle.resultRules)).length;
  const previewCards = cards.filter((c) => c.batchId === previewId);
  const preview = previewCards.find((c) => c.studentId === studentId) || previewCards[0];
  const perform = async (action: string, payload: Record<string, unknown>) => {
    setError("");
    setBusy(true);
    try {
      const response = await examAction(cycle.id, action, payload);
      if (response.batchId) setPreviewId(response.batchId);
      toast("Report workflow updated");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete this action");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const download = async (batchId: string, studentId?: string) => {
    setError("");
    setBusy(true);
    try {
      await downloadReport(batchId, studentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download report");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Consolidated report cards"
          subtitle="Preview → submit → approve → publish. Report cards have their own publication history."
          actions={
            <Button
              variant="outline"
              onClick={() => setTemplate({ ...initialTemplate, id: `tpl_${crypto.randomUUID()}` })}
            >
              <Plus size={15} />
              New template
            </Button>
          }
        />
        <div className="space-y-4 px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Division">
              <Select value={cls} onChange={(e) => setChosenClass(e.target.value)}>
                {!divisions.length && <option value="">No participating divisions</option>}
                {divisions.map((id) => (
                  <option key={id} value={id}>
                    {classIdLabel(id)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Report template">
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Division template / school default</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={ready === students.length && ready > 0 ? "success" : "warning"}>
              {ready} / {students.length} students ready
            </Badge>
            <span className="text-sm text-on-surface-variant">
              Complete and verify every required assessment first.
            </span>
            <Button
              className="ml-auto"
              disabled={busy || !students.length || ready !== students.length}
              onClick={() => perform("prepare", { classId: cls, templateId })}
            >
              Generate result preview
            </Button>
          </div>
          {cycle.resultRules?.requireApproval && (
            <p className="text-xs text-outline">This examination requires approval before publication.</p>
          )}
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Publication versions"
          subtitle="Generate a new preview after changing marks, remarks, branding or template."
        />
        <DataTable
          rows={[...batches]
            .filter((b) => b.classId === cls)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
          columns={[
            {
              key: "date",
              header: "Preview created",
              render: (b) => (
                <span>
                  {b.createdAt.slice(0, 16).replace("T", " ")} UTC
                  <span className="block text-xs text-outline">
                    {b.students} students · {b.classLabel}
                  </span>
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (b) => (
                <Badge
                  tone={
                    b.status === "Published"
                      ? "success"
                      : b.status === "Pending approval"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {b.status}
                </Badge>
              ),
            },
            {
              key: "notifications",
              header: "Notifications",
              render: (b) => b.notificationStatus || "Not published",
            },
            {
              key: "actions",
              header: "Actions",
              render: (b) => (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPreviewId(b.id);
                      setStudentId("");
                    }}
                  >
                    Preview
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => download(b.id)}>
                    <Download size={13} />
                    Class PDF
                  </Button>
                  {b.status === "Preview" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => perform("submit", { batchId: b.id })}
                    >
                      Submit for approval
                    </Button>
                  )}
                  {b.status === "Pending approval" && (
                    <Button size="sm" disabled={busy} onClick={() => perform("approve", { batchId: b.id })}>
                      Approve
                    </Button>
                  )}
                  {!["Published", "Superseded"].includes(b.status) &&
                    (!cycle.resultRules?.requireApproval || b.status === "Approved") && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => perform("publishReport", { batchId: b.id, notify: true })}
                      >
                        Publish report cards
                      </Button>
                    )}
                </div>
              ),
            },
          ]}
        />
      </Card>
      <Card>
        <CardHeader
          title="Remarks & attendance"
          subtitle="Enter optional attendance days and report remarks before generating a preview."
        />
        <DataTable
          rows={students}
          searchText={(s) => `${s.name} ${s.grn}`}
          columns={[
            {
              key: "name",
              header: "Student",
              render: (s) => (
                <span>
                  {s.name}
                  <span className="block text-xs text-outline">{s.grn}</span>
                </span>
              ),
            },
            {
              key: "remarks",
              header: "Class teacher remarks",
              render: (s) => remarks.find((r) => r.studentId === s.studentId)?.classTeacher || "Not entered",
            },
            {
              key: "ready",
              header: "Review status",
              render: (s) => (
                <Badge tone={readyForReport(s, cycle.resultRules) ? "success" : "warning"}>
                  {readyForReport(s, cycle.resultRules) ? "Ready" : "Review marks"}
                </Badge>
              ),
            },
            {
              key: "edit",
              header: "",
              render: (s) => (
                <Button size="sm" variant="outline" onClick={() => setRemarkFor(s)}>
                  Edit remarks
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Card>
        <CardHeader
          title="Reusable templates"
          subtitle="Use a default for selected divisions or choose a template when generating a preview."
        />
        <DataTable
          rows={templates}
          columns={[
            { key: "name", header: "Template", render: (t) => t.name },
            {
              key: "classes",
              header: "Divisions",
              render: (t) => t.classIds?.map(classIdLabel).join(", ") || "Any division",
            },
            {
              key: "edit",
              header: "",
              render: (t) => (
                <Button size="sm" variant="outline" onClick={() => setTemplate(t)}>
                  Configure
                </Button>
              ),
            },
          ]}
        />
      </Card>
      {template && (
        <TemplateForm
          template={template}
          divisions={divisions}
          onClose={() => setTemplate(null)}
          onSave={async (t) => {
            if (await perform("template", { templateId: t.id, template: t })) setTemplate(null);
          }}
          busy={busy}
          error={error}
        />
      )}
      {remarkFor && (
        <RemarksForm
          student={remarkFor}
          existing={remarks.find((r) => r.studentId === remarkFor.studentId)}
          busy={busy}
          error={error}
          onClose={() => setRemarkFor(null)}
          onSave={async (r) => {
            if (await perform("remarks", { ...r, studentId: remarkFor.studentId })) setRemarkFor(null);
          }}
        />
      )}
      <Modal
        open={!!previewId}
        onClose={() => setPreviewId("")}
        title="Report card preview"
        width="max-w-4xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setPreviewId("")}>
              Close
            </Button>
            <Button disabled={!preview || busy} onClick={() => download(previewId, preview?.studentId)}>
              <Download size={16} />
              Download student PDF
            </Button>
          </>
        }
      >
        {preview ? (
          <>
            <Select
              aria-label="Preview student"
              value={preview.studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              {previewCards.map((c) => (
                <option key={c.id} value={c.studentId}>
                  {c.name}
                </option>
              ))}
            </Select>
            <SavedReportPreview card={preview} />
            <p className="mt-3 text-xs text-outline">
              Download the PDF to review the final A4 layout and school logo.
            </p>
          </>
        ) : (
          <LoadingSkeleton variant="image" label="Loading saved preview…" />
        )}
        {error && (
          <p role="alert" className="mt-3 text-error">
            {error}
          </p>
        )}
      </Modal>
    </div>
  );
}

function SavedReportPreview({ card: c }: { card: ReportCard }) {
  return (
    <div className="mt-5 border border-outline-variant bg-white p-6 text-slate-900 sm:p-10">
      <header className="border-b border-slate-200 pb-5">
        <h3 className="text-2xl font-bold">{c.school.name}</h3>
        <p>{c.school.city}</p>
        <p className="mt-4 text-xl font-semibold">{c.exam}</p>
        <p>
          {c.academicYear} · {c.status}
        </p>
      </header>
      <p className="my-5 font-semibold">
        {c.name} · {c.cls} · Admission no. {c.grn || "—"}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th>Subject</th>
              {c.template.showComponents && (
                <>
                  <th>Theory</th>
                  <th>Practical</th>
                  <th>Internal</th>
                </>
              )}
              <th>Total</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {c.entries.map(({ paper: p, mark: m, result: r }) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="py-3">{p.subject}</td>
                {c.template.showComponents && (
                  <>
                    <td>{p.theory ? `${m?.theory ?? "—"}/${p.theory}` : "—"}</td>
                    <td>{p.practical ? `${m?.practical ?? "—"}/${p.practical}` : "—"}</td>
                    <td>{p.internal ? `${m?.internal ?? "—"}/${p.internal}` : "—"}</td>
                  </>
                )}
                <td>
                  {r.total === null ? r.grade : `${r.total}/${p.theory + p.internal + (p.practical || 0)}`}
                </td>
                <td>{r.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-5 font-semibold">
        Total {c.total ?? "—"}/{c.maximum ?? "—"} · {c.pct === null ? "Grade only" : c.pct + "%"} · Grade{" "}
        {c.grade}
      </p>
      <p>
        Result: {c.passed ? "Pass" : "Fail"}
        {c.template.showRank && c.rank ? ` · Rank ${c.rank}` : ""}
      </p>
      {c.template.showAttendance && (
        <p className="mt-3">
          Attendance {c.remarks?.attendancePresent ?? "—"}/{c.remarks?.attendanceTotal ?? "—"} days
        </p>
      )}
      {c.template.showRemarks && (
        <div className="mt-5 text-sm">
          <p>Class teacher: {c.remarks?.classTeacher || "—"}</p>
          <p>Principal: {c.remarks?.principal || "—"}</p>
        </div>
      )}
      <div className="mt-12 flex justify-between font-semibold">
        <span>{c.template.teacherSignature}</span>
        <span>{c.template.principalSignature}</span>
      </div>
      <p className="mt-8 text-xs">{c.template.footer}</p>
    </div>
  );
}
function TemplateForm({
  template,
  divisions,
  onSave,
  onClose,
  busy,
  error,
}: {
  template: ReportTemplate;
  divisions: string[];
  onSave: (t: ReportTemplate) => void;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const [v, setV] = useState(template);
  const [imageError, setImageError] = useState("");
  async function uploadSignature(key: "teacherSignatureImage" | "principalSignatureImage", file: File) {
    setImageError("");
    try {
      if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 100 * 1024 || !file.size)
        throw new Error("Choose a PNG or JPEG signature under 100 KB.");
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const bitmap = await createImageBitmap(file);
      const valid = bitmap.width <= 1500 && bitmap.height <= 600;
      bitmap.close();
      if (!valid) throw new Error("Resize the signature to at most 1500 × 600 pixels.");
      setV((current) => ({ ...current, [key]: content }));
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Could not read this signature.");
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Configure report template"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !v.name.trim()} onClick={() => onSave(v)}>
            Save template
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Template name">
          <Input value={v.name} maxLength={120} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <p className="text-xs font-semibold">Default for divisions (optional)</p>
        <div className="flex flex-wrap gap-3">
          {divisions.map((id) => (
            <label key={id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={v.classIds.includes(id)}
                onChange={(e) =>
                  setV({
                    ...v,
                    classIds: e.target.checked ? [...v.classIds, id] : v.classIds.filter((c) => c !== id),
                  })
                }
              />
              {classIdLabel(id)}
            </label>
          ))}
        </div>
        {(
          [
            ["showComponents", "Component marks"],
            ["showAttendance", "Attendance summary"],
            ["showRemarks", "Teacher and principal remarks"],
            ["showRank", "Rank, when enabled"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <Checkbox checked={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.checked })} />
            {label}
          </label>
        ))}
        <Field label="Class teacher signature name">
          <Input
            value={v.teacherSignature}
            maxLength={150}
            onChange={(e) => setV({ ...v, teacherSignature: e.target.value })}
          />
        </Field>
        <Field label="Principal signature name">
          <Input
            value={v.principalSignature}
            maxLength={150}
            onChange={(e) => setV({ ...v, principalSignature: e.target.value })}
          />
        </Field>
        {(["teacherSignatureImage", "principalSignatureImage"] as const).map((key) => (
          <div key={key} className="rounded border border-outline-variant/60 p-3">
            <Field
              label={
                key === "teacherSignatureImage"
                  ? "Authorized class teacher signature image"
                  : "Authorized principal signature image"
              }
              hint="Optional PNG or JPEG, under 100 KB, up to 1500 × 600 pixels."
            >
              <Input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadSignature(key, file);
                  e.target.value = "";
                }}
              />
            </Field>
            {v[key] && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <Image
                  src={v[key]!}
                  alt="Uploaded signature"
                  width={150}
                  height={50}
                  unoptimized
                  className="h-12 w-36 object-contain"
                />
                <Button size="sm" variant="ghost" onClick={() => setV({ ...v, [key]: "" })}>
                  Remove image
                </Button>
              </div>
            )}
          </div>
        ))}
        {imageError && (
          <p role="alert" className="text-error">
            {imageError}
          </p>
        )}
        <Field label="Footer">
          <Textarea
            value={v.footer}
            maxLength={500}
            onChange={(e) => setV({ ...v, footer: e.target.value })}
          />
        </Field>
        {error && (
          <p role="alert" className="text-error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
function RemarksForm({
  student,
  existing,
  onSave,
  onClose,
  busy,
  error,
}: {
  student: ResultRow;
  existing?: Remark;
  onSave: (r: Record<string, unknown>) => void;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const [classTeacher, setTeacher] = useState(existing?.classTeacher || ""),
    [principal, setPrincipal] = useState(existing?.principal || "");
  const [present, setPresent] = useState(existing?.attendancePresent?.toString() || ""),
    [total, setTotal] = useState(existing?.attendanceTotal?.toString() || "");
  return (
    <Modal
      open
      onClose={onClose}
      title="Report remarks"
      subtitle={student.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              onSave({
                classTeacher,
                principal,
                attendancePresent: present === "" ? null : Number(present),
                attendanceTotal: total === "" ? null : Number(total),
              })
            }
          >
            Save remarks
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Class teacher remarks">
          <Textarea value={classTeacher} maxLength={2000} onChange={(e) => setTeacher(e.target.value)} />
        </Field>
        <Field label="Principal remarks">
          <Textarea value={principal} maxLength={2000} onChange={(e) => setPrincipal(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Attendance days present">
            <Input
              type="number"
              min={0}
              max={366}
              value={present}
              onChange={(e) => setPresent(e.target.value)}
            />
          </Field>
          <Field label="Total attendance days">
            <Input type="number" min={0} max={366} value={total} onChange={(e) => setTotal(e.target.value)} />
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
