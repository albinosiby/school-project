// In-memory stand-in for Firestore used by every test (wired up in setup.ts).
// - `seed({ staff: [...] })` fills collections of the signed-in school (paths schools/{SCHOOL_ID}/{collection}).
// - Root collections (users) and sub-collections ("com_notices/n1/acks") use their path without the school prefix.
// - Every write (useCollection create/update/remove and firebase/firestore setDoc/updateDoc/deleteDoc/writeBatch) is
//   applied to the store and appended to `writes`, so a test can assert both the result and that nothing was written.
export const SCHOOL_ID = "sch_test";
export const ADMIN_UID = "admin_uid";

export type Data = Record<string, unknown>;
export type Write = { op: "set" | "update" | "delete"; coll: string; id: string; data?: Data; merge?: boolean };

const store = new Map<string, Map<string, Data>>();
const subs = new Set<() => void>();
export const writes: Write[] = [];
let version = 0;
let failNext: Error | null = null;

const bump = () => { version++; subs.forEach((f) => f()); };
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const getVersion = () => version;

/** Makes the next write (of any kind) reject with `err`, without touching the store. */
export function failNextWrite(err: Error = new Error("permission-denied")) { failNext = err; }
export function guard() { if (failNext) { const e = failNext; failNext = null; throw e; } }

export function resetDb() { store.clear(); writes.length = 0; failNext = null; bump(); }

export function seed(data: Record<string, Data[]>) {
  for (const [coll, rows] of Object.entries(data)) {
    const m = store.get(coll) ?? new Map<string, Data>();
    rows.forEach((r) => m.set(String(r.id), { ...r }));
    store.set(coll, m);
  }
  bump();
}

/** Rows of a collection, in insertion order (newest created rows first, like the real store's `_o` order). */
export const rowsOf = <T = Data>(coll: string) => [...(store.get(coll)?.values() ?? [])].map((r) => ({ ...r })) as T[];
export const getRow = <T = Data>(coll: string, id: string) => (store.get(coll)?.get(id) as T | undefined);
export const writesTo = (coll: string) => writes.filter((w) => w.coll === coll);

// --- sentinels -------------------------------------------------------------------------------------------------
const S = Symbol("sentinel");
type Sentinel = { [S]: "union" | "remove" | "inc" | "del" | "ts"; v?: unknown };
const isSentinel = (v: unknown): v is Sentinel => !!v && typeof v === "object" && S in (v as object);
export const arrayUnion = (...v: unknown[]): Sentinel => ({ [S]: "union", v });
export const arrayRemove = (...v: unknown[]): Sentinel => ({ [S]: "remove", v });
export const increment = (n: number): Sentinel => ({ [S]: "inc", v: n });
export const deleteField = (): Sentinel => ({ [S]: "del" });
export const serverTimestamp = (): Sentinel => ({ [S]: "ts" });

const plain = (v: unknown): v is Data => !!v && typeof v === "object" && !Array.isArray(v) && !isSentinel(v);
function resolve(cur: unknown, v: unknown): unknown {
  if (!isSentinel(v)) return v;
  const kind = v[S];
  if (kind === "union") { const a = Array.isArray(cur) ? [...cur] : []; (v.v as unknown[]).forEach((x) => { if (!a.includes(x)) a.push(x); }); return a; }
  if (kind === "remove") return (Array.isArray(cur) ? cur : []).filter((x) => !(v.v as unknown[]).includes(x));
  if (kind === "inc") return (typeof cur === "number" ? cur : 0) + (v.v as number);
  if (kind === "ts") return new Date().toISOString();
  return undefined;
}
function mergeInto(target: Data, patch: Data, deep: boolean) {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (isSentinel(v) && v[S] === "del") { delete target[k]; continue; }
    if (deep && plain(v) && plain(target[k])) { const t = { ...(target[k] as Data) }; mergeInto(t, v, true); target[k] = t; continue; }
    target[k] = resolve(target[k], v);
  }
}
function setPath(target: Data, path: string, v: unknown) {
  const parts = path.split(".");
  let o = target;
  parts.slice(0, -1).forEach((p) => { if (!plain(o[p])) o[p] = {}; o[p] = { ...(o[p] as Data) }; o = o[p] as Data; });
  const last = parts[parts.length - 1]!;
  if (isSentinel(v) && v[S] === "del") delete o[last]; else o[last] = resolve(o[last], v);
}

// --- raw ops (used by both fakes) ------------------------------------------------------------------------------
export function rawSet(coll: string, id: string, data: Data, merge = false) {
  guard();
  const m = store.get(coll) ?? new Map<string, Data>();
  const cur = merge ? { ...(m.get(id) ?? {}) } : {};
  mergeInto(cur, data, merge);
  const fresh = !m.has(id);
  m.set(id, cur);
  // newest created rows first, like the real store
  if (fresh && !merge) store.set(coll, new Map([[id, cur], ...[...m].filter(([k]) => k !== id)])); else store.set(coll, m);
  writes.push({ op: "set", coll, id, data: { ...data }, merge });
  bump();
}
export function rawUpdate(coll: string, id: string, patch: Data) {
  guard();
  const m = store.get(coll);
  const cur = m?.get(id);
  if (!m || !cur) throw Object.assign(new Error(`No document to update: ${coll}/${id}`), { code: "not-found" });
  const next = { ...cur };
  for (const [k, v] of Object.entries(patch)) { if (v === undefined) continue; if (k.includes(".")) setPath(next, k, v); else mergeInto(next, { [k]: v }, false); }
  m.set(id, next);
  writes.push({ op: "update", coll, id, data: { ...patch } });
  bump();
}
export function rawDelete(coll: string, id: string) {
  guard();
  store.get(coll)?.delete(id);
  writes.push({ op: "delete", coll, id });
  bump();
}
