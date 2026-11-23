"use client";
import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Field, Input } from "@/components/ui";
import type { Recipient, RecipientKind } from "./types";

export function RecipientPicker({ kind, rows, value, onChange }: { kind: RecipientKind; rows: Recipient[]; value: string; onChange: (id: string) => void }) {
  const id = useId(), [open, setOpen] = useState(false), [q, setQ] = useState(""), [active, setActive] = useState(-1);
  const label = kind === "staff" ? "Staff member" : "Student";
  const subtitle = (row: Recipient) => kind === "staff" ? [row.empId, row.designation || row.role].filter(Boolean).join(" · ") : [row.grn, row.grade && `Grade ${row.grade}${row.section ? `-${row.section}` : ""}`].filter(Boolean).join(" · ");
  const selected = rows.find((row) => row.id === value);
  const matches = useMemo(() => rows.filter((row) => !row.deleted && q.toLowerCase().trim().split(/\s+/).every((word) => [row.name, row.empId, row.grn, row.designation, row.role, row.grade].join(" ").toLowerCase().includes(word))).sort((a, b) => a.name.localeCompare(b.name)), [rows, q]);
  const shown = matches.slice(0, 40), index = active >= 0 && active < shown.length ? active : -1;
  const pick = (recipient: Recipient) => { onChange(recipient.id); setOpen(false); setQ(""); setActive(-1); };
  return <div><Field label={label} required><span className="relative block">
    <Search size={16} className="pointer-events-none absolute left-3 top-3 text-outline" />
    <Input role="combobox" aria-label={label} aria-required="true" aria-expanded={open} aria-autocomplete="list" aria-controls={open ? id : undefined} aria-activedescendant={open && index >= 0 ? `${id}-${shown[index].id}` : undefined}
      className="pl-9" autoComplete="off" placeholder={`Search ${kind === "staff" ? "staff name or employee number" : "student name or GRN"}…`}
      value={open ? q : selected ? `${selected.name} · ${subtitle(selected)}` : ""}
      onFocus={() => { setQ(""); setOpen(true); setActive(-1); }} onBlur={() => { setOpen(false); setQ(""); setActive(-1); }}
      onChange={(event) => { setQ(event.target.value); onChange(""); setActive(-1); setOpen(true); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setOpen(true); setActive(shown.length ? event.key === "ArrowDown" ? (index + 1) % shown.length : (index <= 0 ? shown.length : index) - 1 : -1); }
        if (event.key === "Enter" && open) { event.preventDefault(); if (index >= 0) pick(shown[index]); }
      }} />
  </span></Field>{open && <ul id={id} role="listbox" aria-label={`${label} suggestions`} className="mt-2 max-h-52 overflow-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-1 shadow">
    {shown.map((row, i) => <li key={row.id} role="presentation"><button type="button" role="option" aria-selected={row.id === value} id={`${id}-${row.id}`} tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(row)} className={`w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-container ${i === index ? "bg-surface-container" : ""}`}>
      <span className="block font-semibold">{row.name}</span><span className="text-xs text-on-surface-variant">{subtitle(row)}</span>
    </button></li>)}
    {!shown.length && <li className="p-3 text-sm text-on-surface-variant">No matching {kind === "staff" ? "staff members" : "students"}.</li>}
    {matches.length > shown.length && <li className="p-2 text-xs text-on-surface-variant">Refine your search to see more results.</li>}
  </ul>}</div>;
}
