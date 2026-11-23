import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { currentSchoolId } from "@/lib/useCollection";
import type { CertificateForm, CertificateResult, CertificateTemplate, PdfResult, VerificationResult } from "./types";

export async function certificateAction<T = CertificateResult>(action: string, input: Record<string, unknown>) {
  const { data } = await httpsCallable<Record<string, unknown>, T>(functions, "manageCertificate")({ ...input, action, schoolId: currentSchoolId() });
  return data;
}
export const previewCertificate = (form: CertificateForm, input: Record<string, unknown> = {}) => certificateAction<PdfResult>("preview", { ...input, form });
export const saveCertificateTemplate = (template: CertificateTemplate, requestId: string) => certificateAction<{ id: string; version: number }>("saveTemplate", { template, expectedVersion: template.version, requestId });
export async function certificatePdf(certificateId: string, historyId?: string) {
  const { data } = await httpsCallable<Record<string, unknown>, PdfResult>(functions, "downloadCertificate")({ schoolId: currentSchoolId(), certificateId, ...(historyId ? { historyId } : {}) });
  return data;
}
export async function verifyCertificate(input: { schoolId: string; token?: string; refNo?: string }) {
  const { data } = await httpsCallable<typeof input, VerificationResult>(functions, "verifyCertificate")(input);
  return data;
}
export function pdfBlob(pdf: PdfResult) {
  const binary = atob(pdf.content), bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: "application/pdf" });
}
export function savePdf(pdf: PdfResult) {
  const url = URL.createObjectURL(pdfBlob(pdf)), anchor = document.createElement("a");
  anchor.href = url; anchor.download = pdf.filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function printPdf(pdf: PdfResult) {
  const url = URL.createObjectURL(pdfBlob(pdf)), frame = document.createElement("iframe");
  frame.title = "Certificate print document"; frame.style.cssText = "position:fixed;width:1px;height:1px;right:0;bottom:0;border:0";
  frame.onload = () => { try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { window.open(url, "_blank", "noopener,noreferrer"); } };
  frame.src = url; document.body.appendChild(frame);
  setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
}
export const certificateError = (error: unknown) => {
  const value = error && typeof error === "object" ? error as { code?: string; message?: unknown } : {};
  if (value.code === "functions/internal" || value.code === "functions/unavailable" || value.code === "functions/not-found") return "The certificate service is unavailable. Please try again later.";
  const message = typeof value.message === "string" ? value.message : "";
  return message.replace(/^Firebase:\s*/, "").replace(/\s*\(functions\/[^)]+\)\.?$/, "") || "Could not complete this certificate action. Please try again.";
};
