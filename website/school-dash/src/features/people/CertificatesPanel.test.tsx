import { beforeEach, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { CertificatesPanel } from "./CertificatesPanel";
import CertificatePage from "@/app/certificate/page";
import { CertificateVerification } from "@/features/certificates/CertificateVerification";
import { dialog, field, renderUI, screen, seed, setUrl, within, writes } from "@/test/render";

const service = vi.hoisted(() => ({ action: vi.fn(), preview: vi.fn(), template: vi.fn(), pdf: vi.fn(), verify: vi.fn(), save: vi.fn(), print: vi.fn() }));
vi.mock("@/features/certificates/service", () => ({ certificateAction: service.action, previewCertificate: service.preview, saveCertificateTemplate: service.template, certificatePdf: service.pdf, verifyCertificate: service.verify,
  pdfBlob: () => new Blob(["PDF"], { type: "application/pdf" }), savePdf: service.save, printPdf: service.print, certificateError: (error: Error) => error.message }));
const students = [{ id: "stu_101", name: "Aarav Sharma", grn: "GIS-9200", grade: "10", section: "B", classId: "cls_10B" }, { id: "stu_201", name: "Meera Sharma", grn: "GIS-8100", grade: "8", section: "A" }];
const request = { id: "req1", studentId: "stu_101", classId: "cls_10B", studentName: "Aarav Sharma", grn: "GIS-9200", type: "character", title: "Character Certificate", purpose: "School transfer", status: "Requested", parentUid: "uid_p1", requestedAt: "2026-11-01T09:00:00Z" };
const issued = { ...request, id: "issued", status: "Issued", schemaVersion: 2, refNo: "CERT/2026/0003", issuedOn: "2026-11-03", issuer: "Principal", revision: 2 };
beforeEach(() => { vi.resetAllMocks(); service.action.mockResolvedValue({ id: "issued", status: "Issued", refNo: "CERT/2026/0004", revision: 2 }); service.preview.mockResolvedValue({ content: "PDF", filename: "preview.pdf" }); service.pdf.mockResolvedValue({ content: "PDF", filename: "certificate.pdf" }); service.template.mockResolvedValue({ version: 1 }); });

it("searches students, validates and issues through the server without allocating a browser number", async () => {
  seed({ students }); const { user } = renderUI(<CertificatesPanel />);
  await user.click(screen.getByRole("button", { name: "Issue certificate" })); const d = dialog("Issue certificate");
  await user.click(within(d).getByRole("button", { name: "Issue certificate" })); expect(within(d).getByRole("alert")).toHaveTextContent("Choose a student");
  await user.type(field("Student", d), "Meera"); expect(within(d).queryByRole("option", { name: /Aarav/ })).not.toBeInTheDocument();
  await user.click(within(d).getByRole("option", { name: /Meera Sharma/ })); await user.type(field("Authorised signatory", d), "Dr. Mehta");
  expect(within(d).queryByLabelText("Reference number")).not.toBeInTheDocument();
  await user.click(within(d).getByRole("button", { name: "Preview" })); expect(service.preview).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "stu_201", kind: "student", type: "bonafide" }), {});
  expect(within(d).getByTitle("Certificate PDF preview")).toBeInTheDocument();
  await user.click(within(d).getByRole("button", { name: "Issue certificate" }));
  expect(service.action).toHaveBeenCalledWith("issue", expect.objectContaining({ requestId: expect.stringMatching(/^[a-f\d-]{36}$/i), form: expect.objectContaining({ recipientId: "stu_201", issuer: "Dr. Mehta", templateVersion: 0 }) })); expect(writes).toHaveLength(0);
});

