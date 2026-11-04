"use client";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";
import { Checkbox } from "./Field";
import { EmptyState } from "./Misc";

export type Column<T> = {
  key: string; header: string; render?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number; className?: string;
};

export function SearchBox({ value, onChange, placeholder = "Search…", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="h-10 w-full rounded border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-sm placeholder:text-outline focus:border-secondary focus:outline-2 focus:outline-secondary/30" />
    </div>
  );
}

export function DataTable<T extends { id: string }>({
  rows, columns, searchText, pageSize = 8, selectable, selected, onSelectedChange, onRowClick, empty, toolbar,
}: {
  rows: T[]; columns: Column<T>[]; searchText?: (row: T) => string; pageSize?: number;
  selectable?: boolean; selected?: string[]; onSelectedChange?: (ids: string[]) => void;
  onRowClick?: (row: T) => void; empty?: React.ReactNode; toolbar?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const view = useMemo(() => {
    let r = rows;
    if (q && searchText) r = r.filter((x) => searchText(x).toLowerCase().includes(q.toLowerCase()));
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) r = [...r].sort((a, b) => {
        const x = col.sortValue!(a), y = col.sortValue!(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
    }
    return r;
  }, [rows, q, sort, searchText, columns]);

  const pages = Math.max(1, Math.ceil(view.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = view.slice(cur * pageSize, cur * pageSize + pageSize);
  const sel = selected ?? [];
  const allOn = slice.length > 0 && slice.every((r) => sel.includes(r.id));

  return (
    <div>
      {(searchText || toolbar) && (
        <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
          {searchText && <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} className="w-full max-w-xs" />}
          <div className="ml-auto flex items-center gap-2">{toolbar}</div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-outline-variant/60 bg-surface-container-low">
              {selectable && (
                <th className="w-10 py-2.5 pl-5"><Checkbox aria-label="Select all" checked={allOn}
                  onChange={(e) => onSelectedChange?.(e.target.checked ? [...new Set([...sel, ...slice.map((r) => r.id)])] : sel.filter((id) => !slice.some((r) => r.id === id)))} /></th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={cn("px-4 py-2.5 t-label-caps !text-[11px] text-on-surface-variant first:pl-5", c.className)}>
                  {c.sortValue ? (
                    <button className="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-on-surface"
                      onClick={() => setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))}>
                      {c.header}{sort?.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.id} onClick={() => onRowClick?.(r)}
                className={cn("border-b border-outline-variant/40 last:border-0", onRowClick && "cursor-pointer hover:bg-surface-container-low")}>
                {selectable && (
                  <td className="w-10 py-3 pl-5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox aria-label="Select row" checked={sel.includes(r.id)}
                      onChange={(e) => onSelectedChange?.(e.target.checked ? [...sel, r.id] : sel.filter((id) => id !== r.id))} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3 align-middle first:pl-5", c.className)}>
                    {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {slice.length === 0 && (empty ?? <EmptyState title="Nothing to show" hint="Try changing your search or filters." />)}
      </div>
      {view.length > pageSize && (
        <div className="flex items-center justify-between px-5 py-3 text-on-surface-variant">
          <span>Showing {cur * pageSize + 1}–{Math.min(view.length, (cur + 1) * pageSize)} of {view.length}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
