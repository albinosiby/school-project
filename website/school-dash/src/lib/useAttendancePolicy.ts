"use client";

import { minimumAttendance, type AttendancePolicy } from "./attendancePolicy";
import { useCollection } from "./useCollection";

export function useAttendancePolicy() {
  const settings = useCollection<AttendancePolicy>("set_config");
  const policy = settings.rows.find((row) => row.id === "attendance_policy");
  return { minimumPercent: minimumAttendance(policy?.minimumPercent), ready: settings.ready, error: settings.error };
}
