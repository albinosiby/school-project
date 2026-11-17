import type { Bus } from "./types";

export const STOP_NAME_MAX_LENGTH = 120;
export const cleanStopName = (name: string) => name.trim().replace(/\s+/g, " ");
export const stopNameKey = (name: string) => cleanStopName(name).toLowerCase();
export function stopNameError(name: string) {
  const cleaned = cleanStopName(name);
  if (!cleaned) return "Enter a bus stop name.";
  if (cleaned.length > STOP_NAME_MAX_LENGTH) return `Use at most ${STOP_NAME_MAX_LENGTH} characters for the stop name.`;
  if ([...cleaned].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return "Enter a valid bus stop name.";
  return "";
}

export function stopSuggestions(buses: Bus[], busId: string, query: string) {
  const key = stopNameKey(query);
  const seen = new Set<string>();
  return [...buses].sort((a, b) => Number(b.id === busId) - Number(a.id === busId))
    .flatMap((bus) => (Array.isArray(bus.stops) ? bus.stops : []).map((stop) => ({ name: stop.name, id: bus.id === busId ? stop.id : undefined, onBus: bus.id === busId })))
    .filter((stop) => {
      const name = stopNameKey(stop.name);
      if (!name || !name.includes(key) || seen.has(name)) return false;
      seen.add(name); return true;
    }).sort((a, b) => Number(b.onBus) - Number(a.onBus) || Number(stopNameKey(b.name) === key) - Number(stopNameKey(a.name) === key) || a.name.localeCompare(b.name));
}
