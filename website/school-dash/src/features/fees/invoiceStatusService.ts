import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { currentSchoolId } from "@/lib/useCollection";
import type { Invoice } from "./types";

export type InvoiceStatusRequest = { requestId: string; invoiceId: string; status: "Automatic" | "Pending" | "Overdue"; reason: string;
  expectedRevision: number; expectedAmount: number; expectedPaid: number; expectedDue: string };
export type InvoiceStatusHistory = { id: string; invoiceId: string; from: string; to: string; mode: string; reason: string; at: string; by: string; byUid: string };
export async function changeInvoiceStatus(request: InvoiceStatusRequest) {
  const { data } = await httpsCallable<InvoiceStatusRequest & { schoolId: string | null }, Pick<Invoice, "status" | "statusOverride" | "statusRevision">>(functions, "changeFeeInvoiceStatus")({ ...request, schoolId: currentSchoolId() });
  return data;
}
