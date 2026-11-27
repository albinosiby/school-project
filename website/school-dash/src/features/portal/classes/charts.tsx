"use client";
// The class pages' charts (the teacher app's screens/widgets/class_charts.dart): a smooth trend line with a dashed
// threshold and a readout of the picked point, horizontal percentage bars, count columns and a donut.
// Plain SVG / CSS in the design tokens (Tailwind classes), responsive down to phone width.
import { useId, useState } from "react";
import { cn } from "@/lib/cn";

export type Tone = "brand" | "success" | "warning" | "danger" | "info" | "muted";
const BG: Record<Tone, string> = { brand: "bg-secondary", success: "bg-success", warning: "bg-warning", danger: "bg-error", info: "bg-secondary-container", muted: "bg-outline" };
const STROKE: Record<Tone, string> = { brand: "stroke-secondary", success: "stroke-success", warning: "stroke-warning", danger: "stroke-error", info: "stroke-secondary-container", muted: "stroke-outline" };

export type TrendPoint = { label: string; value: number | null; detail?: string };

/** smooth line through the points (a null value breaks it), gradient area, dashed threshold; hover / tap reads a point */
export function TrendChart({ points, threshold, unit = "%", max = 100, tone = "brand", label, height = 170 }: {
  points: TrendPoint[]; threshold?: number; unit?: string; max?: number; tone?: "brand" | "success"; label: string; height?: number;
}) {
  const gid = useId().replace(/:/g, "");
  const [picked, setPicked] = useState<number | null>(null);
  if (!points.some((p) => p.value != null)) return <p className="py-8 text-center text-sm text-on-surface-variant">No data yet</p>;
  const w = 600, left = 34, right = 10, top = 10, bottom = 22, ih = height - top - bottom, iw = w - left - right;
  const x = (i: number) => left + (points.length > 1 ? (i * iw) / (points.length - 1) : iw / 2);
  const y = (v: number) => top + ih - (Math.max(0, Math.min(max, v)) / max) * ih;
  // segments of consecutive non-null points, drawn as smooth cubic curves
  const segs: [number, number][][] = [];
  points.forEach((p, i) => { if (p.value == null) { segs.push([]); return; } if (!segs.length) segs.push([]); segs.at(-1)!.push([x(i), y(p.value)]); });
  const curve = (s: [number, number][]) => s.map(([px, py], i) => {
    if (!i) return `M${px.toFixed(1)} ${py.toFixed(1)}`;
    const [qx, qy] = s[i - 1]!, mx = (qx + px) / 2;
    return `C${mx.toFixed(1)} ${qy.toFixed(1)} ${mx.toFixed(1)} ${py.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}`;
  }).join(" ");
  const lastIdx = points.map((p, i) => (p.value == null ? -1 : i)).filter((i) => i >= 0).at(-1)!;
  const sel = picked ?? lastIdx, cur = points[sel]!;
  const every = Math.max(1, Math.ceil(points.length / 6));
  const line = tone === "success" ? "stroke-success" : "stroke-secondary", dot = tone === "success" ? "fill-success" : "fill-secondary";
  const stop = tone === "success" ? "text-success" : "text-secondary";
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm" aria-live="polite">
        <span className="text-xl font-semibold tabular-nums">{cur.value == null ? "—" : `${Math.round(cur.value)}${unit}`}</span>
        <span className="text-on-surface-variant">{cur.detail ?? cur.label}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full touch-none select-none" role="img" aria-label={label} onMouseLeave={() => setPicked(null)}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" className={stop} />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" className={stop} />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((t) => { const v = (t / 100) * max; return <g key={t}>
          <line x1={left} x2={w - right} y1={y(v)} y2={y(v)} className="stroke-outline-variant/50" strokeWidth={1} />
          <text x={left - 6} y={y(v) + 3.5} textAnchor="end" className="fill-outline text-[10px]">{Math.round(v)}</text>
        </g>; })}
        {threshold != null && <line x1={left} x2={w - right} y1={y(threshold)} y2={y(threshold)} className="stroke-error/70" strokeWidth={1.5} strokeDasharray="5 5" />}
        {segs.filter((s) => s.length).map((s, i) => <g key={i}>
          <path d={`${curve(s)} L${s.at(-1)![0].toFixed(1)} ${top + ih} L${s[0]![0].toFixed(1)} ${top + ih} Z`} fill={`url(#${gid})`} className={stop} />
          <path d={curve(s)} fill="none" strokeWidth={2.5} strokeLinecap="round" className={line} />
        </g>)}
        <line x1={x(sel)} x2={x(sel)} y1={top} y2={top + ih} className="stroke-outline/40" strokeWidth={1} />
        {points.map((p, i) => p.value == null ? null : <circle key={i} cx={x(i)} cy={y(p.value)} r={i === sel ? 5 : 2.5}
          className={cn(dot, i === sel && "stroke-surface-container-lowest")} strokeWidth={i === sel ? 2 : 0} />)}
        {points.map((p, i) => (i % every === 0 || i === points.length - 1) && (points.length - 1 - i >= every / 2 || i === points.length - 1)
          ? <text key={`l${i}`} x={x(i)} y={height - 5} textAnchor="middle" className="fill-outline text-[10px]">{p.label}</text> : null)}
        {points.map((p, i) => <rect key={`h${i}`} x={x(i) - iw / Math.max(1, points.length - 1) / 2} y={0} width={iw / Math.max(1, points.length - 1)} height={height}
          fill="transparent" onMouseEnter={() => setPicked(i)} onClick={() => setPicked(i)}><title>{`${p.label}: ${p.value == null ? "—" : `${Math.round(p.value)}${unit}`}`}</title></rect>)}
      </svg>
    </div>
  );
}

