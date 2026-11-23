"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Field, Input } from "@/components/ui";
import { classLabel } from "@/features/fees/feePlan";

type StudentOption = {
  id: string; name: string; grn: string; grade: string; section?: string; streamId?: string;
};

const OPTION_LIMIT = 50;
const studentClass = (student: StudentOption) => `${classLabel(student.streamId ? `${student.grade}:${student.streamId}` : student.grade)}${student.section ? `-${student.section}` : ""}`;
const studentLabel = (student: StudentOption) => `${student.name} · ${student.grn} · ${studentClass(student)}`;

/** Search narrows existing records; free text never becomes a selected student. */
export function StudentSearchSelect({ students, value, onChange, error }: {
  students: readonly StudentOption[]; value: string; onChange: (id: string) => void; error?: string;
}) {
  const listId = useId();
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const selected = students.find((student) => student.id === value);
  const index = useMemo(() => students.map((student) => ({
    student, search: studentLabel(student).toLowerCase(),
  })).sort((a, b) => a.student.name.localeCompare(b.student.name) || a.student.grn.localeCompare(b.student.grn)), [students]);
  const matches = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return index.filter((entry) => words.every((word) => entry.search.includes(word)));
  }, [index, query]);
  const options = matches.slice(0, OPTION_LIMIT);
  const activeIndex = active >= 0 && active < options.length ? active : -1;

  useEffect(() => {
    if (open && activeIndex >= 0) list.current?.children[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex]);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.student.id);
    setOpen(false); setQuery(""); setActive(-1);
  }

  return <div>
    <Field label="Student" required error={error}>
      <span className="relative block">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-outline" />
        <Input role="combobox" aria-label="Student" aria-required="true" aria-invalid={Boolean(error)}
          aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${options[activeIndex].student.id}` : undefined}
          autoComplete="off" placeholder="Search student name or GRN…" className="pl-9 pr-9"
          value={open ? query : selected ? studentLabel(selected) : ""}
          onFocus={() => { setQuery(""); setOpen(true); setActive(-1); }}
          onClick={() => { if (!open) { setQuery(""); setOpen(true); setActive(-1); } }}
          onBlur={() => { setOpen(false); setQuery(""); setActive(-1); }}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(-1); onChange(""); }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault(); event.stopPropagation(); setOpen(false); setQuery(""); setActive(-1);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault(); setOpen(true);
              if (options.length) setActive(event.key === "ArrowDown" ? (activeIndex + 1) % options.length : (activeIndex <= 0 ? options.length : activeIndex) - 1);
            }
            if (event.key === "Enter" && open) { event.preventDefault(); if (activeIndex >= 0) choose(activeIndex); }
          }} />
        <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-3 text-outline" />
      </span>
    </Field>
    {open && <div className="mt-2 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-md">
      <ul ref={list} id={listId} role="listbox" aria-label="Student suggestions" className="max-h-52 overflow-y-auto py-1">
        {options.map(({ student }, position) => <li key={student.id} role="presentation">
          <button type="button" role="option" id={`${listId}-${student.id}`} aria-label={studentLabel(student)} aria-selected={student.id === value} tabIndex={-1}
            className={`w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-surface-container ${position === activeIndex || student.id === value ? "bg-surface-container" : ""}`}
            onMouseDown={(event) => event.preventDefault()} onClick={() => choose(position)}>
            <span className="block break-words font-medium">{student.name}</span>
            <span className="block text-xs text-on-surface-variant">{student.grn} · {studentClass(student)}</span>
          </button>
        </li>)}
      </ul>
      {!options.length && <p role="status" className="px-3 pb-3 pt-1 text-sm text-on-surface-variant">{students.length ? "No students match. Try another name or GRN." : "No students available."}</p>}
      {matches.length > OPTION_LIMIT && <p className="border-t border-outline-variant/40 px-3 py-2 text-xs text-on-surface-variant">Showing {OPTION_LIMIT} of {matches.length} students. Refine your search to find others.</p>}
    </div>}
  </div>;
}
