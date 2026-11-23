"use client";
import { useSearchParams } from "next/navigation";
import { CertificateVerification } from "./CertificateVerification";
export function CertificateVerificationRoute() { const params = useSearchParams(); return <CertificateVerification key={`${params.get("school")}:${params.get("token")}`} schoolId={params.get("school") || ""} token={params.get("token") || ""} />; }
