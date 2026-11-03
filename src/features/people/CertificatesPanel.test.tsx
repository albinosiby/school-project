import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { CertificatesPanel } from "./CertificatesPanel";
import CertificatePage from "@/app/certificate/page";
import { dialog, field, getRow, renderUI, rowsOf, screen, seed, setUrl, uploads, within, writes } from "@/test/render";

const students = [{ id: "stu_101", name: "Aarav Sharma", grn: "GIS-9200", grade: "10", section: "B", classId: "cls_10B" }, { id: "stu_201", name: "Meera Sharma", grn: "GIS-8100", grade: "8", section: "A" }];
// shape written by the parent app (FirebaseStudentRepository.requestCertificate)
const request = { id: "cer_req1", studentId: "stu_101", classId: "cls_10B", studentName: "Aarav Sharma", grn: "GIS-9200", type: "character", title: "Character Certificate",
  category: "bonafide", purpose: "School transfer", status: "Requested", requestedBy: "Mr. Rahul Sharma", requestedAt: "2026-11-01T09:00:00Z", parentUid: "uid_p1" };

// the shared harness does not reset `uploads` between tests
beforeEach(() => { uploads.length = 0; vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 3, 10, 0)); });
afterEach(() => { vi.useRealTimers(); });

const file = (name: string, type: string, size = 2048) => { const f = new File(["x"], name, { type }); Object.defineProperty(f, "size", { value: size }); return f; };
const pickFile = (d: HTMLElement, f: File) => fireEvent.change(field("Signed certificate", d), { target: { files: [f] } });
const alertText = () => screen.getByRole("alert").textContent;

async function openNew() {
  const r = renderUI(<CertificatesPanel students={students} />);
  await r.user.click(screen.getByRole("button", { name: /Issue certificate/ }));
  const d = dialog("Issue certificate");
  return { ...r, d, issue: () => r.user.click(within(d).getByRole("button", { name: "Issue" })) };
}

describe("Issue certificate (direct)", () => {
  it("validates student, reference, issue date, validity and signer", async () => {
    seed({ certificates: [{ ...request, id: "c0", status: "Issued", refNo: "CERT/2026/0007", issuedOn: "2026-10-01" }] });
    const { user, d, issue } = await openNew();
    expect(field("Reference number", d)).toHaveValue("CERT/2026/0008");
    await issue();
    expect(alertText()).toBe("Choose a student.");
    await user.selectOptions(field("Student", d), "stu_201");
    await user.clear(field("Reference number", d));
    await issue();
    expect(alertText()).toBe("Reference number and issue date are required.");
    await user.type(field("Reference number", d), "cert/2026/0007");
    await issue();
    expect(alertText()).toBe("This reference number is already used by another certificate.");
    await user.clear(field("Reference number", d)); await user.type(field("Reference number", d), "CERT/2026/0008");
    await user.type(field("Valid till", d), "2026-11-02");
    await issue();
    expect(alertText()).toBe("Valid till must be on or after the issue date.");
    await user.clear(field("Valid till", d));
    await user.clear(field("Signed by", d));
    await issue();
    expect(alertText()).toBe("Enter who signs the certificate.");
    expect(writes).toHaveLength(0);
    expect(uploads).toHaveLength(0);
  });

  it("refuses files that are not PDF/PNG/JPG or not under 10 MB", async () => {
    const { d } = await openNew();
    pickFile(d, file("scan.gif", "image/gif"));
    expect(alertText()).toBe("Upload a PDF, PNG or JPG file.");
    pickFile(d, file("big.pdf", "application/pdf", 10 * 1024 * 1024));
    expect(alertText()).toBe("The file must be smaller than 10 MB.");
    expect(within(d).queryByText(/big\.pdf/)).toBeNull();
    pickFile(d, file("signed.pdf", "application/pdf", 10 * 1024 * 1024 - 1));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(within(d).getByText(/signed\.pdf/)).toBeInTheDocument();
  });

  it("issues with the signed file: uploads under the cert id and writes the contract doc", async () => {
    const { user, d, issue } = await openNew();
    await user.selectOptions(field("Student", d), "stu_201");
    await user.selectOptions(field("Certificate", d), "transfer");
    await user.type(field("Purpose", d), " Admission elsewhere ");
    pickFile(d, file("TC signed.pdf", "application/pdf"));
    await issue();
    expect(await screen.findByText("Certificate issued with the signed file")).toBeInTheDocument();
    const [c] = rowsOf<Record<string, unknown>>("certificates");
    expect(c).toMatchObject({ studentId: "stu_201", classId: "cls_8A", studentName: "Meera Sharma", grn: "GIS-8100", type: "transfer", title: "Transfer Certificate",
      category: "bonafide", purpose: "Admission elsewhere", status: "Issued", refNo: "CERT/2026/0001", issuedOn: "2026-11-03", issuer: "School Admin",
      requestedBy: "School office", fileName: "TC signed.pdf" });
    expect(c!.id).toMatch(/^cer_/);
    expect(c!.filePath).toBe(`schools/sch_test/certificates/${c!.id}/TC_signed.pdf`);
    expect(uploads).toEqual([{ path: c!.filePath, size: 2048, type: "application/pdf" }]);
  });
});

