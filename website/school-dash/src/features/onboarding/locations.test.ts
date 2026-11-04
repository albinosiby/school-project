import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COUNTRIES, INDIA_STATES, loadCountryStates, type AddressState } from "./locations";

afterEach(() => vi.unstubAllGlobals());

describe("bundled location reference data", () => {
  it("has a matching, unique country/state/district hierarchy for every country", () => {
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    const regions = new Map<string, Record<string, AddressState[]>>();
    for (const country of COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      if (!regions.has(country.region)) regions.set(country.region, JSON.parse(readFileSync(path.resolve("public/data/locations", `${country.region}.json`), "utf8")));
      const states = country.code === "IN" ? INDIA_STATES : regions.get(country.region)![country.code];
      expect(Array.isArray(states)).toBe(true);
      expect(new Set(states.map((s) => s.code)).size).toBe(states.length);
      for (const state of states) {
        expect(state.code.startsWith(`${country.code}.`)).toBe(true);
        expect(state.name).toBeTruthy();
        expect(new Set(state.districts.map((d) => d.code)).size).toBe(state.districts.length);
        for (const district of state.districts) {
          expect(district.code.startsWith(`${state.code}.`)).toBe(true);
          expect(district.name).toBeTruthy();
        }
      }
    }
    expect(INDIA_STATES).toHaveLength(36);
    expect(INDIA_STATES.find((s) => s.name === "Kerala")?.districts).toHaveLength(14);
  });
  it("loads India without making any network requests", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await loadCountryStates("IN")).toBe(INDIA_STATES);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("shares a downloaded region when switching between its countries", async () => {
    const data = JSON.parse(readFileSync(path.resolve("public/data/locations/NA.json"), "utf8"));
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => data }); vi.stubGlobal("fetch", fetcher);
    expect((await loadCountryStates("US")).some((s) => s.name === "California")).toBe(true);
    expect((await loadCountryStates("CA")).some((s) => s.name === "Ontario")).toBe(true);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/data/locations/NA.json");
  });
  it("allows retry after a failed reference-data request", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ ZA: [] }) }); vi.stubGlobal("fetch", fetcher);
    await expect(loadCountryStates("ZA")).rejects.toThrow("Location data could not be loaded.");
    await expect(loadCountryStates("ZA")).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
