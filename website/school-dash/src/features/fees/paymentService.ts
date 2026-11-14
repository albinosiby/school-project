import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { currentSchoolId } from "@/lib/useCollection";
import type { Payment } from "./types";

export type PaymentRequest = { requestId: string; invoiceId: string; amount: number; mode?: string; reference?: string; date?: string; claimId?: string };
export async function recordFeePayment(request: PaymentRequest) {
  try {
    const { data } = await httpsCallable<PaymentRequest & { schoolId: string | null }, { payment: Payment; replayed: boolean }>(functions, "recordFeePayment")({ ...request, schoolId: currentSchoolId() });
    return data.payment;
  } catch (error) {
    if (error instanceof Error && !/^(?:internal|permission-denied|unavailable)(?:\s*\[\d+\])?$/i.test(error.message)) throw error;
    throw new Error("Could not confirm the payment. Retry to check its receipt without recording it twice.");
  }
}
