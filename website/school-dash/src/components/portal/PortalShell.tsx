"use client";
// Staff portal frame: the school badge, the portal links (teaching links only for teacher accounts) and a slim top bar.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/authContext";
import { useCollection } from "@/lib/useCollection";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";
import { SchoolBadge } from "@/components/shell/Sidebar";
import { PORTAL_NAV } from "./nav";

type School = { id: string; academicYear?: string };

export function PortalNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { teaching, canAddStaff, crew } = useStaffProfile();
  const links = PORTAL_NAV.filter((item) => (crew ? item.href === "/me" : (!("teaching" in item) || teaching) && (!("addStaff" in item) || canAddStaff)));
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Staff portal">
      {links.map(({ href, label, icon: Icon }) => {
        const on = href === "/me" ? path === "/me" : path === href || path.startsWith(href + "/");
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

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { logout } = useAuth();
  const { name, designation } = useStaffProfile();
  const ay = useCollection<School>("school").rows[0]?.academicYear;
  const [menu, setMenu] = useState(false);
  const path = usePathname();
  const [menuPath, setMenuPath] = useState(path);
  if (menuPath !== path) { setMenuPath(path); setMenu(false); }
  useEffect(() => {
    if (!menu) return;
    const key = (event: KeyboardEvent) => event.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [menu]);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-outline-variant/60 bg-surface-container-low lg:flex">
        <SchoolBadge />
        <p className="px-5 pb-1 text-xs font-semibold uppercase tracking-wider text-outline">Staff portal</p>
        <PortalNavLinks />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[70px] items-center gap-3 border-b border-outline-variant/60 bg-surface-container-lowest/90 px-4 backdrop-blur sm:gap-4 sm:px-6">
          <button onClick={() => setMenu(true)} aria-label="Open navigation menu" aria-expanded={menu} className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container lg:hidden"><Menu size={20} /></button>
          {menu && (
            <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
              <div className="absolute inset-0 bg-inverse-surface/40" onClick={() => setMenu(false)} />
              <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-surface-container-low shadow-pop">
                <div className="flex items-start justify-between"><SchoolBadge /><button onClick={() => setMenu(false)} aria-label="Close navigation menu" className="m-3 cursor-pointer rounded p-1 text-outline hover:bg-surface-container"><X size={18} /></button></div>
                <PortalNavLinks onNavigate={() => setMenu(false)} />
              </aside>
            </div>
          )}
          <p className="text-sm font-semibold text-on-surface-variant">Staff portal</p>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
            {ay && <span className="hidden h-9 items-center rounded-lg border border-outline-variant/60 bg-info-container/50 px-3 text-sm font-medium text-secondary md:flex">AY {ay}</span>}
            <Link href="/me/profile" aria-label="My profile" className="flex items-center gap-3 border-l border-outline-variant/60 pl-4">
              <Avatar name={name || "—"} size={36} />
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-semibold leading-4">{name}</span>
                <span className="text-xs text-outline">{designation}</span>
              </span>
            </Link>
            <button onClick={async () => { try { await logout(); } finally { router.replace("/login"); } }} aria-label="Sign out" title="Sign out" className="grid size-9 cursor-pointer place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"><LogOut size={18} /></button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
