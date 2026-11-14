"use client";
import { useCollection } from "./useCollection";
import { useNow } from "./useNow";
import { schoolDate, schoolTimeZone } from "../../../functions/schoolTime";
export { schoolDate, schoolTimeZone };

export function useSchoolClock() {
  const config = useCollection<{ id: string; timezone?: string }>("set_config");
  const now = useNow(30_000);
  const timezone = schoolTimeZone(config.rows.find((row) => row.id === "regional")?.timezone);
  const time = new Intl.DateTimeFormat("en-IN", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: true }).format(now).toUpperCase();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).format(now));
  return { now, timezone, date: schoolDate(now, timezone), time, hour, label: timezone === "Asia/Kolkata" ? "IST" : timezone === "Asia/Dubai" ? "GST" : timezone };
}
