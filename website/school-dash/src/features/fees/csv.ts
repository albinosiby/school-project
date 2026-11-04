export type CsvCell = string | number | boolean | null | undefined;

/** One CSV cell: null/undefined → empty; quoted when it holds a comma, quote, CR or LF (quotes doubled). */
export const csvCell = (v: CsvCell) => { const s = String(v ?? ""); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** Rows → CSV text (RFC 4180, "\n" line ends). */
export const toCsv = (rows: CsvCell[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n");

export function downloadCsv(filename: string, rows: CsvCell[][]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * CSV text → rows of trimmed cells. Handles quoted cells with commas, doubled quotes and line breaks, CRLF line ends
 * and a UTF-8 BOM; blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  const endCell = () => { row.push(cell); cell = ""; };
  const endRow = () => { endCell(); if (row.some((c) => c.trim() !== "")) rows.push(row.map((c) => c.trim())); row = []; };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.trim() === "") { quoted = true; cell = ""; }
    else if (ch === ",") endCell();
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src[i + 1] === "\n") i++; endRow(); }
    else cell += ch;
  }
  if (cell !== "" || row.length) endRow();
  return rows;
}