describe("Parent requests", () => {
  it("issues a request in place (no file: collect at office)", async () => {
    seed({ certificates: [request] });
    const { user } = renderUI(<CertificatesPanel students={students} />);
    await user.click(screen.getByRole("button", { name: "Issue" }));
    const d = dialog("Issue Character Certificate");
    await user.type(field("Note to the parent", d), "Collect from the office");
    await user.click(within(d).getByRole("button", { name: "Issue" }));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: "update", coll: "certificates", id: "cer_req1" });
    expect(getRow("certificates", "cer_req1")).toMatchObject({ status: "Issued", refNo: "CERT/2026/0001", issuedOn: "2026-11-03", issuer: "School Admin",
      note: "Collect from the office", parentUid: "uid_p1", purpose: "School transfer" });
    expect(uploads).toHaveLength(0);
  });

  it("rejecting needs a reason", async () => {
    seed({ certificates: [request] });
    const { user } = renderUI(<CertificatesPanel students={students} />);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const d = dialog("Reject certificate request");
    await user.click(within(d).getByRole("button", { name: "Reject" }));
    expect(within(d).getByText("Please enter at least 5 characters.")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await user.type(field("Note to the parent", d), "Fees pending for Term 2");
    await user.click(within(d).getByRole("button", { name: "Reject" }));
    expect(getRow("certificates", "cer_req1")).toMatchObject({ status: "Rejected", rejectReason: "Fees pending for Term 2" });
  });
});

describe("Printable certificate (/certificate?id=)", () => {
  it("prints an issued certificate with the school profile address", () => {
    seed({ certificates: [{ ...request, status: "Issued", refNo: "CERT/2026/0003", issuedOn: "2026-11-03", issuer: "Dr. Mehta, Principal" }],
      school: [{ id: "school", name: "Greenfield International School", board: "CBSE", city: "Delhi" }],
      set_config: [{ id: "profile", address: "12 Ring Road", affiliation: "2730001" }], students });
    setUrl("/certificate?id=cer_req1");
    renderUI(<CertificatePage />);
    expect(screen.getByText("Greenfield International School")).toBeInTheDocument();
    expect(screen.getByText("12 Ring Road, Delhi")).toBeInTheDocument();
    expect(screen.getByText("CBSE · Affiliation No. 2730001")).toBeInTheDocument();
    expect(screen.getByText("CERT/2026/0003")).toBeInTheDocument();
    expect(screen.getByText(/Aarav Sharma, a student of Grade 10-B, is known to us/)).toBeInTheDocument();
  });

  it("does not print a request that is not issued", () => {
    seed({ certificates: [request] });
    setUrl("/certificate?id=cer_req1");
    renderUI(<CertificatePage />);
    expect(screen.getByText("This certificate was not found or has not been issued.")).toBeInTheDocument();
  });
});
