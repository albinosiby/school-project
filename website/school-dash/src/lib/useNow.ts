"use client";
import { useEffect, useState } from "react";

/**
 * Current time in ms, refreshed every `everyMs` (render code must not call Date.now() directly).
 * Browsers pause timers in background or frozen tabs (Chrome Memory / Energy Saver), so the time is also refreshed
 * the moment the tab is shown, focused or restored; minute ticks land on the minute so "current period" flips on time.
 */
export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    // tick every everyMs from now; once the next boundary of everyMs comes, re-align the ticks to it
    let interval = setInterval(tick, everyMs);
    const first = setTimeout(() => { tick(); clearInterval(interval); interval = setInterval(tick, everyMs); }, everyMs - (Date.now() % everyMs));
    const wake = () => { if (document.visibilityState !== "hidden") tick(); };
    document.addEventListener("visibilitychange", wake);
    document.addEventListener("resume", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", wake);
      document.removeEventListener("resume", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
    };
  }, [everyMs]);
  return now;
}
