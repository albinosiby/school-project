import { runTransaction } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { currentSchoolId } from "@/lib/useCollection";
import { schoolDoc, stamp, invoiceStatus } from "./logic";
import { todayIso, type Concession, type Invoice, type Structure } from "./types";
import { studentFeePlan } from "@/features/people/studentFees";
import { annualStudentFees, invoicePreview, type FeeTerm, type InvoiceChoice } from "@/features/people/studentAnnualFees";
import { studentTransportFee, type StudentTransportFee } from "@/features/transport/transportFees";
import type { FeeFrequency } from "./feePlan";
import type { Student } from "@/features/people/StudentsView";

export type StudentInvoiceSource = {
  student: Student; structure: Structure; academicYear: string; terms: FeeTerm[];
  transportFee?: StudentTransportFee; transportFrequency?: FeeFrequency | "";
  invoices: Invoice[]; concessions: Concession[];
};
type Preview = ReturnType<typeof invoicePreview>;
export type StudentInvoiceRequest = { source: StudentInvoiceSource; period: string; due: string; choices: InvoiceChoice[]; preview: Preview };
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
function basis(source: StudentInvoiceSource) {
  const { student: s, structure: f, terms, transportFee: t } = source;
  return canonical({ student: [s.id, s.name, s.grn, s.grade, s.section, s.streamId ?? "", s.classId ?? "", s.admissionDate ?? "", s.deleted ?? false, s.status ?? "Active", s.busId ?? "", s.busAssignmentRevision ?? 0],
    structure: [f.id, f.grade, f.streamId ?? "", f.academicYear ?? "", f.termsPerYear ?? null, f.schemaVersion ?? 1, f.items ?? [], f.tuition ?? 0, f.lab ?? 0, f.library ?? 0, f.activity ?? 0],
    year: source.academicYear, terms: terms.map((row) => [row.id, row.start ?? "", row.end ?? ""]), transport: t ? [t.busId, t.busAssignmentRevision ?? 0, t.amount ?? t.monthlyAmount ?? null, t.revision ?? 0] : null,
    frequency: source.transportFrequency || "" });
}
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

