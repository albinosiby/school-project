"use client";
// Missing-attendance flags shared by the timetable and the mark-attendance page: the school clock and working days from
// `school/mobile`, the teacher's slots of any date (own periods + covers), and the submitted registers.
import { useMemo } from "react";
import type { AttRec, Period, Substitution } from "@/features/ops/logic";
import { useNow } from "@/lib/useNow";
import { bellTimeline, type MobilePolicy } from "../teaching";
import { attendanceClock, markedKeys, missingDays, missingSlots, slotsForDate, type SchoolPolicy, type Slot } from "./logic";

export function useAttendanceFlags(data: { policy?: MobilePolicy; periods: Period[]; subs: Substitution[] }, records: AttRec[]) {
  const now = useNow(60_000);
  const policy = data.policy as (MobilePolicy & SchoolPolicy) | undefined;
  const clock = useMemo(() => attendanceClock(policy, bellTimeline(policy).periods, new Date(now)), [policy, now]);
  const marked = useMemo(() => markedKeys(records), [records]);
  return useMemo(() => {
    const cache = new Map<string, Slot[]>();
    const slotsOf = (date: string) => { let s = cache.get(date); if (!s) { s = slotsForDate(date, data.periods, data.subs); cache.set(date, s); } return s; };
    const missingOn = (date: string) => missingSlots(date, slotsOf(date), marked, clock);
    /** every flagged day from the academic year start (or 30 days back) up to today, newest first */
    const allMissing = missingDays(clock.flagsFrom, clock.today, slotsOf, marked, clock).reverse();
    return { clock, policy, marked, slotsOf, missingOn, allMissing };
  }, [clock, policy, marked, data.periods, data.subs]);
}
