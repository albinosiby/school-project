"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { NAV } from "./nav";

type School = { id: string; name: string; short: string; board: string; affiliation: string; city: string };

/** browser connectivity (Firestore keeps working from cache while offline) */
const useOnline = () => useSyncExternalStore((cb) => { window.addEventListener("online", cb); window.addEventListener("offline", cb); return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); }; },
  () => navigator.onLine, () => true);

/** Primary nav links, shared by the desktop sidebar and the mobile drawer */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Primary">
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = path === href || path.startsWith(href + "/");
        return (
          <Link key={href} href={href} onClick={onNavigate} aria-current={on ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-md border-l-[3px] px-3 py-2.5 text-sm transition-colors",
              on ? "border-secondary bg-info-container font-semibold text-secondary" : "border-transparent text-on-surface-variant hover:bg-surface-container")}>
            <Icon size={18} />{label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SchoolBadge() {
  const { rows } = useCollection<School>("school");
  const s = rows[0];
  const sub = [s?.affiliation && `Affiliation ${s.affiliation}`, s?.city].filter(Boolean).join(" • ");
  return (
    <div className="flex items-center gap-3 p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-surface-container-lowest shadow-card"><Logo size={38} /></span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{s?.short || s?.name || "…"}</span>
          {s?.board && <span className="rounded bg-success-container px-1.5 text-[11px] font-semibold text-success">{s.board}</span>}
        </div>
        {sub && <p className="truncate text-xs text-outline">{sub}</p>}
      </div>
    </div>
  );
}

export function Sidebar() {
  const online = useOnline();
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-outline-variant/60 bg-surface-container-low lg:flex">
      <SchoolBadge />
      <NavLinks />
      <div className="space-y-2 border-t border-outline-variant/60 p-4">
        <div role="status" className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium", online ? "border-success/30 bg-success-container text-success" : "border-warning/30 bg-warning-container text-warning")}>
          <span className={cn("size-2 rounded-full", online ? "bg-success" : "bg-warning")} />{online ? "Online · live sync" : "Offline · changes sync when reconnected"}
        </div>
      </div>
    </aside>
  );
}
