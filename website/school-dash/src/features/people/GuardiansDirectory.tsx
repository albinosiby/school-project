"use client";

import { useMemo, useState } from "react";
import { LoadingSkeleton, Badge, Button, Card, DataTable, EmptyState, Field, Select, SlideOver, type Column } from "@/components/ui";
import { defaultMissingDocuments } from "@/features/admissions/admissionDocuments";
import { useSchoolUsers, type SchoolUser } from "@/lib/parentAccount";
import { DirectoryToolbar, type DirectoryFilter } from "./DirectoryToolbar";
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
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState("");
  const [family, setFamily] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const rows = useMemo(() => buildGuardianRows(students, users).map((row) => ({ ...row,
    missing: [...row.students.keys()].reduce((sum, id) => sum + (missing.get(id) ?? defaultMissingDocuments), 0),
    search: [row.name, row.phone, row.phone.replace(/\D/g, ""), row.email,
      ...[...row.students.values()].map((student) => student.name)].join(" ").toLowerCase(),
  })), [students, users, missing]);
  const search = query.trim().toLowerCase();
  const view = useMemo(() => rows.filter((row) => (!search || row.search.includes(search))
    && (!documents || (documents === "missing" ? row.missing > 0 : row.missing === 0))
    && (!family || (family === "multiple" ? row.students.size > 1 : row.students.size === 1))), [rows, search, documents, family]);
  const filters: DirectoryFilter[] = [
    ...(documents ? [{ key: "documents", label: documents === "missing" ? "Missing documents" : "Documents complete", remove: () => setDocuments("") }] : []),
    ...(family ? [{ key: "family", label: family === "multiple" ? "Multiple students" : "One student", remove: () => setFamily("") }] : []),
  ];
  const clearFilters = () => { setDocuments(""); setFamily(""); };
  const counts = new Map(rows.map((row) => [row.id, row.missing]));
  const columns: Column<Guardian>[] = [
    { key: "name", header: "Guardian", sortValue: (row) => row.name, render: (row) => <span className="font-semibold">{row.name}</span> },
    { key: "contact", header: "Contact", render: (row) => <>{row.phone || "—"}<p className="text-xs text-outline">{row.email}</p></> },
    { key: "students", header: "Students", sortValue: (row) => row.students.size,
      render: (row) => <span>{row.students.size} {row.students.size === 1 ? "student" : "students"}</span> },
    { key: "missing", header: "Documents", render: (row) => {
      const count = counts.get(row.id) ?? 0;
      return <Badge tone={count ? "warning" : "success"}>{count} missing</Badge>;
    } },
  ];
  return <>
    <Card className="min-w-0">
      <DirectoryToolbar query={query} onQuery={setQuery} label="Search guardians" placeholder="Search guardian, student, phone or email…"
        filters={filters} onFilter={() => setFiltersOpen(true)} onClear={() => { setQuery(""); clearFilters(); }}
        result={`${view.length} of ${rows.length} guardians`} />
      <DataTable rows={view} columns={columns} pageSize={10} resetKey={JSON.stringify([search, documents, family])}
        empty={<EmptyState title={rows.length ? "No guardians match" : "No guardians yet"} hint={rows.length ? "Try changing your search or filters." : "Guardian contacts will appear when students are added."} />} />
    </Card>
    <SlideOver open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter guardians"
      footer={<><Button variant="ghost" disabled={!filters.length} onClick={clearFilters}>Clear filters</Button><Button onClick={() => setFiltersOpen(false)}>Done</Button></>}>
      <div className="grid gap-4">
        <Field label="Documents"><Select value={documents} onChange={(event) => setDocuments(event.target.value)}>
          <option value="">All documents</option><option value="missing">Missing documents</option><option value="complete">Documents complete</option>
        </Select></Field>
        <Field label="Linked students"><Select value={family} onChange={(event) => setFamily(event.target.value)}>
          <option value="">All families</option><option value="one">One student</option><option value="multiple">Multiple students</option>
        </Select></Field>
      </div>
    </SlideOver>
  </>;
}

/** Subscribe to parent account details only while the Guardians tab is open. */
export function GuardiansPanel({ students, missing }: { students: Student[]; missing: Map<string, number> }) {
  const { users, ready } = useSchoolUsers();
  if (!ready) return <LoadingSkeleton variant="table" label="Loading guardian contacts…" />;
  return <GuardiansDirectory students={students} users={users} missing={missing} />;
}
