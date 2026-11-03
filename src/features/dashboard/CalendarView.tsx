"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Modal, ProgressBar, Select, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { AddEventPanel } from "./AddEventPanel";
import { DashHeader } from "./DashHeader";
import { addDays, CATS, catOf, errMsg, eventsOn, fmtDay, MON, MONTHS, monthGrid, parse, TODAY, useEvents, type CalEvent, type CatId } from "./data";
import { ayOf, spanDays, timeRange, workingDaysIn } from "./logic";

type View = "month" | "week" | "agenda";
const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function CalendarView() {
  const { rows, update, remove } = useEvents();
  const toast = useToast();
  const [view, setView] = useState<View>("month");
  const [ym, setYm] = useState(() => { const d = parse(TODAY); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [weekStart, setWeekStart] = useState(() => addDays(TODAY, -((parse(TODAY).getDay() + 6) % 7)));
  const [term, setTerm] = useState("all");
  const [hidden, setHidden] = useState<CatId[]>([]);
  const [addDate, setAddDate] = useState<string | undefined>();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [openEv, setOpenEv] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  const events = useMemo(() => rows.filter((e) => !hidden.includes(e.category) && (term === "all" || e.term === term)), [rows, hidden, term]);
  const grid = useMemo(() => monthGrid(ym.y, ym.m), [ym]);
  const evOpen = rows.find((e) => e.id === openEv) ?? null;
  const monthKey = `${ym.y}-${String(ym.m + 1).padStart(2, "0")}`;
  const monthEvents = events.filter((e) => e.start.slice(0, 7) <= monthKey && e.end.slice(0, 7) >= monthKey).sort((a, b) => a.start.localeCompare(b.start));
  const workingDays = grid.filter((c) => c.inMonth && c.dow < 6 && !rows.some((e) => e.category === "holiday" && e.status === "published" && e.start <= c.iso && c.iso <= e.end)).length;
  const next = new Date(ym.y, ym.m + 1, 1);
  const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  const highlights = rows.filter((e) => e.status === "published" && e.start.slice(0, 7) === nextKey && e.category !== "holiday").sort((a, b) => a.start.localeCompare(b.start));
  const shift = (d: number) => { if (view === "week") setWeekStart(addDays(weekStart, d * 7)); else setYm((x) => { const n = x.m + d; return n < 0 ? { y: x.y - 1, m: 11 } : n > 11 ? { y: x.y + 1, m: 0 } : { ...x, m: n }; }); };
  const goToday = () => { const d = parse(TODAY); setYm({ y: d.getFullYear(), m: d.getMonth() }); const wd = (d.getDay() + 6) % 7; setWeekStart(addDays(TODAY, -wd)); };
  const openAdd = (date?: string) => { setEditing(null); setAddDate(date); setAddOpen(true); };
  // instructional days for the current academic year, from the calendar itself
  const ay = ayOf(TODAY);
  const holidays = rows.filter((e) => e.category === "holiday" && e.status === "published");
  const t1 = workingDaysIn(ay.start, addDays(ay.t2, -1), holidays), t2 = workingDaysIn(ay.t2, ay.end, holidays);
  const t1Done = TODAY >= ay.t2;
  const holidayDays = holidays.filter((h) => h.end >= ay.start && h.start <= ay.end).reduce((a, h) => a + spanDays(h), 0);
  const exams = rows.filter((e) => e.category === "exam" && e.status === "published" && e.end >= TODAY).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
  const closeEv = () => { setOpenEv(null); setConfirmDel(false); };
  const act = async (fn: () => Promise<unknown>, ok: string, close = false) => {
    setBusy(true);
    try { await fn(); toast(ok); if (close) closeEv(); } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); }
  };

  const pill = (e: CalEvent, compact = true) => (
    <button key={e.id} onClick={(ev) => { ev.stopPropagation(); setOpenEv(e.id); }} title={e.title}
      className={cn("mt-1 flex w-full cursor-pointer items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium", catOf(e.category).chip, e.status === "draft" && "border border-dashed border-outline opacity-70", !compact && "text-xs")}>
      <span className={cn("size-1.5 shrink-0 rounded-full", catOf(e.category).dot)} /><span className="truncate">{e.title}</span></button>);

  return (
    <>
      <DashHeader active="calendar" />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card className="flex flex-wrap items-center gap-3 p-3">
            <div className="flex rounded-lg bg-surface-container p-0.5 text-sm font-medium" role="tablist">
              {(["month", "week", "agenda"] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("cursor-pointer rounded-md px-3 py-1.5 capitalize", view === v ? "bg-surface-container-lowest text-secondary shadow-card" : "text-on-surface-variant")}>{v}</button>)}</div>
            <Select aria-label="Term" className="!w-52" value={term} onChange={(e) => setTerm(e.target.value)}><option value="all">All terms</option><option value="Term 1">Term 1 (Apr – Oct)</option><option value="Term 2">Term 2 (Nov – Mar)</option></Select>
            <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
            <div className="ml-auto flex items-center gap-1"><button aria-label="Previous" onClick={() => shift(-1)} className="cursor-pointer rounded p-1.5 hover:bg-surface-container"><ChevronLeft size={16} /></button>
              <span className="min-w-28 text-center text-sm font-semibold">{view === "week" ? `${fmtDay(weekStart)}` : `${MONTHS[ym.m]} ${ym.y}`}</span>
              <button aria-label="Next" onClick={() => shift(1)} className="cursor-pointer rounded p-1.5 hover:bg-surface-container"><ChevronRight size={16} /></button>
              <Button size="sm" className="ml-2" onClick={() => openAdd()}><Plus size={14} />Add Event</Button></div>
          </Card>
          <Card className="flex flex-wrap items-center gap-2 p-3"><span className="mr-1 text-[11px] font-bold tracking-wide text-outline">LEGEND:</span>
            {CATS.map((c) => { const off = hidden.includes(c.id); return <button key={c.id} aria-pressed={!off} onClick={() => setHidden(off ? hidden.filter((h) => h !== c.id) : [...hidden, c.id])}
              className={cn("flex cursor-pointer items-center gap-2 rounded-full px-3 py-1 text-sm", off ? "text-outline line-through" : "text-on-surface hover:bg-surface-container-low")}><span className={cn("size-2.5 rounded-full", off ? "bg-outline-variant" : c.dot)} />{c.label}</button>; })}</Card>

          {view === "month" && (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 p-4"><h2 className="t-headline-md !text-[18px]">{MONTHS[ym.m]} {ym.y}</h2><Badge tone="success">{workingDays} Working Days</Badge></div>
              <div className="grid grid-cols-7 border-y border-outline-variant/60 bg-surface-container-low text-center">{DOW.map((d, i) => <span key={d} className={cn("py-2 text-xs font-semibold tracking-wide", i > 4 ? "text-error" : "text-outline")}>{d}</span>)}</div>
              <div className="grid grid-cols-7">
                {grid.map((c) => { const evs = eventsOn(events, c.iso); const isToday = c.iso === TODAY; return (
                  <div key={c.iso} role="button" tabIndex={0} aria-label={`${fmtDay(c.iso)}. Add event`} onClick={() => openAdd(c.iso)} onKeyDown={(e) => e.key === "Enter" && openAdd(c.iso)}
                    className={cn("min-h-24 cursor-pointer border-b border-r border-outline-variant/40 p-1.5 hover:bg-surface-container-low", !c.inMonth && "bg-surface-container-low/60 text-outline/60", isToday && "ring-2 ring-inset ring-secondary")}>
                    <span className={cn("grid size-6 place-items-center rounded-full text-xs font-bold", c.dow > 5 && c.inMonth && "text-error", isToday && "bg-secondary !text-on-secondary")}>{c.day}</span>
                    {evs.slice(0, 2).map((e) => pill(e))}{evs.length > 2 && <p className="mt-1 text-[11px] text-outline">+{evs.length - 2} more</p>}
                  </div>); })}
              </div>
            </Card>)}

          {view === "week" && (
            <Card className="overflow-hidden"><div className="grid grid-cols-1 sm:grid-cols-7">
              {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d, i) => { const evs = eventsOn(events, d); return (
                <div key={d} role="button" tabIndex={0} aria-label={`${fmtDay(d)}. Add event`} onClick={() => openAdd(d)} onKeyDown={(e) => e.key === "Enter" && openAdd(d)} className={cn("min-h-48 cursor-pointer border-b border-r border-outline-variant/40 p-2 hover:bg-surface-container-low", d === TODAY && "bg-info-container/40")}>
                  <p className={cn("text-xs font-semibold", i > 5 ? "text-error" : "text-outline")}>{DOW[i]}</p><p className="text-lg font-bold">{parse(d).getDate()} <span className="text-xs font-normal text-outline">{MON[parse(d).getMonth()]}</span></p>
                  {evs.map((e) => pill(e, false))}</div>); })}</div></Card>)}

          {view === "agenda" && (
            <Card><div className="p-4"><h2 className="t-headline-md !text-[18px]">Agenda · {MONTHS[ym.m]} {ym.y}</h2></div>
              {monthEvents.length === 0 ? <p className="p-8 text-center text-on-surface-variant">No events this month.</p> :
                <ul>{monthEvents.map((e) => { const d = parse(e.start); return (
                  <li key={e.id}><button onClick={() => setOpenEv(e.id)} className="flex w-full cursor-pointer items-center gap-4 border-t border-outline-variant/40 px-4 py-3 text-left hover:bg-surface-container-low">
                    <span className={cn("grid w-12 place-items-center rounded py-1", catOf(e.category).chip)}><span className="text-[10px] font-bold">{MON[d.getMonth()]}</span><span className="text-lg font-bold leading-5">{String(d.getDate()).padStart(2, "0")}</span></span>
                    <span className="min-w-0 flex-1"><span className="block font-semibold">{e.title} {e.status === "draft" && <Badge>Draft</Badge>}</span><span className="text-xs text-outline">{e.start === e.end ? fmtDay(e.start) : `${fmtDay(e.start)} – ${fmtDay(e.end)}`} · {timeRange(e)} · {e.venue}</span></span>
                    <Badge className={catOf(e.category).chip}>{catOf(e.category).label}</Badge></button></li>); })}</ul>}</Card>)}

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="t-headline-md !text-[18px]"><CalendarDays size={18} className="mr-2 inline text-secondary" />Upcoming Institutional Highlights ({MONTHS[next.getMonth()]} {next.getFullYear()})</h2>
              <p className="text-on-surface-variant">Published events next month (holidays excluded)</p></div>
              <button className="cursor-pointer text-sm font-semibold text-secondary" onClick={() => { setTerm("all"); setView("agenda"); setYm({ y: next.getFullYear(), m: next.getMonth() }); }}>View {MONTHS[next.getMonth()]} agenda</button></div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {highlights.length === 0 && <p className="text-on-surface-variant">No highlights scheduled.</p>}
              {highlights.map((e) => { const d = parse(e.start); return (
                <button key={e.id} onClick={() => setOpenEv(e.id)} className="flex cursor-pointer gap-3 rounded-lg border border-outline-variant/60 p-4 text-left hover:bg-surface-container-low">
                  <span className={cn("grid size-14 shrink-0 place-items-center rounded-lg text-center", catOf(e.category).chip)}><span><span className="block text-[10px] font-bold">{MON[d.getMonth()]}</span><span className="text-xl font-bold">{String(d.getDate()).padStart(2, "0")}</span></span></span>
                  <span><Badge className={catOf(e.category).chip}>{catOf(e.category).label}</Badge><span className="mt-1 block font-semibold">{e.title}</span><span className="block text-xs text-outline">{e.venue} · {timeRange(e)}</span>{e.lead && <span className="block text-xs text-on-surface-variant">Lead: {e.lead}</span>}</span></button>); })}</div>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="p-5"><div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold">Instructional Days Tracker</h2><p className="text-xs text-outline">AY {ay.y}–{String(ay.y + 1).slice(2)} · Mon–Sat minus calendar holidays</p></div><Badge tone={t1 + t2 >= 220 ? "success" : "warning"}>{t1 + t2 >= 220 ? "Meets 220-day minimum" : "Below 220 days"}</Badge></div>
            <div className="mt-4 flex items-center gap-4"><div className="grid size-24 shrink-0 place-items-center rounded-full border-8 border-secondary/80"><div className="text-center"><p className="text-xl font-bold leading-5">{t1 + t2}</p><p className="text-[10px] text-outline">Days Available</p></div></div>
              <div className="flex-1 space-y-3 text-xs"><div><div className="flex justify-between"><span>Term 1 (Apr–Oct){t1Done ? " · done" : ""}</span><b>{t1} Days</b></div><ProgressBar value={t1Done ? 100 : Math.round((workingDaysIn(ay.start, TODAY, holidays) / Math.max(1, t1)) * 100)} className="mt-1 !h-1.5" /></div>
                <div><div className="flex justify-between"><span>Term 2 (Nov–Mar)</span><b>{t2} Days</b></div><ProgressBar value={t1Done ? Math.round((workingDaysIn(ay.t2, TODAY < ay.end ? TODAY : ay.end, holidays) / Math.max(1, t2)) * 100) : 0} tone="success" className="mt-1 !h-1.5" /></div></div></div>
            <ul className="mt-4 space-y-2 border-t border-outline-variant/60 pt-3 text-sm">{[["Statutory CBSE Minimum", "220 Days"], ["Holidays & Breaks on calendar", `${holidayDays} Day${holidayDays === 1 ? "" : "s"}`], ["Margin over minimum", `${t1 + t2 - 220} Days`]].map(([a, b]) => <li key={a} className="flex justify-between"><span className="text-on-surface-variant">{a}</span><b>{b}</b></li>)}</ul></Card>
          <Card className="p-5"><div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold">Upcoming Examinations</h2><p className="text-xs text-outline">Published exam events on this calendar</p></div><Link href="/exams" className="text-xs font-semibold text-secondary">Exams →</Link></div>
            {exams.length === 0 && <p className="mt-3 rounded-lg bg-surface-container-low p-3 text-sm text-outline">No upcoming exams scheduled.</p>}
            {exams.map((e) => (
              <button key={e.id} onClick={() => setOpenEv(e.id)} className="mt-3 block w-full cursor-pointer rounded-lg border border-outline-variant/60 p-3 text-left hover:bg-surface-container-low"><div className="flex items-start justify-between gap-2"><p className="font-semibold">{e.title}</p><Badge tone="brand">{e.start === e.end ? fmtDay(e.start) : `${fmtDay(e.start)} – ${fmtDay(e.end)}`}</Badge></div>
                <p className="mt-1 text-xs text-on-surface-variant">{e.grades?.length ? `Grades ${e.grades.join(", ")}` : "All grades"} · {e.venue}</p></button>))}</Card>
        </aside>
      </div>

      <AddEventPanel open={addOpen} onClose={() => { setAddOpen(false); setEditing(null); }} initialDate={addDate} event={editing} />
      <Modal open={!!evOpen} onClose={closeEv} title={evOpen?.title ?? ""} subtitle={evOpen ? catOf(evOpen.category).label : undefined}
        footer={evOpen && (confirmDel ? <><span className="mr-auto self-center text-sm text-error">Delete this event permanently?</span><Button variant="outline" onClick={() => setConfirmDel(false)}>Keep</Button>
          <Button variant="danger" disabled={busy} onClick={() => act(() => remove(evOpen.id), "Event deleted", true)}><Trash2 size={14} />Delete</Button></> : <><Button variant="ghost" className="!text-error" onClick={() => setConfirmDel(true)}><Trash2 size={14} />Delete</Button>
          <Button variant="outline" onClick={() => { setEditing(evOpen); setAddOpen(true); closeEv(); }}><Pencil size={14} />Edit</Button>
          {evOpen.status === "draft" && <Button disabled={busy} onClick={() => act(() => update(evOpen.id, { status: "published" }), "Event published to master calendar")}>Publish</Button>}
          <Button variant="outline" onClick={closeEv}>Close</Button></>)}>
        {evOpen && <dl className="space-y-3 text-sm">{[["Date", evOpen.start === evOpen.end ? fmtDay(evOpen.start) : `${fmtDay(evOpen.start)} – ${fmtDay(evOpen.end)}`], ["Time", timeRange(evOpen)], ["Venue", evOpen.venue], ["Term", evOpen.term], ["Faculty lead", evOpen.lead || "—"], ["Grades", evOpen.grades?.length ? evOpen.grades.join(", ") : "All"], ["Instructional credit", evOpen.instructional ? "Yes" : "No"], ["Status", evOpen.status === "draft" ? "Unapproved draft" : "Published"], ["Notes", evOpen.desc || "—"], ["Circular", evOpen.circular || "—"]].map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-outline">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}</dl>}
      </Modal>
    </>
  );
}
