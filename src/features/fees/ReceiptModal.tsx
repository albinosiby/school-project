"use client";
import { Printer } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { fmtDate, inrFull } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import type { Payment } from "./types";

// Print-only CSS: hide everything except the receipt block, then window.print().
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  #fee-receipt, #fee-receipt * { visibility: visible !important; }
  #fee-receipt { position: fixed; left: 0; top: 0; width: 100%; padding: 24px; background: #fff; color: #000; }
}`;

type School = { id: string; name?: string; board?: string; affiliation?: string; city?: string };

export function ReceiptModal({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  // the school's own header (school/school, contract 3); was hard-coded to the demo school
  const school = useCollection<School>("school").rows.find((x) => x.id === "school");
  if (!payment) return null;
  const sub = [school?.affiliation ? `${school.board ? `${school.board} ` : ""}Affiliation #${school.affiliation}` : school?.board, school?.city].filter(Boolean).join(" · ");
  return (
    <Modal open onClose={onClose} title="Fee Receipt" subtitle={payment.receiptNo}
      footer={<><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => window.print()}><Printer size={16} />Print Receipt</Button></>}>
      <style>{PRINT_CSS}</style>
      <div id="fee-receipt">
        <div className="text-center"><p className="font-semibold uppercase text-secondary">{school?.name || "Fee receipt"}</p>{sub && <p className="text-xs text-outline">{sub}</p>}<p className="mt-1 font-mono text-xs">Receipt {payment.receiptNo}</p></div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div><dt className="text-xs text-outline">Received from</dt><dd className="font-semibold">{payment.student}</dd></div>
          <div><dt className="text-xs text-outline">GRN</dt><dd className="font-mono">{payment.grn}</dd></div>
          <div><dt className="text-xs text-outline">Invoice</dt><dd className="font-mono">{payment.invoiceNo}</dd></div>
          <div><dt className="text-xs text-outline">Date</dt><dd>{payment.date ? fmtDate(payment.date) : "—"}</dd></div>
          <div><dt className="text-xs text-outline">Mode</dt><dd>{payment.mode}</dd></div>
          <div><dt className="text-xs text-outline">Collected by</dt><dd>{payment.by}</dd></div>
        </dl>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-info-container/60 p-4"><span className="font-semibold">Amount received</span><span className="t-headline-md text-secondary">{inrFull(payment.amount)}</span></div>
        <p className="mt-6 hidden text-xs print:block">This is a computer-generated receipt.</p>
      </div>
    </Modal>
  );
}
