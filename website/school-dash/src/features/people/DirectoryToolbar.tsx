"use client";

import { ListFilter, Search, X } from "lucide-react";
import { Badge, Button, Input, ListToolbar } from "@/components/ui";

export type DirectoryFilter = { key: string; label: string; remove: () => void };

export function DirectoryToolbar({ query, onQuery, label, placeholder, filters, onFilter, onClear, result }: {
  query: string; onQuery: (value: string) => void; label: string; placeholder: string;
  filters: DirectoryFilter[]; onFilter: () => void; onClear: () => void; result: string;
}) {
  return <div className="border-b border-outline-variant/40 p-4 sm:px-5">
    <ListToolbar search={<div className="relative">
      <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
      <Input type="search" aria-label={label} placeholder={placeholder} value={query}
        onChange={(event) => onQuery(event.target.value)} className="pl-9" />
    </div>} actions={<>
      {(query || filters.length > 0) && <Button variant="ghost" size="sm" onClick={onClear}>Clear all</Button>}
      <Button variant="outline" size="sm" aria-haspopup="dialog" aria-label={filters.length ? `Filter (${filters.length} active)` : "Filter"} onClick={onFilter}>
        <ListFilter size={16} aria-hidden="true" />Filter{filters.length > 0 && <Badge tone="info">{filters.length}</Badge>}
      </Button>
    </>} />
    {filters.length > 0 && <div aria-label="Active filters" className="mt-3 flex flex-wrap gap-2">
      {filters.map((filter) => <button key={filter.key} type="button" onClick={filter.remove}
        aria-label={`Remove ${filter.label} filter`}
        className="inline-flex min-h-8 items-center gap-2 rounded-full bg-info-container px-3 py-1 text-xs font-medium text-secondary focus-visible:outline-2 focus-visible:outline-secondary">
        {filter.label}<X size={12} aria-hidden="true" />
      </button>)}
    </div>}
    {result && <p role="status" className="mt-3 text-xs text-on-surface-variant">{result}</p>}
  </div>;
}
