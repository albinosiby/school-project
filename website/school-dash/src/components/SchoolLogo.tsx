"use client";

import Image from "next/image";
import { useState } from "react";
import { Logo } from "@/components/Logo";

export function SchoolLogo({ src, size, alt }: { src?: string; size: number; alt: string }) {
  const [failed, setFailed] = useState<string>();
  if (!src || failed === src) return <Logo size={size} />;
  return <Image unoptimized src={src} alt={alt} width={size} height={size}
    className="rounded object-contain" style={{ width: size, height: size }} onError={() => setFailed(src)} />;
}
