"use client";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge, Button, Card, Field, Input, LoadingSkeleton } from "@/components/ui";
import { certificateError, verifyCertificate } from "./service";
import type { VerificationResult } from "./types";

export function CertificateVerification({ schoolId = "", token = "" }: { schoolId?: string; token?: string }) {
  const [school, setSchool] = useState(schoolId), [number, setNumber] = useState(""), [result, setResult] = useState<VerificationResult | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [qrLoading, setQrLoading] = useState(Boolean(token && schoolId));
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  useEffect(() => { if (!token || !schoolId) return; let cancelled = false; const id = ++sequence.current;
    verifyCertificate({ schoolId, token }).then((r) => { if (!cancelled && id === sequence.current) setResult(r); }).catch((e) => { if (!cancelled && id === sequence.current) setError(certificateError(e)); }).finally(() => { if (!cancelled) setQrLoading(false); }); return () => { cancelled = true; };
  }, [schoolId, token]);
  function resetLookup() { sequence.current++; setBusy(false); setQrLoading(false); setResult(null); setError(""); }
  async function verify() { const id = ++sequence.current; setBusy(true); setError(""); setResult(null);
    try { const value = await verifyCertificate({ schoolId: school.trim(), refNo: number.trim() }); if (id === sequence.current) setResult(value); } catch (e) { if (id === sequence.current) setError(certificateError(e)); } finally { if (id === sequence.current) setBusy(false); }
  }
  return <Card className="mx-auto max-w-2xl p-5 sm:p-7"><ShieldCheck size={30} className="text-secondary" /><h2 className="mt-3 text-xl font-semibold">Verify a certificate</h2><p className="mt-2 text-sm text-on-surface-variant">Scan the QR on a certificate, or enter its school ID and certificate number. Verification shows current validity; personal and salary details remain private.</p>
    <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void verify(); }}><Field label="School ID" required><Input required maxLength={128} value={school} onChange={(e) => { resetLookup(); setSchool(e.target.value); }} /></Field><Field label="Certificate number" required><Input required maxLength={40} placeholder="CERT/2026/0001" value={number} onChange={(e) => { resetLookup(); setNumber(e.target.value); }} /></Field><Button type="submit" disabled={busy} className="sm:col-span-2">Verify certificate</Button></form>
    {(busy || qrLoading) && <LoadingSkeleton variant="form" label="Checking certificate validity…" className="mt-5" />}{error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
    {result && <div role="status" className="mt-5 rounded-lg border border-outline-variant p-4"><Badge tone={result.status === "Valid" ? "success" : result.status === "Not found" ? "neutral" : "danger"}>{result.status === "Not found" ? "Certificate not found" : result.status}</Badge>{result.title && <h3 className="mt-3 font-semibold">{result.title}</h3>}{result.school && <p className="mt-1 text-sm">{result.school}</p>}{result.refNo && <p className="mt-2 font-mono text-sm">{result.refNo}</p>}{result.issuedOn && <p className="mt-1 text-sm text-on-surface-variant">Issued {result.issuedOn}{result.validTill ? ` · Valid until ${result.validTill}` : ""}</p>}{result.status === "Revoked" && <p className="mt-2 text-sm">This certificate is no longer valid. Contact the issuing school.</p>}{result.status === "Not found" && <p className="mt-2 text-sm">Check the school ID and reference, or contact the issuing school for older certificates.</p>}</div>}
  </Card>;
}
