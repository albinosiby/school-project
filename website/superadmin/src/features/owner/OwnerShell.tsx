"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Building2, Inbox, LayoutDashboard, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/authContext";
import { useLeads } from "./data";

const NAV = [
  { href: "/owner", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/owner/schools", label: "Schools", icon: Building2 },
  { href: "/owner/leads", label: "Demo requests", icon: Inbox },
] as const;

function Links({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const newLeads = useLeads().rows.filter((l) => l.status === "new").length;
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Owner console">
      {NAV.map((n) => {
        const on = "exact" in n ? path === n.href : path === n.href || path.startsWith(n.href + "/");
        const Icon = n.icon;
        return (
          <Link key={n.href} href={n.href} onClick={onNavigate} aria-current={on ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-md border-l-[3px] px-3 py-2.5 text-sm transition-colors",
              on ? "border-secondary bg-info-container font-semibold text-secondary" : "border-transparent text-on-surface-variant hover:bg-surface-container")}>
            <Icon size={18} />{n.label}
            {n.href === "/owner/leads" && newLeads > 0 && <span className="ml-auto rounded-full bg-secondary px-2 text-xs font-semibold text-on-secondary" aria-label={`${newLeads} new`}>{newLeads}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-surface-container-lowest shadow-card"><Logo size={38} /></span>
      <div className="min-w-0"><p className="font-semibold">Edvio Platform</p><p className="flex items-center gap-1 text-xs text-outline"><ShieldCheck size={12} />Owner console</p></div>
    </div>
  );
}

function Account() {
  const { user, logout } = useAuth();
  return (
    <div className="border-t border-outline-variant/60 p-4">
      <p className="truncate text-xs text-outline">Signed in as</p>
      <p className="truncate text-sm font-semibold">{user?.email}</p>
      <button onClick={() => void logout()} className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-outline-variant px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container">
        <LogOut size={16} />Sign out
      </button>
    </div>
  );
}

/** Layout of the owner console (contract 16): its own navigation, separate from any school's admin shell. */
export function OwnerShell({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const path = usePathname();
  const [menuPath, setMenuPath] = useState(path);
  if (menuPath !== path) { setMenuPath(path); setMenu(false); }
  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-outline-variant/60 bg-surface-container-low lg:flex">
        <Brand /><Links /><Account />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-outline-variant/60 bg-surface-container-lowest/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setMenu(true)} aria-label="Open navigation menu" aria-expanded={menu} className="grid size-9 cursor-pointer place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container"><Menu size={20} /></button>
          <span className="font-semibold">Edvio Platform</span>
        </header>
        {menu && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-inverse-surface/40" onClick={() => setMenu(false)} />
            <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-surface-container-low shadow-pop">
              <div className="flex items-start justify-between"><Brand /><button onClick={() => setMenu(false)} aria-label="Close navigation menu" className="m-3 cursor-pointer rounded p-1 text-outline hover:bg-surface-container"><X size={18} /></button></div>
              <Links onNavigate={() => setMenu(false)} /><Account />
            </aside>
          </div>
        )}
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
