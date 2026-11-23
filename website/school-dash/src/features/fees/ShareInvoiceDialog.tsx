"use client";
import { useEffect, useState } from "react";
import { Button, LoadingSkeleton, Modal } from "@/components/ui";
import { createInvoicePdf, downloadInvoiceFile, invoiceFilename, type InvoiceSchool } from "./invoicePdf";
import type { Invoice } from "./types";

/** Prepare before the Share click so the OS picker keeps a fresh user activation. */
export function ShareInvoiceDialog({ invoice, school, onClose }: { invoice: Invoice; school: InvoiceSchool; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null); const [error, setError] = useState("");
  const [retry, setRetry] = useState(0); const [sharing, setSharing] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => {
    let current = true;
    createInvoicePdf(invoice, school).then((bytes) => { if (current) setFile(new File([new Uint8Array(bytes)], invoiceFilename(invoice), { type: "application/pdf" })); })
      .catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : "Could not prepare the invoice PDF."); });
    return () => { current = false; };
  }, [invoice, school, retry]);
  let canShare = false;
  try { canShare = Boolean(file && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })); } catch { /* Browser capability unavailable. */ }
  async function share() {
    if (!file || sharing) return;
    setError(""); setMessage("");
    if (!canShare) { downloadInvoiceFile(file); setMessage("PDF downloaded. Attach it in your messaging or email app to share it."); return; }
    setSharing(true);
    try { await navigator.share({ files: [file], title: `Invoice ${invoice.no}` }); setMessage("Share menu opened."); }
    catch (cause) { if (!(cause && typeof cause === "object" && "name" in cause && cause.name === "AbortError")) setError("Could not open sharing. Download the PDF and attach it in your messaging or email app."); }
    finally { setSharing(false); }
  }
  return <Modal open title="Share invoice" subtitle={invoice.no} onClose={() => { if (!sharing) onClose(); }}
    footer={<><Button variant="outline" disabled={sharing} onClick={onClose}>Back to invoice</Button>{file && <Button disabled={sharing} onClick={share}>{canShare ? sharing ? "Sharing…" : "Share PDF" : "Download PDF to share"}</Button>}</>}>
    {!file && !error ? <LoadingSkeleton label="Preparing invoice PDF to share…" /> : <p className="text-sm text-on-surface-variant">{file?.name}{file && <span className="mt-2 block">{canShare ? "Choose an app and recipient in your device’s share menu." : "File sharing is unavailable in this browser. Download the PDF, then attach it in your preferred app."}</span>}</p>}
    {error && <div role="alert" className="mt-3 text-sm text-error"><p>{error}</p>{!file ? <Button variant="outline" className="mt-3" onClick={() => { setError(""); setRetry((value) => value + 1); }}>Retry PDF</Button> : <Button variant="outline" className="mt-3" onClick={() => downloadInvoiceFile(file)}>Download PDF</Button>}</div>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </Modal>;
}