/** Existing admin Firestore permissions; the bill, numbering and concession allocations commit together. */
export async function generateStudentInvoice(request: StudentInvoiceRequest): Promise<Invoice> {
  if (!auth.currentUser || !currentSchoolId()) throw new Error("Sign in as a school administrator.");
  const schoolId = currentSchoolId();
  const { source } = request;
  const period = request.period.trim().replace(/\s+/g, " ");
  const year = source.academicYear;
  const today = todayIso();
  if (!period || period.length > 80) throw new Error("Enter a billing period of up to 80 characters.");
  if (!/^20\d{2}-\d{2}$/.test(year) || Number(year.slice(5)) !== (Number(year.slice(0, 4)) + 1) % 100) throw new Error("Configure a valid academic year.");
  if (!validDate(request.due) || request.due < today) throw new Error("Choose a due date on or after today.");
  const fingerprint = canonical({ choices: request.choices, due: request.due, preview: request.preview });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical([source.student.id, year, period.toLowerCase()])));
  const id = `sf_${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  if (schoolId !== currentSchoolId()) throw new Error("The selected school changed. Reopen the invoice preview.");
  const invoiceRef = schoolDoc("fee_invoices", id);
  const studentRef = schoolDoc("students", source.student.id);
  const structureRef = schoolDoc("fee_structure", source.structure.id);
  const sequenceRef = schoolDoc("fee_invoice_sequences", `student_${year}`);
  const ledgerRef = schoolDoc("fee_student_billing", `${source.student.id}_${year}`);
  const concessionRefs = source.concessions.map((row) => schoolDoc("fee_concessions", row.id));
  return runTransaction(db, async (tx) => {
    const [prior, studentSnap, structureSnap, schoolSnap, policySnap, transportSnap, admissionSnap, sequence, ledger, ...rest] = await Promise.all([
      tx.get(invoiceRef), tx.get(studentRef), tx.get(structureRef), tx.get(schoolDoc("school", "school")), tx.get(schoolDoc("set_config", "fee_policy")),
      tx.get(schoolDoc("student_transport_fees", source.student.id)), tx.get(schoolDoc("adm_student_details", source.student.id)), tx.get(sequenceRef), tx.get(ledgerRef),
      ...source.terms.map((row) => tx.get(schoolDoc("set_terms", row.id))), ...source.invoices.map((row) => tx.get(schoolDoc("fee_invoices", row.id))),
      ...concessionRefs.map((ref) => tx.get(ref)),
    ]);
    if (!studentSnap.exists() || studentSnap.get("deleted") === true || (studentSnap.get("status") ?? "Active") !== "Active") throw new Error("New invoices are available only for active students.");
    if (prior.exists()) {
      if (prior.get("generationFingerprint") !== fingerprint) throw new Error("An invoice already exists for this student and billing period.");
      return { ...prior.data(), id } as Invoice;
    }
    if (!structureSnap.exists()) throw new Error("The fee configuration was removed. Reopen the invoice preview.");
    const currentStudent = { ...studentSnap.data(), id: studentSnap.id, admissionDate: studentSnap.get("admissionDate") || admissionSnap.get("admissionDate") } as Student;
    const termSnaps = rest.slice(0, source.terms.length);
    const invoiceSnaps = rest.slice(source.terms.length, source.terms.length + source.invoices.length);
    const concessionSnaps = rest.slice(source.terms.length + source.invoices.length);
    const current: StudentInvoiceSource = {
      student: currentStudent, structure: { ...structureSnap.data(), id: structureSnap.id } as Structure,
      academicYear: schoolSnap.get("academicYear") ?? "", terms: termSnaps.map((row) => ({ ...row.data(), id: row.id })),
      transportFee: transportSnap.exists() ? { ...transportSnap.data(), id: transportSnap.id } as StudentTransportFee : undefined,
      transportFrequency: policySnap.get("transportFrequency"), invoices: invoiceSnaps.filter((row) => row.exists() && row.get("deleted") !== true
        && (row.get("studentId") ? row.get("studentId") === currentStudent.id : row.get("grn") === currentStudent.grn)).map((row) => ({ ...row.data(), id: row.id }) as Invoice),
      concessions: concessionSnaps.filter((row) => row.exists() && row.get("deleted") !== true && row.get("grn") === currentStudent.grn).map((row) => ({ ...row.data(), id: row.id }) as Concession),
    };
    if (basis(current) !== basis(source)) throw new Error("Student details or fee settings changed. Reopen the invoice preview.");
    const plan = studentFeePlan(currentStudent, [current.structure], year);
    const assessment = annualStudentFees({ ...plan, terms: current.terms, admissionDate: currentStudent.admissionDate, invoices: current.invoices, concessions: current.concessions,
      busId: currentStudent.busId, transportAmount: studentTransportFee({ ...currentStudent, transportFee: current.transportFee }), transportFrequency: current.transportFrequency });
    if (!assessment.complete) throw new Error(assessment.issues[0] || "Configure the student's fees first.");
    if (assessment.yearInvoices.some((row) => (row.term.split(" · ").at(-1) ?? "").trim().toLowerCase() === period.toLowerCase())) throw new Error("An invoice already exists for this student and billing period.");
    const savedCounts = (ledger.get("quantities") ?? {}) as Record<string, number>;
    const quantities = Object.fromEntries(assessment.charges.map((charge) => [charge.id, Math.max(assessment.used[charge.id] ?? 0, savedCounts[charge.id] ?? 0)]));
    const charges = assessment.charges.map((charge) => ({ ...charge, remaining: Math.max(0, charge.quantity - quantities[charge.id]) }));
    const preview = invoicePreview(charges, request.choices, assessment.concessions);
    if (canonical(preview) !== canonical(request.preview)) throw new Error("Fee collections or concessions changed. Reopen the invoice preview.");
    if (preview.gross <= 0) throw new Error("Select fee items with an amount above zero.");
    const last = sequence.get("last") ?? 0;
    if (!Number.isSafeInteger(last) || last < 0) throw new Error("The invoice sequence needs administrator review.");
    const no = `INV-ST-${year}-${String(last + 1).padStart(6, "0")}`;
    const invoice: Invoice = { id, no, studentId: currentStudent.id, student: currentStudent.name, grn: currentStudent.grn, grade: currentStudent.grade, section: currentStudent.section || "",
      guardian: currentStudent.guardian || "", phone: currentStudent.phone || "", academicYear: year, ...(currentStudent.streamId ? { streamId: currentStudent.streamId, stream: currentStudent.stream || "" } : {}),
      term: `${year} · ${period}`, issued: today, due: request.due, amount: preview.amount, grossAmount: preview.gross, concessionAmount: preview.discount, concessionAllocations: preview.allocations,
      paid: 0, balance: preview.amount, status: invoiceStatus({ amount: preview.amount, paid: 0, due: request.due }, today), generationFingerprint: fingerprint,
      lines: [...preview.lines, ...preview.allocations.map((row) => ({ label: `Concession: ${row.type}`, amount: -row.amount }))] };
    for (const choice of request.choices) quantities[choice.feeItemId] += choice.quantity;
    tx.set(invoiceRef, { ...invoice, ...stamp(), _o: Date.now() });
    tx.set(sequenceRef, { id: sequenceRef.id, last: last + 1, ...stamp() });
    tx.set(ledgerRef, { id: ledgerRef.id, studentId: currentStudent.id, academicYear: year, quantities, ...stamp() });
    for (const allocation of preview.allocations) {
      const concession = current.concessions.find((row) => row.id === allocation.concessionId)!;
      tx.update(schoolDoc("fee_concessions", concession.id), { invoiceApplications: [...(concession.invoiceApplications ?? []), { invoiceId: id, academicYear: year, amount: allocation.amount }], ...stamp() });
    }
    return invoice;
  });
}
