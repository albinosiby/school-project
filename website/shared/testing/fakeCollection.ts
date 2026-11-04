// Fake `@/lib/useCollection` backed by fakeDb (same API and the same updatedAt/updatedBy stamp as the real one).
import { useCallback, useSyncExternalStore } from "react";
import { ADMIN_UID, SCHOOL_ID, getVersion, rawDelete, rawSet, rawUpdate, rowsOf, subscribe } from "./fakeDb";

type Row = { id: string };
let scope: string | null = SCHOOL_ID;
export const currentSchoolId = () => scope;
export const setCollectionScope = (next: string | null) => { scope = next; };
/** test helper: simulate a signed-out store */
export const __setScope = setCollectionScope;

const stamp = () => ({ updatedAt: new Date().toISOString(), updatedBy: ADMIN_UID });
let n = 0;
const newId = (c: string) => `${c.slice(0, 3)}_t${++n}`;

const snapshots = new Map<string, { v: number; rows: Row[] }>();
function snapshot(name: string) {
  const v = getVersion();
  const cur = snapshots.get(name);
  if (cur && cur.v === v) return cur.rows;
  const rows = rowsOf<Row>(name);
  const prev = cur?.rows;
  // keep referential stability when nothing changed in this collection
  const same = prev && prev.length === rows.length && prev.every((r, i) => JSON.stringify(r) === JSON.stringify(rows[i]));
  const out = same ? prev : rows;
  snapshots.set(name, { v, rows: out });
  return out;
}

export function useCollection<T extends Row>(name: string) {
  const rows = useSyncExternalStore(subscribe, () => snapshot(name), () => snapshot(name)) as T[];
  const create = useCallback(async (body: Omit<T, "id"> & { id?: string }) => {
    const id = (body as { id?: string }).id || newId(name);
    const row = { ...body, id } as unknown as T;
    rawSet(name, id, { ...row, ...stamp() });
    return row;
  }, [name]);
  const update = useCallback(async (id: string, patch: Partial<T>) => {
    const { id: _id, ...rest } = patch as Record<string, unknown>; void _id;
    rawUpdate(name, id, { ...rest, ...stamp() });
    return { ...(rowsOf<Row>(name).find((r) => r.id === id) ?? {}), ...patch, id } as T;
  }, [name]);
  const remove = useCallback(async (id: string) => { rawDelete(name, id); }, [name]);
  return { rows, ready: true, create, update, remove, reload: () => {} };
}
