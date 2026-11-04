/**
 * Stylised product mockups (CSS only, no screenshots) for the landing page: the admin console window and the three phone
 * apps. Content mirrors real screens (names from the demo fixture) but is static.
 */
import { cn } from "cn";
import { Bell, BusFront, Check, CheckCheck, ClipboardCheck, MapPin, PhoneCall, X } from "lucide-react";
import type { AppKey } from "./content";

export function Window({ className, children, title = "Edvio · Admin" }: { className?: string; children: React.ReactNode; title?: string }) {
  return (
    <div className={cn("min-w-0 max-w-full overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-[0_24px_60px_-20px_rgb(0_23_54/0.35)] dark:shadow-[0_24px_60px_-20px_rgb(0_0_0/0.7)]", className)}>
      <div className="flex items-center gap-2 border-b bg-muted/60 px-3 py-2">
        <span className="size-2.5 rounded-full bg-[#FF5F57]" /><span className="size-2.5 rounded-full bg-[#FEBC2E]" /><span className="size-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-2 truncate text-[11px] text-muted-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function Phone({ className, children, label }: { className?: string; children: React.ReactNode; label?: string }) {
  return (
    <div className={cn("relative w-[172px] shrink-0 rounded-[28px] border-[6px] border-ink/90 bg-card text-card-foreground shadow-[0_20px_50px_-18px_rgb(0_23_54/0.5)] dark:border-[#2A3552]", className)} aria-label={label}>
      <div className="absolute left-1/2 top-0 h-4 w-16 -translate-x-1/2 rounded-b-xl bg-ink/90 dark:bg-[#2A3552]" />
      <div className="h-[340px] overflow-hidden rounded-[22px] pt-5 text-[10px] leading-tight">{children}</div>
    </div>
  );
}

const Bar = ({ w, c = "bg-brand" }: { w: string; c?: string }) => <div className={cn("h-1.5 rounded-full", c)} style={{ width: w }} />;

/** Admin console: dashboard tiles and the attendance table. */
export function AdminScreen() {
  return (
    <div className="grid min-w-0 grid-cols-[64px_1fr] text-[10px] sm:grid-cols-[112px_1fr] *:min-w-0">
      <aside className="space-y-2 border-r bg-muted/40 p-2.5">
        {["Dashboard", "Students", "Attendance", "Fees", "Exams", "Transport", "Approvals", "Settings"].map((s, i) => (
          <div key={s} className={cn("truncate rounded-md px-2 py-1", i === 2 ? "bg-brand text-white" : "text-muted-foreground")}>{s}</div>
        ))}
      </aside>
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between"><div className="font-semibold">Greenfield International School</div><div className="text-muted-foreground">AY 2026-27 · Term 2</div></div>
        <div className="mb-3 grid grid-cols-4 gap-2 *:min-w-0">
          {[["Present today", "1,146", "94%"], ["Fees collected", "₹42.6L", "81%"], ["Pending approvals", "7", ""], ["Buses running", "14", "2 trips"]].map(([k, v, s]) => (
            <div key={k} className="rounded-lg border bg-background p-2"><div className="text-[9px] text-muted-foreground">{k}</div><div className="font-heading text-sm font-semibold">{v}</div><div className="text-[9px] text-mint">{s}</div></div>
          ))}
        </div>
        <div className="min-w-0 overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[1fr_52px_40px_40px] gap-2 border-b bg-muted/50 px-2 py-1 text-[9px] text-muted-foreground"><span>Class · period 1</span><span>Marked by</span><span>Absent</span><span>Late</span></div>
          {[["10-B", "A. Sharma", "2", "1"], ["10-A", "R. Verma", "0", "0"], ["9-A", "A. Sharma", "3", "0"], ["8-C", "S. Iyer", "1", "2"]].map((r) => (
            <div key={r[0]} className="grid grid-cols-[1fr_52px_40px_40px] gap-2 border-b px-2 py-1 last:border-0"><span className="font-medium">Grade {r[0]}</span><span className="truncate text-muted-foreground">{r[1]}</span><span className={r[2] !== "0" ? "text-destructive" : ""}>{r[2]}</span><span>{r[3]}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Teacher app: period attendance, absentees tapped. */
export function TeacherScreen() {
  const rows = [["Aarav Sharma", "A"], ["Ananya Rao", ""], ["Dev Patel", ""], ["Ishaan Mehta", "L"], ["Kavya Nair", ""], ["Meera Joshi", ""], ["Rohan Gupta", ""]];
  return (
    <div className="flex h-full flex-col">
      <div className="bg-brand px-3 pb-3 pt-2 text-white"><div className="text-[9px] opacity-80">Period 1 · 08:00</div><div className="font-heading text-xs font-semibold">Grade 10-B · Mathematics</div><div className="mt-1 text-[9px] opacity-80">42 students · tap the absentees</div></div>
      <ul className="flex-1 divide-y px-2">
        {rows.map(([n, m]) => (
          <li key={n} className="flex items-center justify-between py-1.5"><span>{n}</span>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", m === "A" ? "bg-destructive/15 text-destructive" : m === "L" ? "bg-sunrise-soft text-[#7A3E00] dark:text-sunrise" : "bg-mint-soft text-mint")}>{m || "P"}</span></li>
        ))}
      </ul>
      <div className="m-2 flex items-center justify-center gap-1 rounded-lg bg-brand py-1.5 font-semibold text-white"><ClipboardCheck className="size-3" /> Submit · 2 A · 1 L</div>
    </div>
  );
}

/** Parent app: the absence alert over the child's month view. */
export function ParentScreen() {
  const days = Array.from({ length: 30 }, (_, i) => (i === 9 ? "A" : i === 17 ? "L" : i % 7 === 6 || i % 7 === 0 ? "-" : "P"));
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-1"><div className="text-[9px] text-muted-foreground">Good morning</div><div className="font-heading text-xs font-semibold">Mr. Rajesh Sharma</div></div>
      <div className="mx-2 mt-2 flex items-start gap-2 rounded-xl border border-brand/30 bg-brand-soft p-2 dark:bg-secondary"><Bell className="mt-0.5 size-3 shrink-0 text-brand" /><div><div className="font-semibold">Aarav was marked absent today</div><div className="text-[9px] text-muted-foreground">Period 1 · Mathematics · just now</div></div></div>
      <div className="mx-2 mt-2 rounded-xl border p-2">
        <div className="mb-1 flex items-center justify-between"><span className="font-semibold">Aarav · Grade 10-B</span><span className="text-[9px] text-muted-foreground">November</span></div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => <div key={i} className={cn("flex h-4 items-center justify-center rounded text-[8px]", d === "P" && "bg-mint-soft text-mint", d === "A" && "bg-destructive/15 font-bold text-destructive", d === "L" && "bg-sunrise-soft text-[#7A3E00] dark:text-sunrise", d === "-" && "text-muted-foreground/60")}>{i + 1}</div>)}
        </div>
      </div>
      <div className="mx-2 mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-xl border p-2"><div className="text-[9px] text-muted-foreground">Fees due</div><div className="font-heading text-xs font-semibold">₹18,500</div><Bar w="40%" c="bg-sunrise" /></div>
        <div className="rounded-xl border p-2"><div className="text-[9px] text-muted-foreground">Bus 14</div><div className="flex items-center gap-1 font-semibold"><BusFront className="size-3 text-brand" /> Boarded 06:52</div></div>
      </div>
    </div>
  );
}

/** Driver app: the afternoon drop, pupils marked at the stop. */
export function DriverScreen() {
  const rows: [string, string, "boarded" | "absent" | ""][] = [["Aarav Sharma", "Sector 12", "boarded"], ["Meera Joshi", "Sector 12", "absent"], ["Dev Patel", "Green Park", "boarded"], ["Kavya Nair", "Green Park", ""], ["Rohan Gupta", "Mall Road", ""]];
  return (
    <div className="flex h-full flex-col">
      <div className="bg-ink px-3 pb-3 pt-2 text-white dark:bg-secondary"><div className="flex items-center justify-between text-[9px] opacity-80"><span>Bus 14 · Route 4B</span><span className="rounded-full bg-mint px-1.5 text-[8px] font-semibold text-white">Drop · running</span></div><div className="font-heading text-xs font-semibold">Afternoon drop</div><div className="mt-1 flex items-center gap-1 text-[9px] opacity-80"><MapPin className="size-2.5" /> Next stop · Green Park 15:52</div></div>
      <ul className="flex-1 divide-y px-2">
        {rows.map(([n, s, st]) => (
          <li key={n} className="flex items-center justify-between py-1.5"><div><div>{n}</div><div className="text-[8px] text-muted-foreground">{s}</div></div>
            <div className="flex items-center gap-1">
              {st === "" && <><span className="flex size-4 items-center justify-center rounded-full border"><Check className="size-2.5" /></span><span className="flex size-4 items-center justify-center rounded-full border"><X className="size-2.5" /></span></>}
              {st === "boarded" && <span className="rounded-full bg-mint-soft px-1.5 py-0.5 text-[8px] font-semibold text-mint">Boarded</span>}
              {st === "absent" && <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[8px] font-semibold text-destructive">Absent</span>}
              <PhoneCall className="size-2.5 text-brand" />
            </div></li>
        ))}
      </ul>
      <div className="m-2 flex items-center justify-center gap-1 rounded-lg border py-1.5 font-semibold"><CheckCheck className="size-3 text-mint" /> 2 boarded · 1 absent · 2 to go</div>
    </div>
  );
}

export function AppScreen({ app }: { app: AppKey }) {
  if (app === "admin") return <Window className="w-full max-w-[420px]"><AdminScreen /></Window>;
  if (app === "teacher") return <Phone label="Teacher app"><TeacherScreen /></Phone>;
  if (app === "parent") return <Phone label="Parent app"><ParentScreen /></Phone>;
  return <Phone label="Driver app"><DriverScreen /></Phone>;
}
