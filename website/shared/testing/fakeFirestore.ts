// Fake `firebase/firestore` backed by fakeDb. Only what the admin web uses.
import {
  SCHOOL_ID, arrayRemove, arrayUnion, deleteField, failNextWrite, guard, increment, rawDelete, rawSet, rawUpdate, rowsOf, serverTimestamp,
  subscribe, type Data,
} from "./fakeDb";

export { arrayRemove, arrayUnion, deleteField, increment, serverTimestamp };

type Segs = string[];
export type DocRef = { type: "document"; segs: Segs; id: string; path: string };
export type ColRef = { type: "collection"; segs: Segs; id: string; path: string };
type Constraint = { kind: "where"; field: string; op: string; value: unknown } | { kind: "orderBy" | "limit"; value: unknown };
type Query = { type: "query"; col: ColRef; cons: Constraint[] };

const flat = (parts: unknown[]): Segs => parts.flatMap((p) => typeof p === "string" ? p.split("/").filter(Boolean)
  : p && typeof p === "object" && "segs" in (p as object) ? (p as { segs: Segs }).segs : []);
/** collection key in fakeDb: drop the schools/{sid} prefix */
const collKey = (segs: Segs) => (segs[0] === "schools" && segs.length >= 3 ? segs.slice(2) : segs).join("/");

let autoId = 0;
export function doc(first: unknown, ...rest: string[]): DocRef {
  const segs = flat([first, ...rest]);
  if (segs.length % 2 === 1) segs.push(`auto_${++autoId}`);
  return { type: "document", segs, id: segs[segs.length - 1]!, path: segs.join("/") };
}
export function collection(first: unknown, ...rest: string[]): ColRef {
  const segs = flat([first, ...rest]);
  return { type: "collection", segs, id: segs[segs.length - 1]!, path: segs.join("/") };
}
export const collectionGroup = (_db: unknown, id: string): ColRef => ({ type: "collection", segs: [id], id, path: id });
export const where = (field: string, op: string, value: unknown): Constraint => ({ kind: "where", field, op, value });
export const orderBy = (field: string): Constraint => ({ kind: "orderBy", value: field });
export const limit = (n: number): Constraint => ({ kind: "limit", value: n });
export const query = (col: ColRef | Query, ...cons: Constraint[]): Query =>
  col.type === "query" ? { ...col, cons: [...col.cons, ...cons] } : { type: "query", col, cons };

const pick = (d: Data, f: string) => f.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Data)[k] : undefined), d);
function matches(d: Data, c: Constraint) {
  if (c.kind !== "where") return true;
  const v = pick(d, c.field);
  switch (c.op) {
    case "==": return v === c.value;
    case "!=": return v !== c.value;
    case "<": return (v as number) < (c.value as number);
    case "<=": return (v as number) <= (c.value as number);
    case ">": return (v as number) > (c.value as number);
    case ">=": return (v as number) >= (c.value as number);
    case "in": return (c.value as unknown[]).includes(v);
    case "array-contains": return Array.isArray(v) && v.includes(c.value);
    case "array-contains-any": return Array.isArray(v) && (c.value as unknown[]).some((x) => v.includes(x));
    default: return true;
  }
}
const docSnap = (coll: string, id: string, data?: Data) => ({
  id, exists: () => !!data, data: () => (data ? { ...data } : undefined), get: (f: string) => (data ? pick(data, f) : undefined),
  ref: { type: "document", segs: [...coll.split("/"), id], id, path: `${coll}/${id}` },
});
function run(q: ColRef | Query) {
  const col = q.type === "query" ? q.col : q;
  const cons = q.type === "query" ? q.cons : [];
  const coll = collKey(col.segs);
  let rows = rowsOf(coll).filter((r) => cons.every((c) => matches(r, c)));
  const lim = cons.find((c) => c.kind === "limit");
  if (lim) rows = rows.slice(0, lim.value as number);
  const docs = rows.map((r) => docSnap(coll, String(r.id), r));
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (f: (d: (typeof docs)[number]) => void) => docs.forEach(f) };
}
const one = (ref: DocRef) => {
  const coll = collKey(ref.segs.slice(0, -1));
  return docSnap(coll, ref.id, rowsOf(coll).find((r) => String(r.id) === ref.id));
};

export const getDocs = async (q: ColRef | Query) => run(q);
export const getDoc = async (ref: DocRef) => one(ref);
export const getCountFromServer = async (q: ColRef | Query) => ({ data: () => ({ count: run(q).size }) });

const target = (ref: DocRef) => ({ coll: collKey(ref.segs.slice(0, -1)), id: ref.id });
export async function setDoc(ref: DocRef, data: Data, opts?: { merge?: boolean }) { const t = target(ref); rawSet(t.coll, t.id, data, !!opts?.merge); }
export async function addDoc(col: ColRef, data: Data) { const ref = doc(col); await setDoc(ref, data); return ref; }
export async function updateDoc(ref: DocRef, data: Data | string, ...more: unknown[]) {
  const t = target(ref);
  const patch: Data = typeof data === "string" ? { [data]: more[0] } : data;
  if (typeof data === "string") for (let i = 1; i + 1 < more.length + 1; i += 2) if (typeof more[i] === "string") patch[more[i] as string] = more[i + 1];
  rawUpdate(t.coll, t.id, patch);
}
export async function deleteDoc(ref: DocRef) { const t = target(ref); rawDelete(t.coll, t.id); }

type Op = () => void;
export function writeBatch(_db?: unknown) {
  void _db;
  const ops: Op[] = [];
  const b = {
    set: (ref: DocRef, data: Data, opts?: { merge?: boolean }) => { const t = target(ref); ops.push(() => rawSet(t.coll, t.id, data, !!opts?.merge)); return b; },
    update: (ref: DocRef, data: Data) => { const t = target(ref); ops.push(() => rawUpdate(t.coll, t.id, data)); return b; },
    delete: (ref: DocRef) => { const t = target(ref); ops.push(() => rawDelete(t.coll, t.id)); return b; },
    commit: async () => {
      // all-or-nothing: a pending failure rejects the whole batch before anything is applied
      guard();
      ops.forEach((f) => f());
    },
  };
  return b;
}

export async function runTransaction<T>(_db: unknown, fn: (tx: unknown) => Promise<T>): Promise<T> {
  const b = writeBatch();
  const tx = { get: getDoc, set: (r: DocRef, d: Data, o?: { merge?: boolean }) => { b.set(r, d, o); return tx; }, update: (r: DocRef, d: Data) => { b.update(r, d); return tx; }, delete: (r: DocRef) => { b.delete(r); return tx; } };
  const out = await fn(tx);
  await b.commit();
  return out;
}

export function onSnapshot(ref: DocRef | ColRef | Query, next: (s: unknown) => void) {
  const emit = () => next(ref.type === "document" ? one(ref) : run(ref));
  emit();
  return subscribe(emit);
}

export const Timestamp = { now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }), fromDate: (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() }) };
export const initializeFirestore = () => ({ __fake: true });
export const getFirestore = () => ({ __fake: true });
export const connectFirestoreEmulator = () => {};
export { failNextWrite, SCHOOL_ID };
