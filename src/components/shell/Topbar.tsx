"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CalendarDays, LogOut, Menu, Search, X } from "lucide-react";
import { useMemo, useRef, useState, useEffect } from "react";
import { useCollection } from "@/lib/useCollection";
import { Avatar } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { EXTRA_PAGES, NAV } from "./nav";
import { NavLinks, SchoolBadge } from "./Sidebar";

type Me = { id: string; name: string; title: string; role: string };
type Student = { id: string; name: string; grn: string; grade: string; section: string };
type Notif = { id: string; read?: boolean };
type School = { id: string; academicYear?: string };

export function Topbar() {
  const router = useRouter();
  const { logout } = useAuth();
  const { rows: me } = useCollection<Me>("me");
  const { rows: students } = useCollection<Student>("students");
  const { rows: notifs } = useCollection<Notif>("notifications");
  const ay = useCollection<School>("school").rows[0]?.academicYear;
  const [menu, setMenu] = useState(false);
  const path = usePathname();
  const [menuPath, setMenuPath] = useState(path);
  if (menuPath !== path) { setMenuPath(path); setMenu(false); } // close the drawer on navigation
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const unread = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    if (!menu) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [menu]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const pages = [...NAV, ...EXTRA_PAGES].filter((p) => p.label.toLowerCase().includes(t)).map((p) => ({ key: p.href, label: p.label, hint: "Page", href: p.href }));
    const stu = students.filter((s) => `${s.name ?? ""} ${s.grn ?? ""}`.toLowerCase().includes(t)).slice(0, 5)
      .map((s) => ({ key: s.id, label: s.name, hint: [s.grn, s.grade && `Gr ${s.grade}${s.section ? `-${s.section}` : ""}`].filter(Boolean).join(" · "), href: `/students?q=${encodeURIComponent(s.name)}` }));
    return [...pages, ...stu].slice(0, 8);
  }, [q, students]);

  const go = (href: string) => { setOpen(false); setQ(""); router.push(href); };
  const user = me[0];

  return (
    <header className="sticky top-0 z-30 flex h-[70px] items-center gap-3 border-b border-outline-variant/60 bg-surface-container-lowest/90 px-4 backdrop-blur sm:gap-4 sm:px-6">
      <button onClick={() => setMenu(true)} aria-label="Open navigation menu" aria-expanded={menu} className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container lg:hidden"><Menu size={20} /></button>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-inverse-surface/40" onClick={() => setMenu(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-surface-container-low shadow-pop">
            <div className="flex items-start justify-between"><SchoolBadge /><button onClick={() => setMenu(false)} aria-label="Close navigation menu" className="m-3 cursor-pointer rounded p-1 text-outline hover:bg-surface-container"><X size={18} /></button></div>
            <NavLinks onNavigate={() => setMenu(false)} />
          </aside>
        </div>
      )}
      <div ref={box} className="relative w-full max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" && results[0]) go(results[0].href); if (e.key === "Escape") setOpen(false); }}
          placeholder="Search students, GRN, pages…" aria-label="Global search"
          className="h-10 w-full rounded-lg border border-outline-variant/60 bg-surface-container-low pl-9 pr-3 text-sm placeholder:text-outline focus:border-secondary focus:bg-surface-container-lowest focus:outline-2 focus:outline-secondary/30" />
        {open && q && (
          <div className="absolute left-0 right-0 top-12 overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-container-lowest shadow-pop">
            {results.length === 0 ? <p className="p-4 text-on-surface-variant">No matches for “{q}”.</p> : results.map((r) => (
              <button key={r.key} onClick={() => go(r.href)} className="flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left hover:bg-surface-container-low">
                <span className="font-medium">{r.label}</span><span className="text-xs text-outline">{r.hint}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
        {ay && <span className="hidden h-9 items-center gap-2 rounded-lg border border-outline-variant/60 bg-info-container/50 px-3 text-sm font-medium text-secondary md:flex" title="Current academic year (change it in Settings)">
          <CalendarDays size={16} />AY {ay}
        </span>}
        <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative grid size-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container">
          <Bell size={19} />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full border-2 border-white bg-error" />}
        </Link>
        <Link href="/profile" aria-label="My profile" className="flex items-center gap-3 border-l border-outline-variant/60 pl-4">
          <Avatar name={user?.name ?? "—"} size={36} />
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold leading-4">{user?.name}</span>
            <span className="text-xs text-outline">{[user?.title, user?.role].filter(Boolean).join(" • ")}</span>
          </span>
        </Link>
        <button onClick={async () => { try { await logout(); } finally { router.replace("/login"); } }} aria-label="Sign out" title="Sign out" className="grid size-9 cursor-pointer place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"><LogOut size={18} /></button>
      </div>
    </header>
  );
}
