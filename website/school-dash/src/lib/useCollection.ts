"use client";
// Realtime Firestore store scoped to the signed-in school: schools/{schoolId}/{collection}/{id}.
// schoolId comes from users/{authUid}.schoolId (set via setCollectionScope by the auth provider).
// Components reading the same collection query share one listener and release it when unused.
import { useCallback, useSyncExternalStore } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, where, setDoc, updateDoc, type Unsubscribe, type WhereFilterOp } from "firebase/firestore";
import { auth, db } from "./firebase";

type Row = { id: string };
export type CollectionFilter = readonly [field: string, operator: WhereFilterOp, value: string | number | boolean | null | readonly string[]];
const cache = new Map<string, Row[]>();
const listeners = new Map<string, Unsubscribe>();
const subs = new Map<string, Set<() => void>>();
export type CollectionFailure = { collection: string; code: string; message: string };
const errors = new Map<string, CollectionFailure>();
const issueListeners = new Set<() => void>();
const generations = new Map<string, symbol>();
let issues: CollectionFailure[] = [];
let pending: string[] = [];
const NO_ISSUES: CollectionFailure[] = [];
const NO_PENDING: string[] = [];
const EMPTY: Row[] = [];
let uid: string | null = null;

const emit = (n: string) => subs.get(n)?.forEach((f) => f());
function emitIssues() {
  issues = [...errors.values()].filter((error) => (subs.get(error.collection)?.size ?? 0) > 0);
  pending = uid ? [...subs.keys()].filter((name) => subs.get(name)?.size && !cache.has(name) && !errors.has(name)) : [];
  issueListeners.forEach((callback) => callback());
}
function stop(n: string) {
  generations.delete(n);
  listeners.get(n)?.();
  listeners.delete(n);
}

function listen(n: string) {
  if (!uid || listeners.has(n)) return;
  const schoolId = uid;
  const generation = Symbol(n);
  generations.set(n, generation);
  const current = () => uid === schoolId && generations.get(n) === generation;
  const [collectionName, encoded] = n.split("\0");
  const source = collection(db, "schools", schoolId, collectionName);
  const filters = encoded ? JSON.parse(encoded) as CollectionFilter[] : [];
  const target = filters.length ? query(source, ...filters.map(([field, operator, value]) => where(field, operator, value))) : source;
  const un = onSnapshot(target, (snap) => {
    if (!current()) return;
    const rows = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Row & { _o?: number });
    rows.sort((a, b) => (b._o ?? 0) - (a._o ?? 0));
    cache.set(n, rows.map(({ _o, ...r }) => { void _o; return r as Row; }));
    errors.delete(n);
    emitIssues();
    emit(n);
  }, (error) => {
    if (!current()) return;
    errors.set(n, { collection: n, code: error.code, message: error.code === "permission-denied"
      ? "Your account does not have permission to load this data."
      : "Could not load this data. Check your connection and try again." });
    emitIssues();
    emit(n);
  });
  listeners.set(n, un);
  emitIssues();
}

export function retryCollection(name: string) {
  stop(name);
  errors.delete(name);
  cache.delete(name);
  emitIssues();
  emit(name);
  if (subs.get(name)?.size) listen(name);
}

export function useCollectionFailures() {
  return useSyncExternalStore((callback) => { issueListeners.add(callback); return () => { issueListeners.delete(callback); }; },
    () => issues, () => NO_ISSUES);
}
export function useCollectionPending() {
  return useSyncExternalStore((callback) => { issueListeners.add(callback); return () => { issueListeners.delete(callback); }; },
    () => pending, () => NO_PENDING);
}

/** Current school id (null when signed out). */
export const currentSchoolId = () => uid;

/** Called by the auth provider whenever the signed-in school changes. */
export function setCollectionScope(next: string | null) {
  if (next === uid) return;
  listeners.forEach((u) => u());
  listeners.clear();
  generations.clear();
  errors.clear();
  const names = [...cache.keys()];
  cache.clear();
  uid = next;
  emitIssues();
  names.forEach(emit);
  if (uid) subs.forEach((callbacks, name) => { if (callbacks.size) listen(name); });
}

/** contract section 2: every doc written by an app carries updatedAt + updatedBy (auth uid) */
const stamp = () => ({ updatedAt: new Date().toISOString(), updatedBy: auth.currentUser?.uid ?? "" });

const newId = (c: string) => `${c.slice(0, 3)}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function useCollection<T extends Row>(name: string, enabled = true, filters: readonly CollectionFilter[] = []) {
  const key = filters.length ? `${name}\0${JSON.stringify(filters)}` : name;
  const subscribe = useCallback((cb: () => void) => {
    if (!enabled) return () => {};
    if (!subs.has(key)) subs.set(key, new Set());
    subs.get(key)!.add(cb);
    listen(key);
    return () => {
      subs.get(key)?.delete(cb);
      if (!subs.get(key)?.size) {
        stop(key);
        subs.delete(key);
        cache.delete(key);
        errors.delete(key);
        emitIssues();
      }
    };
  }, [key, enabled]);
  const rows = useSyncExternalStore(subscribe, () => enabled ? cache.get(key) ?? EMPTY : EMPTY, () => EMPTY) as T[];
  const failures = useCollectionFailures();
  const error = enabled ? failures.find((failure) => failure.collection === key) : undefined;
  const ready = enabled && cache.has(key) && !error;

  const ref = (id: string) => {
    if (!uid) throw new Error("Not signed in");
    return doc(db, "schools", uid, name, id);
  };

  const create = useCallback(async (body: Omit<T, "id"> & { id?: string }) => {
    const id = (body as { id?: string }).id || newId(name);
    const row = { ...body, id } as unknown as T;
    await setDoc(ref(id), { ...row, ...stamp(), _o: Date.now() });
    return row;
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback(async (id: string, patch: Partial<T>) => {
    const { id: _id, ...rest } = patch as Record<string, unknown>; void _id;
    await updateDoc(ref(id), { ...rest, ...stamp() });
    return { ...(cache.get(key)?.find((r) => r.id === id) ?? {}), ...patch, id } as T;
  }, [name, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = useCallback(async (id: string) => { await deleteDoc(ref(id)); }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, ready, error, create, update, remove, reload: () => { if (enabled) retryCollection(key); } };
}
