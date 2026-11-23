// Public, static metadata shared with the independently deployable Functions codebase.
import data from "../../../../functions/certificateCatalog.json";
import type { Certificate, CertificateTemplate, RecipientKind } from "./types";
export const catalog = data as { id: string; kind: RecipientKind; title: string; description: string; body: string; fields: string[]; legacy?: boolean }[];
export const fieldLabels: Record<string, string> = { startDate: "Start date", endDate: "End date", conduct: "Character / conduct", leavingReason: "Reason for leaving", feeClearance: "Reviewed clearance", dob: "Date of birth", salaryAmount: "Salary amount (₹)", salaryPeriod: "Salary period", achievement: "Contribution / statement" };
export const defaultTemplate = (type: string): CertificateTemplate => {
  const c = catalog.find((entry) => entry.id === type) ?? catalog[0];
  return { id: c.id, type: c.id, kind: c.kind, title: c.title, body: c.body, accent: "#1554BD", signatory: "", designation: "Principal", signatureImage: "", sealImage: "", version: 0 };
};
export const recipientName = (cert: Certificate) => cert.recipientSnapshot?.name || cert.recipientName || cert.studentName || "Recipient";
export const recipientKind = (cert: Certificate): RecipientKind => cert.recipientKind === "staff" ? "staff" : "student";
export const statusTone = (status: string) => status === "Issued" ? "success" as const : ["Rejected", "Revoked"].includes(status) ? "danger" as const : ["Requested", "Preparing"].includes(status) ? "warning" as const : "neutral" as const;
