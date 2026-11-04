import { describe, expect, it, vi } from "vitest";
import { csvCell, downloadCsv, parseCsv, toCsv } from "./csv";

describe("CSV export", () => {
  it("quotes commas, quotes and line breaks; null/undefined are empty", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("cr\rhere")).toBe('"cr\rhere"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(false)).toBe("false");
  });
  it("joins rows with commas and newlines", () => {
    expect(toCsv([["Invoice", "Student", "Due"], ["INV-1", "Sharma, Aarav", 4200], ["INV-2", null, undefined]])).toBe('Invoice,Student,Due\nINV-1,"Sharma, Aarav",4200\nINV-2,,');
    expect(toCsv([])).toBe("");
  });
  it("downloads the file through a blob link", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    downloadCsv("fee-ledger.csv", [["a", "b"]]);
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe("CSV import", () => {
  it("round-trips what the export writes", () => {
    const rows = [["Roll", "Name", "Note"], ["#8A-01", "Sharma, Aarav", 'said "ok"'], ["#8A-02", "Two\nlines", ""]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("trims cells, drops blank lines, handles CRLF and a BOM", () => {
    expect(parseCsv("﻿roll, theory ,internal\r\n\r\n 8A-01 ,70,18\r\n  \n8A-02,,\n")).toEqual([["roll", "theory", "internal"], ["8A-01", "70", "18"], ["8A-02", "", ""]]);
  });
  it("keeps a quote inside an unquoted cell", () => {
    expect(parseCsv('5" ruler,2')).toEqual([['5" ruler', "2"]]);
  });
});
