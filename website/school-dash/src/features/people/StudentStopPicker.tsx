"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Field, Input } from "@/components/ui";
import { cleanStopName, STOP_NAME_MAX_LENGTH, stopNameError, stopNameKey, stopSuggestions } from "@/features/transport/busStops";
import type { Bus } from "@/features/transport/types";

export function StudentStopPicker({ buses, busId, name, disabled, error, onChange }: {
  buses: Bus[]; busId: string; name: string; disabled: boolean; error: string;
  onChange: (name: string, id?: string) => void;
}) {
  const listId = useId();
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = stopSuggestions(buses, busId, name);
  const options = suggestions.slice(0, 8).map((stop) => ({ ...stop, label: stop.onBus ? stop.name : `${stop.name} · Add to this bus` }));
  if (!stopNameError(name) && !suggestions.some((stop) => stopNameKey(stop.name) === stopNameKey(name)))
    options.push({ name: cleanStopName(name), id: undefined, onBus: false, label: `Add “${cleanStopName(name)}”` });
  const expanded = open && !disabled && options.length > 0;
  const selected = active >= 0 && active < options.length ? active : -1;
  useEffect(() => {
    if (expanded && selected >= 0) list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [expanded, selected]);
  const pending = Boolean(cleanStopName(name)) && !suggestions.some((stop) => stop.onBus && stopNameKey(stop.name) === stopNameKey(name));
  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.name, option.id); setOpen(false); setActive(-1);
  }
  return <div className="relative">
    <Field label="Bus stop" required error={error} hint={pending ? "This stop will be added to the selected bus when you save. Set its route order and timings under Transport." : "Select a suggestion or enter a new stop name."}>
      <Input role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId} aria-required="true" aria-invalid={Boolean(error)}
        aria-activedescendant={expanded && selected >= 0 ? `${listId}-${selected}` : undefined}
        autoComplete="off" maxLength={STOP_NAME_MAX_LENGTH} placeholder="Type a stop name…" disabled={disabled} value={name}
        onFocus={() => setOpen(true)}
        onChange={(event) => { onChange(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); setActive(-1); }
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
            event.preventDefault(); setOpen(true);
            setActive(event.key === "ArrowDown" ? (selected + 1) % options.length : (selected <= 0 ? options.length : selected) - 1);
          }
          if (event.key === "Enter" && expanded && selected >= 0) { event.preventDefault(); choose(selected); }
        }} />
    </Field>
    {expanded && <ul ref={list} id={listId} role="listbox" aria-label="Bus stop suggestions" className="mt-2 max-h-48 w-full overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-md">
      {options.map((option, index) => <li key={stopNameKey(option.name)} role="presentation">
        <button type="button" role="option" id={`${listId}-${index}`} aria-selected={selected === index} tabIndex={-1}
          className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-container ${selected === index ? "bg-surface-container" : ""}`}
          onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>{option.label}</button>
      </li>)}
    </ul>}
  </div>;
}
