import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { currentSchoolId } from "@/lib/useCollection";
import type { Payment } from "./types";

export type PaymentRequest = { requestId: string; invoiceId: string; amount: number; mode?: string; reference?: string; date?: string; claimId?: string };
export class FeePaymentError extends Error {
  constructor(message: string, readonly outcome: "rejected" | "unknown") { super(message); this.name = "FeePaymentError"; }
}
export async function recordFeePayment(request: PaymentRequest) {
  try {
    const { data } = await httpsCallable<PaymentRequest & { schoolId: string | null }, { payment: Payment; replayed: boolean }>(functions, "recordFeePayment")({ ...request, schoolId: currentSchoolId() });
    return data.payment;
  } catch (error) {
    const code = String((error as { code?: string })?.code ?? "").replace(/^functions\//, "");
    if (["invalid-argument", "not-found", "already-exists", "failed-precondition", "unauthenticated", "permission-denied"].includes(code)) {
      throw new FeePaymentError(error instanceof Error ? error.message : "The payment could not be recorded.", "rejected");
    }
    throw new FeePaymentError("Could not confirm the payment. Retry to check its receipt without recording it twice.", "unknown");
  }
}
