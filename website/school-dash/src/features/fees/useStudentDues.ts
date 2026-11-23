"use client";
import { useMemo } from "react";
import { useAuth } from "@/lib/authContext";
import { useCollection } from "@/lib/useCollection";
import type { Student } from "@/features/people/StudentsView";
import type { FeeTerm } from "@/features/people/studentAnnualFees";
import type { StudentTransportFee } from "@/features/transport/transportFees";
import { studentDues } from "./studentDues";
import type { Concession, Invoice, Payment, Structure } from "./types";
import type { FeeFrequency } from "./feePlan";
import type { InvoiceSchool } from "./invoicePdf";

/** Existing school-scoped listeners are shared with fee/profile panels by the collection store. */
export function useStudentDues() {
  const { user } = useAuth(); const allowed = user?.role === "admin" || user?.role === "owner";
  const students = useCollection<Student>("students", allowed);
  const invoices = useCollection<Invoice>("fee_invoices", allowed);
  const payments = useCollection<Payment>("fee_payments", allowed);
  const concessions = useCollection<Concession>("fee_concessions", allowed);
  const structures = useCollection<Structure>("fee_structure", allowed);
  const school = useCollection<InvoiceSchool & { id: string; academicYear?: string }>("school", allowed);
  const terms = useCollection<FeeTerm>("set_terms", allowed);
  const admissions = useCollection<{ id: string; admissionDate?: string }>("adm_student_details", allowed);
  const transport = useCollection<StudentTransportFee>("student_transport_fees", allowed);
  const policy = useCollection<{ id: string; transportFrequency?: FeeFrequency | "" }>("set_config", allowed);
  const academicYear = school.rows.find((row) => row.id === "school")?.academicYear ?? "";
  const transportFrequency = policy.rows.find((row) => row.id === "fee_policy")?.transportFrequency;
  const rows = useMemo(() => studentDues({ students: students.rows, invoices: invoices.rows, payments: payments.rows, concessions: concessions.rows,
    structures: structures.rows, academicYear, terms: terms.rows, admissions: admissions.rows, transportFees: transport.rows, transportFrequency }),
    [students.rows, invoices.rows, payments.rows, concessions.rows, structures.rows, academicYear, terms.rows, admissions.rows, transport.rows, transportFrequency]);
  const sources = [students, invoices, payments, concessions, structures, school, terms, admissions, transport, policy];
  const failed = sources.filter((row) => row.error);
  return { allowed, students, invoices, payments, concessions, structures, school, academicYear, rows, ready: sources.every((row) => row.ready),
    failed: failed.length > 0, retry: () => failed.forEach((row) => row.reload()) };
}
