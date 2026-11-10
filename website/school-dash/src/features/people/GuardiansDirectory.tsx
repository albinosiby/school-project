"use client";

import Link from "next/link";
import { Badge, Card, CardHeader, DataTable, type Column } from "@/components/ui";
import { defaultMissingDocuments } from "@/features/admissions/admissionDocuments";
import { studentProfileHref } from "./studentLogic";
import type { SchoolUser } from "@/lib/parentAccount";
import type { Student } from "./StudentsView";

type Guardian = { id: string; name: string; phone: string; email: string; students: Map<string, { id: string; name: string }> };

function buildGuardianRows(students: Student[], users: SchoolUser[]) {
  const contacts = new Map<string, Guardian>();
  const usersById = new Map(users.filter((user) => user.role === "parent").map((user) => [user.id, user]));
  function add(studentId: string, studentName: string, name: string, phone: string, email: string, uid?: string) {
    if (!name.trim()) return;
    const phoneKey = phone.replace(/\D/g, "");
    const id = email.trim().toLowerCase() || (phoneKey && `${name.trim().toLowerCase()}:${phoneKey}`) || uid || `${studentId}:${name}`;
    const row = contacts.get(id) ?? { id, name, phone, email, students: new Map() };
    row.students.set(studentId, { id: studentId, name: studentName });
    if (!row.phone && phone) row.phone = phone;
    contacts.set(id, row);
  }
  for (const student of students) {
    if (student.guardian?.trim()) {
      add(student.id, student.name, student.guardian, student.phone || "", student.email || "");
      continue;
    }
    const linkedUsers = (student.guardianUids ?? []).map((uid) => usersById.get(uid));
    const linkedUser = linkedUsers.find((user) => user && user.id === student.emailGuardianUid) ?? linkedUsers.find(Boolean);
    if (linkedUser) add(student.id, student.name, linkedUser.name || "Parent", "", linkedUser.email || "", linkedUser.id);
  }
  return [...contacts.values()];
}

export function GuardiansDirectory({ students, users, missing }: {
  students: Student[]; users: SchoolUser[]; missing: Map<string, number>;
}) {
  const rows = buildGuardianRows(students, users);
  const columns: Column<Guardian>[] = [
    { key: "name", header: "Guardian", sortValue: (row) => row.name, render: (row) => <span className="font-semibold">{row.name}</span> },
    { key: "contact", header: "Contact", render: (row) => <>{row.phone || "—"}<p className="text-xs text-outline">{row.email}</p></> },
    { key: "students", header: "Students", render: (row) => <ul>{[...row.students.values()].map((student) =>
      <li key={student.id}><Link className="text-secondary hover:underline" href={studentProfileHref(student.id)}>{student.name}</Link></li>)}</ul> },
    { key: "missing", header: "Documents", render: (row) => {
      const count = [...row.students.keys()].reduce((sum, id) => sum + (missing.get(id) ?? defaultMissingDocuments), 0);
      return <Badge tone={count ? "warning" : "success"}>{count} missing</Badge>;
    } },
  ];
  return <Card><CardHeader title="Guardians" /><DataTable rows={rows} columns={columns} pageSize={10}
    searchText={(row) => [row.name, row.phone, row.email, ...[...row.students.values()].map((student) => student.name)].join(" ")} /></Card>;
}
