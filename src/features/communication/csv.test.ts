import { describe, expect, it, vi } from "vitest";
import { downloadCsv, toCsv } from "./csv";

describe("toCsv", () => {
  it("leaves plain cells bare and joins rows with \\n", () => {
    expect(toCsv(["GRN", "Name"], [["G-1", "Asha"], [2, 3.5]])).toBe("GRN,Name\nG-1,Asha\n2,3.5");
  });
  it("quotes cells with a comma, quote, \\n or \\r and doubles inner quotes", () => {
    expect(toCsv(["a"], [["x,y"], ['say "hi"'], ["two\nlines"], ["cr\rlf"]])).toBe('a\n"x,y"\n"say ""hi"""\n"two\nlines"\n"cr\rlf"');
  });
  it("quotes header cells too, keeps 0 and writes empty strings for null / undefined", () => {
    expect(toCsv(["Due (INR), total"], [[0], [null], [undefined]])).toBe('"Due (INR), total"\n0\n\n');
  });
  it("an empty table is just the header", () => {
    expect(toCsv(["A", "B"], [])).toBe("A,B");
  });
});

describe("downloadCsv", () => {
  it("adds .csv once and sends utf-8 csv", async () => {
    const blobs: Blob[] = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((b: Blob) => { blobs.push(b); return "blob:x"; }) as typeof URL.createObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    downloadCsv("report", ["A"], [["1"]]);
    downloadCsv("report.csv", ["A"], [["1"]]);
    expect(click.mock.contexts.map((a) => (a as HTMLAnchorElement).download)).toEqual(["report.csv", "report.csv"]);
    expect(blobs[0]!.type).toBe("text/csv;charset=utf-8");
    expect(await blobs[0]!.text()).toBe("A\n1");
    URL.createObjectURL = orig;
    click.mockRestore();
  });
});
