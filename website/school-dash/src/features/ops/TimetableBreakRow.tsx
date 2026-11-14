import { Badge } from "@/components/ui";
import type { SchoolSlot } from "./classActivity";

export function TimetableBreakRow({ slot, columns, current = false }: { slot: SchoolSlot; columns: number; current?: boolean }) {
  return <tr className={current ? "bg-info-container/50" : "bg-surface-container-low"}>
    <th scope="row" className="px-4 py-3 text-sm font-semibold">
      <div className="flex flex-wrap items-center gap-2">{slot.label}{current && <> <Badge tone="info">Now</Badge></>}</div>
    </th>
    <td colSpan={columns - 1} className="px-4 py-3 text-xs tabular-nums text-on-surface-variant">{slot.from}–{slot.to}</td>
  </tr>;
}
