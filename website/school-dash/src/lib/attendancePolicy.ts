/** School-wide attendance warning policy; this is the sole default. */
export const DEFAULT_MINIMUM_ATTENDANCE = 75;
export type AttendancePolicy = { id: string; minimumPercent?: number };

export function minimumAttendance(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value : DEFAULT_MINIMUM_ATTENDANCE;
}

export function attendanceThresholdInput(input: string): number | undefined {
  const text = input.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined;
}
