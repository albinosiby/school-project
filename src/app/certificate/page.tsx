"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import type { Cert } from "@/features/people/CertificatesPanel";
import { fmtDate } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";

type School = { id: string; name?: string; address?: string; city?: string; board?: string; affiliation?: string; phone?: string; email?: string };
type Stu = { id: string; name: string; grade?: string; section?: string; dob?: string; guardian?: string; admissionDate?: string };

const BODY: Record<string, (s: string, cls: string, purpose: string) => string> = {
  bonafide: (s, cls, p) => `This is to certify that ${s} is a bonafide student of this school, studying in Grade ${cls} during the current academic year.${p ? ` This certificate is issued for ${p}.` : ""}`,
  character: (s, cls, p) => `This is to certify that ${s}, a student of Grade ${cls}, is known to us and bears a good moral character. To the best of our knowledge, nothing adverse has been noted.${p ? ` Issued for ${p}.` : ""}`,
  transfer: (s, cls, p) => `This is to certify that ${s} was a student of this school in Grade ${cls}. All dues have been cleared and the school has no objection to the student joining another institution.${p ? ` Issued for ${p}.` : ""}`,
  feeReceipt: (s, cls, p) => `This is to certify that the fees for ${s} of Grade ${cls} for the current academic year have been paid to the school as per the fee records.${p ? ` Issued for ${p}.` : ""}`,
  other: (s, cls, p) => `This certificate is issued to ${s} of Grade ${cls}${p ? ` for ${p}` : ""}.`,
};

/** Printable certificate (Students > Certificates > Print): the office prints it, signs it and hands it over or scans it. */
function Certificate() {
  const id = useSearchParams().get("id") ?? "";
  const certs = useCollection<Cert>("certificates");
  const school = useCollection<School>("school").rows.find((s) => s.id === "school");
  const students = useCollection<Stu>("students").rows;
  const c = certs.rows.find((x) => x.id === id);
  if (!certs.ready) return <p className="p-10 text-on-surface-variant">Loading…</p>;
  if (!c || c.status !== "Issued") return <p className="p-10 text-on-surface-variant">This certificate was not found or has not been issued.</p>;
  const s = students.find((x) => x.id === c.studentId);
  const cls = s?.grade ? `${s.grade}-${s.section ?? ""}` : c.classId.replace(/^cls_(\d+)(\w)$/, "$1-$2");
  const text = (BODY[c.type] ?? BODY.other)(c.studentName, cls, c.purpose ?? "");
  return (
    <div className="min-h-screen bg-surface-container-low py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 print:hidden">
        <button className="h-10 rounded-lg bg-secondary px-4 text-sm font-semibold text-white" onClick={() => window.print()}>Print</button>
      </div>
      <article className="mx-auto flex min-h-[297mm] max-w-[210mm] flex-col bg-white p-[18mm] text-[#1b1b1f] shadow print:shadow-none">
        <header className="border-b-2 border-[#1b1b1f] pb-4 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wide">{school?.name ?? "School"}</h1>
          <p className="mt-1 text-sm">{[school?.address, school?.city].filter(Boolean).join(", ")}</p>
          <p className="text-xs">{[school?.board, school?.affiliation && `Affiliation No. ${school.affiliation}`].filter(Boolean).join(" · ")}</p>
        </header>
        <div className="mt-6 flex justify-between text-sm"><span>Ref: <b className="font-mono">{c.refNo}</b></span><span>Date: {c.issuedOn ? fmtDate(c.issuedOn) : ""}</span></div>
        <h2 className="mt-10 text-center text-xl font-bold uppercase underline underline-offset-4">{c.title}</h2>
        <p className="mt-10 text-justify text-[15px] leading-8">{text}</p>
        <dl className="mt-8 grid grid-cols-[160px_1fr] gap-y-2 text-sm">
          <dt>Student</dt><dd className="font-semibold">{c.studentName}</dd>
          <dt>GR number</dt><dd className="font-mono">{c.grn}</dd>
          <dt>Class</dt><dd>Grade {cls}</dd>
          {s?.dob && <><dt>Date of birth</dt><dd>{fmtDate(s.dob)}</dd></>}
          {s?.guardian && <><dt>Parent / guardian</dt><dd>{s.guardian}</dd></>}
          {c.validTill && <><dt>Valid till</dt><dd>{fmtDate(c.validTill)}</dd></>}
        </dl>
        {c.note && <p className="mt-6 text-sm">{c.note}</p>}
        <footer className="mt-auto flex items-end justify-between pt-24 text-sm">
          <span className="text-xs text-[#5f5f6b]">Verify with the school office quoting the reference number.</span>
          <div className="text-center"><div className="mb-1 w-56 border-t border-[#1b1b1f]" />{c.issuer || "Principal"}<div className="text-xs">School seal</div></div>
        </footer>
      </article>
    </div>
  );
}

export default function Page() { return <AuthGuard><Suspense fallback={null}><Certificate /></Suspense></AuthGuard>; }
