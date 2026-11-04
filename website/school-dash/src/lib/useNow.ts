"use client";
import { useEffect, useState } from "react";

/** Current time in ms, refreshed every `everyMs` (render code must not call Date.now() directly). */
export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), everyMs); return () => clearInterval(t); }, [everyMs]);
  return now;
}
