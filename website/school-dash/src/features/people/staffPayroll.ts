import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type PayrollAccount = {
  bank: string;
  branch: string;
  accountHolder: string;
  ifsc: string;
  lastFour: string;
};
export type PayrollAccountInput = Omit<PayrollAccount, "lastFour"> & { accountNumber: string };
export type PayrollPayment = {
  month: string;
  paidOn: string;
  grossPaise: number;
  deductionsPaise: number;
  netPaise: number;
  reference: string;
};
export type PayrollPaymentInput = Pick<PayrollPayment, "month" | "paidOn" | "reference"> & {
  gross: string;
  deductions: string;
};
export type PayrollSnapshot = { account: PayrollAccount | null; payments: PayrollPayment[] };

type PayrollAction = { action: "list" | "revealAccount" }
  | ({ action: "saveAccount" } & PayrollAccountInput)
  | ({ action: "recordPayment" } & PayrollPaymentInput);

async function payroll<Result>(staffId: string, input: PayrollAction) {
  const { data } = await httpsCallable<PayrollAction & { staffId: string }, Result>(functions, "manageStaffPayroll")({
    staffId, ...input,
  });
  return data;
}

export const loadStaffPayroll = (staffId: string) => payroll<PayrollSnapshot>(staffId, { action: "list" });
export const saveStaffPayrollAccount = (staffId: string, account: PayrollAccountInput) =>
  payroll<{ account: PayrollAccount }>(staffId, { action: "saveAccount", ...account });
export const revealStaffPayrollAccount = (staffId: string) =>
  payroll<{ accountNumber: string }>(staffId, { action: "revealAccount" });
export const recordStaffPayrollPayment = (staffId: string, payment: PayrollPaymentInput) =>
  payroll<{ payment: PayrollPayment }>(staffId, { action: "recordPayment", ...payment });
