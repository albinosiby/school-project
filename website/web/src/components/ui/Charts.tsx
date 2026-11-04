import { cn } from "@/lib/cn";

/** Hand-rolled SVG charts (no dependency). Colours come from design tokens via Tailwind classes. */
export function LineChart({ values, labels, height = 140, className, area = true }: { values: number[]; labels?: string[]; height?: number; className?: string; area?: boolean }) {
  const w = 600, pad = 8, max = Math.max(1, ...values), step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [pad + i * step, height - pad - (v / max) * (height - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  if (!values.length) return <div className={cn("grid place-items-center text-sm text-outline", className)} style={{ height }}>No data yet</div>;
  return (
    <svg viewBox={`0 0 ${w} ${height + (labels ? 18 : 0)}`} className={cn("w-full", className)} role="img" aria-label="Line chart">
      {area && <path d={`${line} L${pts.at(-1)?.[0] ?? 0} ${height - pad} L${pad} ${height - pad} Z`} className="fill-secondary/10" />}
      <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-secondary" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} className="fill-secondary"><title>{`${labels?.[i] ?? i}: ${values[i]}`}</title></circle>)}
      {labels?.map((l, i) => (i % Math.ceil(labels.length / 8) === 0 ? <text key={i} x={pad + i * step} y={height + 12} textAnchor="middle" className="fill-outline text-[10px]">{l}</text> : null))}
    </svg>
  );
}

export function BarChart({ items, height = 160, className }: { items: { label: string; value: number; tone?: "brand" | "success" | "warning" | "danger" | "muted" }[]; height?: number; className?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value)), bw = 600 / items.length;
  const fill = { brand: "fill-secondary", success: "fill-success", warning: "fill-warning", danger: "fill-error", muted: "fill-outline" };
  return (
    <svg viewBox={`0 0 600 ${height + 34}`} className={cn("w-full", className)} role="img" aria-label="Bar chart">
      {items.map((it, i) => {
        const h = (it.value / max) * (height - 20);
        return (
          <g key={it.label}>
            <rect x={i * bw + bw * 0.2} y={height - h} width={bw * 0.6} height={h} rx={4} className={fill[it.tone ?? "brand"]}><title>{`${it.label}: ${it.value}`}</title></rect>
            <text x={i * bw + bw / 2} y={height - h - 5} textAnchor="middle" className="fill-on-surface text-[11px] font-semibold">{it.value}</text>
            <text x={i * bw + bw / 2} y={height + 16} textAnchor="middle" className="fill-on-surface-variant text-[10px]">{it.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

const DONUT = ["stroke-secondary", "stroke-success", "stroke-warning", "stroke-error", "stroke-outline", "stroke-secondary-container", "stroke-navy-700"];
const DONUT_BG = ["bg-secondary", "bg-success", "bg-warning", "bg-error", "bg-outline", "bg-secondary-container", "bg-navy-700"];
export function DonutChart({ items, centre, className }: { items: { label: string; value: number }[]; centre?: React.ReactNode; className?: string }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1, r = 52, c = 2 * Math.PI * r;
  const offs = items.map((_, i) => items.slice(0, i).reduce((x, y) => x + (y.value / total) * c, 0));
  return (
    <div className={cn("flex flex-wrap items-center gap-5", className)}>
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90" role="img" aria-label="Donut chart">
          <circle cx="70" cy="70" r={r} fill="none" strokeWidth="18" className="stroke-surface-container" />
          {items.map((it, i) => { const len = (it.value / total) * c; return <circle key={it.label} cx="70" cy="70" r={r} fill="none" strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offs[i]!} className={DONUT[i % DONUT.length]}><title>{`${it.label}: ${it.value}`}</title></circle>; })}
        </svg>
        {centre && <div className="absolute inset-0 grid place-items-center text-center">{centre}</div>}
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {items.map((it, i) => <li key={it.label} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className={cn("size-2.5 rounded-full", DONUT_BG[i % DONUT_BG.length])} />{it.label}</span><b>{it.value}</b></li>)}
      </ul>
    </div>
  );
}
