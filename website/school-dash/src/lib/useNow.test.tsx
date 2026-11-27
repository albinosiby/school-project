import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useNow } from "./useNow";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-26T04:30:20Z")); });
afterEach(() => vi.useRealTimers());

test("ticks on the minute boundary, then every minute", () => {
  const { result } = renderHook(() => useNow());
  const start = result.current;
  act(() => { vi.advanceTimersByTime(39_000); });
  expect(result.current).toBe(start);
  act(() => { vi.advanceTimersByTime(1_000); });
  expect(new Date(result.current).getUTCSeconds()).toBe(0);
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(new Date(result.current).toISOString()).toBe("2026-11-26T04:32:00.000Z");
});

test("a tab that was frozen in the background catches up as soon as it is shown again", () => {
  const { result } = renderHook(() => useNow());
  // the browser paused the timers for three hours: the clock moved, no tick ran
  vi.setSystemTime(new Date("2026-11-26T08:13:05Z"));
  expect(new Date(result.current).toISOString()).toBe("2026-11-26T04:30:20.000Z");
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(new Date(result.current).toISOString()).toBe("2026-11-26T08:13:05.000Z");
  vi.setSystemTime(new Date("2026-11-26T09:00:00Z"));
  act(() => { window.dispatchEvent(new Event("focus")); });
  expect(new Date(result.current).toISOString()).toBe("2026-11-26T09:00:00.000Z");
});
