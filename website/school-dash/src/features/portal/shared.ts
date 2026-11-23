// Helpers shared by the staff portal views (docs/STAFF_PORTAL_CONTRACT.md §3): the teacher app's `stamp()` shape and ISO dates.

/** The teacher app's `stamp()`: every portal-written doc carries `teacherId: staffId, updatedAt, updatedBy: authUid`. */
export const portalStamp = (staffId: string, uid: string, at = new Date()) => ({ teacherId: staffId, updatedAt: at.toISOString(), updatedBy: uid });

/** Today as YYYY-MM-DD in the browser's time zone (toISOString is UTC and gives yesterday early in the morning in India). */
export const todayIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The current moment as an ISO-8601 string (the contract never uses Firestore Timestamps). */
export const isoNow = () => new Date().toISOString();