it("issues a staff salary certificate with staff-specific fields", async () => {
  seed({ staff: [{ id: "staff1", name: "Albin Lebin", empId: "EMP-1", designation: "Driver", department: "Transport" }] }); const { user } = renderUI(<CertificatesPanel />);
  await user.click(screen.getByRole("button", { name: "Issue certificate" })); let d = dialog(); await user.selectOptions(field("Recipient type", d), "staff"); d = dialog();
  await user.type(field("Staff member", d), "EMP-1"); await user.click(within(d).getByRole("option", { name: /Albin/ })); await user.selectOptions(field("Certificate type", d), "salary");
  await user.type(field("Salary amount (₹)", d), "35000"); await user.type(field("Salary period", d), "November 2026"); await user.type(field("Authorised signatory", d), "Principal");
  await user.click(within(d).getByRole("button", { name: "Issue certificate" }));
  expect(service.action).toHaveBeenCalledWith("issue", expect.objectContaining({ form: expect.objectContaining({ kind: "staff", recipientId: "staff1", type: "salary", fields: { salaryAmount: "35000", salaryPeriod: "November 2026" } }) }));
});

it("keeps an uncertain issue retry on the same request and frozen inputs", async () => {
  seed({ students }); service.action.mockRejectedValueOnce(new Error("Connection lost")); const { user } = renderUI(<CertificatesPanel />);
  await user.click(screen.getByRole("button", { name: "Issue certificate" })); const d = dialog(); await user.type(field("Student", d), "Meera"); await user.click(within(d).getByRole("option", { name: /Meera/ })); await user.type(field("Authorised signatory", d), "Principal");
  await user.click(within(d).getByRole("button", { name: "Issue certificate" })); expect(field("Authorised signatory", d)).toBeDisabled();
  const error = within(d).getByRole("alert");
  expect(error).toHaveTextContent("Connection lost"); expect(error.closest("footer")).not.toBeNull();
  expect(within(d).getByText(/Issuance has not been confirmed/)).toBeInTheDocument();
  await user.click(within(d).getByRole("button", { name: "Retry issue" })); expect(service.action.mock.calls[1]).toEqual(service.action.mock.calls[0]);
});

