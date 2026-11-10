export type BellBreak = { name: string; start: string; duration: number };
export type Bell = { gates: string; start: string; end: string; periods: number; len: number; breaks: BellBreak[] };
type LegacyBell = { snackAfter?: number; snackMin?: number; lunchAfter?: number; lunchMin?: number };

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
export const toMin = (time: string) => { const [h, m] = time.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
export const fmtMin = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Convert saved period-relative breaks to exact times without changing the previous school day. */
export function initialBell(saved?: Partial<Bell> & LegacyBell): Bell {
  const day = { gates: saved?.gates ?? "07:45", start: saved?.start ?? "08:30", end: saved?.end ?? "14:45", periods: saved?.periods ?? 8, len: saved?.len ?? 40 };
  if (Array.isArray(saved?.breaks)) return { ...day, breaks: saved.breaks.map((item) => ({ ...item })) };
  const breaks: BellBreak[] = [];
  let time = toMin(day.start);
  for (let period = 1; period <= Math.min(day.periods, 12); period++) {
    time += day.len;
    if (period === (saved?.snackAfter ?? 3) && (saved?.snackMin ?? 15) > 0) {
      const duration = saved?.snackMin ?? 15;
      breaks.push({ name: "Morning break", start: fmtMin(time), duration }); time += duration;
    }
    if (period === (saved?.lunchAfter ?? 5) && (saved?.lunchMin ?? 30) > 0) {
      const duration = saved?.lunchMin ?? 30;
      breaks.push({ name: "Lunch", start: fmtMin(time), duration }); time += duration;
    }
  }
  return { ...day, breaks };
}

const orderedBreaks = (breaks: BellBreak[]) => [...breaks].sort((a, b) => a.start.localeCompare(b.start));
export const normalizedBell = (day: Bell): Bell => ({ ...day, breaks: orderedBreaks(day.breaks).map((item) => ({ ...item, name: item.name.trim() })) });

/** Full teaching periods move past fixed breaks; unused time is visible rather than silently shortening a lesson. */
export function buildSchedule(day: Bell) {
  let time = toMin(day.start), nextBreak = 0;
  const rows: { label: string; from: string; to: string; break?: boolean; gap?: boolean }[] = [];
  // Incomplete entries are excluded from the live preview; bellError prevents saving them.
  const breaks = orderedBreaks(day.breaks.filter((item) => timePattern.test(item.start) && Number.isInteger(item.duration) && item.duration > 0 && item.duration <= 180));
  const length = Number.isInteger(day.len) && day.len > 0 && day.len <= 90 ? day.len : 0;
  const addBreak = (item: BellBreak) => {
    const start = toMin(item.start), end = start + item.duration;
    if (time < start) rows.push({ label: "Unallocated time", from: fmtMin(time), to: item.start, gap: true });
    rows.push({ label: item.name.trim() || "Break", from: item.start, to: fmtMin(end), break: true });
    time = Math.max(time, end);
  };
  for (let period = 1; period <= Math.min(day.periods, 12); period++) {
    while (nextBreak < breaks.length && toMin(breaks[nextBreak]!.start) < time + length) addBreak(breaks[nextBreak++]!);
    rows.push({ label: `Period ${period}`, from: fmtMin(time), to: fmtMin(time + length) });
    time += length;
  }
  while (nextBreak < breaks.length) addBreak(breaks[nextBreak++]!);
  return { rows, endsAt: time };
}

export function bellError(day: Bell) {
  if (![day.gates, day.start, day.end].every((value) => timePattern.test(value))) return "Enter all times as HH:mm.";
  if (toMin(day.start) <= toMin(day.gates)) return "Classes must start after the gates open.";
  if (toMin(day.end) <= toMin(day.start)) return "School must close after the first period starts.";
  if (!Number.isInteger(day.periods) || day.periods < 1 || day.periods > 12) return "Use between 1 and 12 periods.";
  if (!Number.isInteger(day.len) || day.len < 20 || day.len > 90) return "Period length should be between 20 and 90 minutes.";
  for (const [index, item] of day.breaks.entries()) {
    if (!item.name.trim() || item.name.trim().length > 80) return `Break ${index + 1}: enter a name of up to 80 characters.`;
    if (!timePattern.test(item.start)) return `${item.name.trim()}: enter a valid start time.`;
    if (!Number.isInteger(item.duration) || item.duration < 1 || item.duration > 180) return `${item.name.trim()}: duration must be between 1 and 180 minutes.`;
    if (toMin(item.start) < toMin(day.start) || toMin(item.start) + item.duration > toMin(day.end)) return `${item.name.trim()}: the entire break must be within the school day.`;
  }
  const breaks = orderedBreaks(day.breaks);
  for (let index = 1; index < breaks.length; index++) {
    const previous = breaks[index - 1]!, current = breaks[index]!;
    if (toMin(current.start) < toMin(previous.start) + previous.duration) return `${current.name.trim()} overlaps ${previous.name.trim()}.`;
  }
  const endsAt = buildSchedule(day).endsAt;
  if (endsAt > toMin(day.end)) return `The schedule runs until ${fmtMin(endsAt)}, past the closing time of ${day.end}. Shorten the periods or move closing time.`;
  return "";
}

/** Keep existing summary fields for other consumers and persist structured breaks for reopening setup. */
export function bellRecord(day: Bell) {
  const saved = normalizedBell(day);
  return {
    gates: saved.gates, start: saved.start, end: saved.end, periodCount: saved.periods, periodLength: saved.len, breaks: saved.breaks,
    classes: `${saved.start} – ${saved.end}`, periods: `${saved.periods} Periods × ${saved.len} min`,
    recess: saved.breaks.map((item) => `${item.name} ${item.start}–${fmtMin(toMin(item.start) + item.duration)} (${item.duration} min)`).join(" + ") || "No breaks",
  };
}
