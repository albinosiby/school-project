"use client";
// The teacher's own `ops_homework` plus the teaching data (classes, rosters, subjects) every assignments view needs.
import { useCallback, useMemo } from "react";
import { useCollection } from "@/lib/useCollection";
import { classRoster, useTeachingData } from "../teaching";
import { ownHomework, type Homework, type RosterStudent } from "./logic";

export function useAssignments() {
  const data = useTeachingData();
  const hw = useCollection<Homework>("ops_homework", data.teaching, [["teacherId", "==", data.staffId]]);
  const rows = useMemo(() => ownHomework(hw.rows, data.staffId), [hw.rows, data.staffId]);
  const { students } = data;
  const rosters = useMemo(() => {
    const ids = new Set(rows.map((h) => h.classId));
    return new Map([...ids].map((id) => [id, classRoster(students, id).map((s): RosterStudent => ({ id: s.id, name: s.name, roll: s.roll }))]));
  }, [rows, students]);
  const rosterOf = useCallback((classId: string) => rosters.get(classId) ?? [], [rosters]);
  return { data, hw, rows, rosterOf, ready: data.ready && hw.ready };
}