it("issued records expose PDF, history and reasoned revocation instead of editable identity", async () => {
  seed({ certificates: [issued], certificate_history: [{ id: "h1", certificateId: "issued", action: "Issued", detail: "CERT/2026/0003", by: "School Admin", at: "2026-11-03T10:00:00Z" }] }); const { user } = renderUI(<CertificatesPanel />);
  await user.click(screen.getByRole("button", { name: "Aarav Sharma" })); const d = dialog("Character Certificate"); expect(within(d).getByText("Issuance history")).toBeInTheDocument(); expect(within(d).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  await user.click(within(d).getByRole("button", { name: "Download PDF" })); expect(service.pdf).toHaveBeenCalledWith("issued"); expect(service.save).toHaveBeenCalled();
  await user.click(within(d).getByRole("button", { name: "Revoke certificate" })); await user.click(within(d).getByRole("button", { name: "Confirm revocation" })); expect(within(d).getByRole("alert")).toHaveTextContent("at least 5");
  await user.type(field("Reason for revocation", d), "Correction required"); await user.click(within(d).getByRole("button", { name: "Confirm revocation" })); expect(service.action).toHaveBeenCalledWith("revoke", expect.objectContaining({ certificateId: "issued", expectedRevision: 2, reason: "Correction required" }));
});

it("resumes a reserved issue without creating a new operation identifier", async () => {
  const id = "9550a62d-7309-45f1-9528-26bc86f4d936"; seed({ certificates: [{ ...issued, status: "Preparing", issueRequestId: id }] }); const { user } = renderUI(<CertificatesPanel />);
  await user.click(screen.getByRole("tab", { name: /Drafts/ })); await user.click(screen.getByRole("button", { name: "Aarav Sharma" })); await user.click(within(dialog()).getByRole("button", { name: "Resume issue" })); expect(service.action).toHaveBeenCalledWith("resumeIssue", expect.objectContaining({ certificateId: "issued", requestId: id }));
});

it("offers twelve templates and filters staff formats", async () => {
  const { user } = renderUI(<CertificatesPanel />); await user.click(screen.getByRole("tab", { name: "Templates" })); expect(screen.getAllByRole("button", { name: "Edit template" })).toHaveLength(12);
  await user.click(screen.getByRole("tab", { name: "Staff" })); expect(screen.getAllByRole("button", { name: "Edit template" })).toHaveLength(6); await user.click(screen.getAllByRole("button", { name: "Edit template" })[0]);
  const d = dialog(/Employment Certificate/); await user.type(field("Default signatory", d), "Principal"); await user.click(within(d).getByRole("button", { name: "Save template" })); expect(service.template).toHaveBeenCalledWith(expect.objectContaining({ kind: "staff", type: "employment", signatory: "Principal", version: 0 }), expect.any(String));
});

it("verifies without exposing student identity or a salary amount", async () => {
  service.verify.mockResolvedValue({ status: "Valid", title: "Salary Certificate", school: "School", refNo: "CERT/2026/0010", issuedOn: "2026-11-20" }); const { user } = renderUI(<CertificateVerification schoolId="school1" />);
  await user.type(field("Certificate number"), "CERT/2026/0010"); await user.click(screen.getByRole("button", { name: "Verify certificate" })); expect(service.verify).toHaveBeenCalledWith({ schoolId: "school1", refNo: "CERT/2026/0010" }); expect(await screen.findByText("Valid")).toBeInTheDocument(); expect(screen.queryByText(/salary amount/i)).not.toBeInTheDocument();
});

it("preserves printing of legacy records with saved references", () => {
  seed({ certificates: [{ ...request, status: "Issued", refNo: "CERT/2026/0003", issuedOn: "2026-11-03", issuer: "Dr. Mehta, Principal" }], school: [{ id: "school", name: "Greenfield International School", board: "CBSE", city: "Delhi" }], set_config: [{ id: "profile", address: "12 Ring Road", affiliation: "2730001" }], students });
  setUrl("/certificate?id=req1"); renderUI(<CertificatePage />); expect(screen.getByText("Greenfield International School")).toBeInTheDocument(); expect(screen.getByText("12 Ring Road, Delhi")).toBeInTheDocument(); expect(screen.getByText("CERT/2026/0003")).toBeInTheDocument();
});

it("a delayed QR response cannot overwrite a newer manual verification", async () => {
  let finish!: (value: unknown) => void;
  service.verify.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce({ status: "Revoked", title: "Study Certificate", refNo: "CERT/2026/0002" });
  const { user } = renderUI(<CertificateVerification schoolId="school1" token="0123456789abcdefghijklmnopqrstuv" />);
  await user.type(field("Certificate number"), "CERT/2026/0002"); await user.click(screen.getByRole("button", { name: "Verify certificate" }));
  expect(await screen.findByText("Revoked")).toBeInTheDocument();
  await act(async () => finish({ status: "Valid", title: "Old certificate", refNo: "CERT/2026/0001" }));
  expect(screen.getByText("Revoked")).toBeInTheDocument(); expect(screen.queryByText("Old certificate")).not.toBeInTheDocument();
});

it("allows another lookup after editing a reference while manual verification is running", async () => {
  let finish!: (value: unknown) => void;
  service.verify.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce({ status: "Valid", title: "Current certificate", refNo: "CERT/2026/0002" });
  const { user } = renderUI(<CertificateVerification schoolId="school1" />);
  await user.type(field("Certificate number"), "CERT/2026/0001");
  await user.click(screen.getByRole("button", { name: "Verify certificate" }));
  expect(screen.getByRole("button", { name: "Verify certificate" })).toBeDisabled();
  await user.clear(field("Certificate number"));
  await user.type(field("Certificate number"), "CERT/2026/0002");
  expect(screen.getByRole("button", { name: "Verify certificate" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Verify certificate" }));
  expect(await screen.findByText("Current certificate")).toBeInTheDocument();
  await act(async () => finish({ status: "Revoked", title: "Superseded lookup" }));
  expect(screen.getByText("Current certificate")).toBeInTheDocument();
  expect(screen.queryByText("Superseded lookup")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Verify certificate" })).toBeEnabled();
});

it("does not print an unissued record", () => { seed({ certificates: [request] }); setUrl("/certificate?id=req1"); renderUI(<CertificatePage />); expect(screen.getByText("This certificate was not found or has not been issued.")).toBeInTheDocument(); });
