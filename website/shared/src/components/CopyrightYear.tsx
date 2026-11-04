"use client";
import { useSyncExternalStore } from "react";

/** The current year, read on the client only (a date read during prerender fails the static build). */
export function CopyrightYear() {
  const year = useSyncExternalStore(() => () => {}, () => new Date().getFullYear(), () => null);
  return <>{year ?? ""}</>;
}