export type BarItem = { label: string; value: number | null; caption?: string };

/** one horizontal bar per item (0-100); bars under `threshold` turn red, a null value shows `empty` */
export function HBars({ items, threshold, tone = "brand", empty = "No data yet", label }: { items: BarItem[]; threshold?: number; tone?: Tone; empty?: string; label: string }) {
  if (!items.length) return <p className="text-sm text-on-surface-variant">No data yet</p>;
  return (
    <ul className="space-y-3" aria-label={label}>
      {items.map((it) => {
        const low = it.value != null && threshold != null && it.value < threshold;
        return <li key={it.label} aria-label={`${it.label}: ${it.value == null ? empty : `${Math.round(it.value)}%`}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{it.label}{it.caption && <span className="ml-2 text-xs font-normal text-on-surface-variant">{it.caption}</span>}</span>
            <span className={cn("shrink-0 tabular-nums font-semibold", it.value == null ? "text-xs font-normal text-outline" : low ? "text-error" : "text-on-surface")}>
              {it.value == null ? empty : `${Math.round(it.value)}%`}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-container-high">
            {it.value != null && <div className={cn("h-full rounded-full transition-all", low ? "bg-error" : BG[tone])} style={{ width: `${Math.max(2, Math.min(100, it.value))}%` }} />}
          </div>
        </li>;
      })}
    </ul>
  );
}

/** vertical columns with the count on top (e.g. students per marks band) */
export function Columns({ values, labels, tones, label }: { values: number[]; labels: string[]; tones: Tone[]; label: string }) {
  const top = Math.max(1, ...values);
  return (
    <div className="grid h-44 items-end gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }} role="img" aria-label={label}>
      {values.map((v, i) => <div key={labels[i]} className="flex h-full flex-col items-center justify-end gap-1">
        <span className={cn("text-sm font-semibold tabular-nums", !v && "text-outline")}>{v}</span>
        <div className={cn("w-full max-w-14 rounded-t-md transition-all", v ? BG[tones[i] ?? "brand"] : "bg-surface-container-high")} style={{ height: `${v ? Math.max(6, (v / top) * 100) : 4}%` }} />
        <span className="text-[11px] text-on-surface-variant">{labels[i]}</span>
      </div>)}
    </div>
  );
}

/** a ring split into segments with a centre figure and a legend */
export function Donut({ segments, centre, caption, label }: { segments: { label: string; value: number; tone: Tone }[]; centre: string; caption?: string; label: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0), r = 52, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90" role="img" aria-label={label}>
          <circle cx="70" cy="70" r={r} fill="none" strokeWidth="16" className="stroke-surface-container" />
          {total > 0 && segments.map((s) => {
            const len = (s.value / total) * c, at = offset; offset += len;
            return s.value ? <circle key={s.label} cx="70" cy="70" r={r} fill="none" strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-at} className={STROKE[s.tone]} /> : null;
          })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-2xl font-semibold tabular-nums">{centre}</span>
          {caption && <span className="text-xs text-on-surface-variant">{caption}</span>}
        </div>
      </div>
      <ul className="min-w-40 flex-1 space-y-2 text-sm">
        {segments.map((s) => <li key={s.label} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2"><span className={cn("size-2.5 rounded-full", BG[s.tone])} />{s.label}</span>
          <b className="tabular-nums">{s.value}</b>
        </li>)}
      </ul>
    </div>
  );
}
