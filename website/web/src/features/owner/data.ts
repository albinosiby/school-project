"use client";
// Owner console (contract 16): live reads across every school. The rules let product owners read users, platform_schools,
// leads and everything under schools/{sid}. Plain listeners per hook; the console has few users and small collections.
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getCountFromServer, getDoc, onSnapshot, orderBy, query, where, type DocumentData, type Query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { mergeSchools, type Lead, type PlatformSchool, type PlatformUser, type SchoolCounts, type SchoolProfile } from "./logic";

type Live<T> = { rows: T[]; ready: boolean; error: string };

/** Live rows of a query; `map` turns a doc into a row. Re-subscribes when `key` changes (null = nothing to read). */
function useLive<T>(key: string | null, make: () => Query<DocumentData>, map: (id: string, d: DocumentData) => T): Live<T> {
  const [s, setS] = useState<Live<T> & { key: string | null }>({ rows: [], ready: false, error: "", key: null });
  useEffect(() => {
    if (!key) return;
    return onSnapshot(make(), (snap) => setS({ key, rows: snap.docs.map((d) => map(d.id, d.data())), ready: true, error: "" }),
      (e) => setS({ key, rows: [], ready: true, error: e.message }));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return s.key === key ? s : { rows: [], ready: false, error: "" };
}

const toDate = (v: unknown): Date | null => (v && typeof (v as { toDate?: () => Date }).toDate === "function" ? (v as { toDate: () => Date }).toDate() : typeof v === "string" ? new Date(v) : null);

export const usePlatformSchools = () => useLive<PlatformSchool>("platform_schools", () => query(collection(db, "platform_schools")), (id, d) => ({ ...d, id }) as PlatformSchool);
/** The admin logins of every school (users where role == admin). */
export const useAdminUsers = () => useLive<PlatformUser>("admins", () => query(collection(db, "users"), where("role", "==", "admin")), (id, d) => ({ ...d, id }) as PlatformUser);
/** Demo requests from the landing page, newest first. */
export const useLeads = () => useLive<Lead>("leads", () => query(collection(db, "leads"), orderBy("createdAt", "desc")),
  (id, d) => ({ ...d, id, status: d.status ?? "new", createdAt: toDate(d.createdAt) }) as Lead);
/** Every login of one school (admin, teachers, parents, bus crew). */
export const useSchoolUsers = (sid: string) => useLive<PlatformUser>(`users:${sid}`, () => query(collection(db, "users"), where("schoolId", "==", sid)), (id, d) => ({ ...d, id }) as PlatformUser);
/** One collection of one school, live (students, staff, classes …). */
export function useSchoolCollection<T extends { id: string }>(sid: string, col: string) {
  return useLive<T>(`${sid}/${col}`, () => query(collection(db, "schools", sid, col)), (id, d) => ({ ...d, id }) as T);
}

// profile + counts are read once per school and kept for the session (refresh() reads them again)
const profileCache = new Map<string, Promise<SchoolProfile>>();
const countCache = new Map<string, Promise<SchoolCounts>>();
const count = (sid: string, col: string) => getCountFromServer(collection(db, "schools", sid, col)).then((r) => r.data().count, () => 0);
export const loadProfile = (sid: string) => {
  let p = profileCache.get(sid);
  if (!p) {
    p = Promise.all([getDoc(doc(db, "schools", sid, "school", "school")), getDoc(doc(db, "schools", sid, "onboarding", "state"))])
      .then(([s, o]) => ({ ...(s.data() as Omit<SchoolProfile, "exists">), setupComplete: o.data()?.complete === true, exists: s.exists() }))
      .catch(() => ({ exists: false }));
    profileCache.set(sid, p);
  }
  return p;
};
export const loadCounts = (sid: string) => {
  let p = countCache.get(sid);
  if (!p) { p = Promise.all([count(sid, "students"), count(sid, "staff"), count(sid, "classes")]).then(([students, staff, classes]) => ({ students, staff, classes })); countCache.set(sid, p); }
  return p;
};
export const forgetSchool = (sid?: string) => { if (sid) { profileCache.delete(sid); countCache.delete(sid); } else { profileCache.clear(); countCache.clear(); } };

/** Profiles and counts for these schools, filled in as they arrive. */
export function useSchoolDetails(ids: string[], tick = 0) {
  const [profiles, setProfiles] = useState<Record<string, SchoolProfile>>({});
  const [counts, setCounts] = useState<Record<string, SchoolCounts>>({});
  const key = ids.join(",");
  useEffect(() => {
    let live = true;
    ids.forEach((id) => {
      loadProfile(id).then((p) => live && setProfiles((x) => ({ ...x, [id]: p })));
      loadCounts(id).then((c) => live && setCounts((x) => ({ ...x, [id]: c })));
    });
    return () => { live = false; };
  }, [key, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return { profiles, counts };
}

/** All schools with their profile, counts and admin logins (the owner dashboard and schools table). */
export function useSchools() {
  const platform = usePlatformSchools();
  const admins = useAdminUsers();
  const [tick, setTick] = useState(0);
  const ids = useMemo(() => [...new Set([...admins.rows.filter((u) => u.schoolId).map((u) => u.schoolId), ...platform.rows.map((p) => p.id)])].sort(), [admins.rows, platform.rows]);
  const { profiles, counts } = useSchoolDetails(ids, tick);
  const rows = useMemo(() => mergeSchools(admins.rows, platform.rows, profiles, counts), [admins.rows, platform.rows, profiles, counts]);
  return {
    rows, ready: platform.ready && admins.ready, error: platform.error || admins.error, platform: platform.rows,
    refresh: () => { forgetSchool(); setTick((t) => t + 1); },
  };
}
