import { afterEach, describe, expect, it, vi } from "vitest";
import { addDays, csvText, downloadCsv, errMsg, eventsOn, fmtDay, iso, monthGrid, parse, pctOf, relTime, toIso, upcomingEvents, type CalEvent } from "./data";

const ev = (o: Partial<CalEvent>) => ({ id: "e", title: "E", category: "exam", start: "2026-11-10", end: "2026-11-10", status: "published", ...o }) as CalEvent;

describe("date helpers", () => {
  it("iso / parse / toIso round-trip without time zone drift", () => {
    expect(iso(2026, 0, 5)).toBe("2026-01-05");
    expect(toIso(parse("2026-02-28"))).toBe("2026-02-28");
  });
  it("addDays crosses month, year and leap day boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("fmtDay formats and tolerates empty input", () => {
    expect(fmtDay("2026-11-03")).toBe("3 Nov 2026");
    expect(fmtDay("")).toBe("—");
  });
});

describe("monthGrid", () => {
  it("is 6 Monday-first weeks with the month's days flagged", () => {
    const g = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(g).toHaveLength(42);
    expect(g[0]).toMatchObject({ iso: "2026-10-26", inMonth: false, dow: 0 });
    expect(g[6]).toMatchObject({ iso: "2026-11-01", day: 1, inMonth: true, dow: 6 });
    expect(g.filter((c) => c.inMonth)).toHaveLength(30);
    expect(g[41]!.iso).toBe("2026-12-06");
  });
  it("a month starting on Monday has no leading days", () => {
    expect(monthGrid(2026, 5)[0]).toMatchObject({ iso: "2026-06-01", inMonth: true });
  });
});

describe("event ranges", () => {
  it("eventsOn includes both ends of a multi-day event", () => {
    const evs = [ev({ id: "a", start: "2026-11-10", end: "2026-11-12" }), ev({ id: "b", start: "2026-11-12", end: "2026-11-12" })];
    expect(eventsOn(evs, "2026-11-09")).toEqual([]);
    expect(eventsOn(evs, "2026-11-10").map((e) => e.id)).toEqual(["a"]);
    expect(eventsOn(evs, "2026-11-12").map((e) => e.id)).toEqual(["a", "b"]);
  });
  it("upcomingEvents: published, not yet ended, by start date", () => {
    const evs = [ev({ id: "late", start: "2026-12-01", end: "2026-12-01" }), ev({ id: "draft", status: "draft" }), ev({ id: "past", start: "2026-10-01", end: "2026-10-02" }),
      ev({ id: "running", start: "2026-11-01", end: "2026-11-05" })];
    expect(upcomingEvents(evs, "2026-11-03").map((e) => e.id)).toEqual(["running", "late"]);
  });
});

describe("misc helpers", () => {
  afterEach(() => vi.useRealTimers());
  it("pctOf is 0 for a 0 denominator", () => {
    expect(pctOf(1, 0)).toBe(0);
    expect(pctOf(1, 4)).toBe(25);
  });
  it("relTime", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 3, 12, 0, 0));
    expect(relTime("2026-11-03T11:59:40")).toBe("just now");
    expect(relTime("2026-11-03T11:15:00")).toBe("45m ago");
    expect(relTime("2026-11-03T07:00:00")).toBe("5h ago");
    expect(relTime("2026-10-31T12:00:00")).toBe("3d ago");
    expect(relTime("")).toBe("");
  });
  it("errMsg strips the Firebase prefix", () => {
    expect(errMsg(new Error("Firebase: Missing or insufficient permissions."))).toBe("Could not save: Missing or insufficient permissions.");
    expect(errMsg("x", "Could not send")).toBe("Could not send");
  });
});

describe("csvText / downloadCsv", () => {
  it("quotes every cell, doubles quotes and writes empty cells for null / undefined", () => {
    expect(csvText([["Time", "Actor"], ['He said "hi"', "a,b"], [undefined, null], [1, "line\nbreak"]]))
      .toBe('"Time","Actor"\n"He said ""hi""","a,b"\n"",""\n"1","line\nbreak"');
  });
  it("downloads a text/csv blob under the given name", async () => {
    const blobs: Blob[] = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((b: Blob) => { blobs.push(b); return "blob:x"; }) as typeof URL.createObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    downloadCsv("audit-log.csv", [["A"], ["1"]]);
    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("audit-log.csv");
    expect(blobs[0]!.type).toBe("text/csv");
    expect(await blobs[0]!.text()).toBe('"A"\n"1"');
    URL.createObjectURL = orig;
    click.mockRestore();
  });
});
