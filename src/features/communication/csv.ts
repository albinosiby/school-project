export function toCsv(columns: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [columns, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}
export function downloadFile(name: string, content: string, mime = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadCsv(name: string, columns: string[], rows: (string | number)[][]) {
  downloadFile(name.endsWith(".csv") ? name : `${name}.csv`, toCsv(columns, rows));
}
