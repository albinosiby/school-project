"use client";
// Realtime Firestore store scoped to the signed-in school: schools/{schoolId}/{collection}/{id}.
// schoolId comes from users/{authUid}.schoolId (set via setCollectionScope by the auth provider).
// All components reading a collection share one snapshot listener and stay in sync.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc, type Unsubscribe } from "firebase/firestore";
import { auth, db } from "./firebase";

type Row = { id: string };
const cache = new Map<string, Row[]>();
const listeners = new Map<string, Unsubscribe>();
const subs = new Map<string, Set<() => void>>();
const wanted = new Set<string>();
const EMPTY: Row[] = [];
let uid: string | null = null;

const emit = (n: string) => subs.get(n)?.forEach((f) => f());

function listen(n: string) {
  if (!uid || listeners.has(n)) return;
  const un = onSnapshot(collection(db, "schools", uid, n), (snap) => {
    const rows = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Row & { _o?: number });
    rows.sort((a, b) => (b._o ?? 0) - (a._o ?? 0));
    cache.set(n, rows.map(({ _o, ...r }) => { void _o; return r as Row; }));
    emit(n);
  }, () => { cache.set(n, []); emit(n); });
  listeners.set(n, un);
}

/** Current school id (null when signed out). */
export const currentSchoolId = () => uid;

/** Called by the auth provider whenever the signed-in school changes. */
export function setCollectionScope(next: string | null) {
  if (next === uid) return;
  listeners.forEach((u) => u());
  listeners.clear();
  const names = [...cache.keys()];
  cache.clear();
  uid = next;
  names.forEach(emit);
  if (uid) wanted.forEach(listen);
}

/** contract section 2: every doc written by an app carries updatedAt + updatedBy (auth uid) */
const stamp = () => ({ updatedAt: new Date().toISOString(), updatedBy: auth.currentUser?.uid ?? "" });

const newId = (c: string) => `${c.slice(0, 3)}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function useCollection<T extends Row>(name: string) {
  const subscribe = useCallback((cb: () => void) => {
    if (!subs.has(name)) subs.set(name, new Set());
    subs.get(name)!.add(cb);
    return () => subs.get(name)!.delete(cb);
  }, [name]);
  const rows = useSyncExternalStore(subscribe, () => cache.get(name) ?? EMPTY, () => EMPTY) as T[];
  const ready = cache.has(name);

  useEffect(() => { wanted.add(name); listen(name); }, [name]);

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
    return { ...(cache.get(name)?.find((r) => r.id === id) ?? {}), ...patch, id } as T;
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = useCallback(async (id: string) => { await deleteDoc(ref(id)); }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, ready, create, update, remove, reload: () => {} };
}
