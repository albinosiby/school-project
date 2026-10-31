// Transport backend (DATA_CONTRACT section 14): bus attendance alerts to parents and crew leave requests for the admin bell.
// The driver app writes tr_attendance/{date}_{busId}_{kind}.marks.{studentId} = {status, at, by, byName, stopId?}; this file
// turns each status change of today's record into a parent push (par_notifications row, type "transport") through the
// shared notifyParents() of parent.js, and mirrors a new tr_crew_leaves request into schools/{sid}/notifications exactly like a
// staff leave request. Crew have no push of their own yet, so a decided crew leave triggers nothing.
//
// Loop safety: nothing here writes back into tr_attendance or tr_crew_leaves.
const { logger } = require("firebase-functions/v2");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");

module.exports = ({ db, notifyParents, guardiansOf, istToday, notifyAdmin, safe }) => {
  const S = (sid) => db.collection("schools").doc(sid);
  const MARKS = new Set(["boarded", "dropped", "absent"]);
  const TITLE = { boarded: "On the bus", dropped: "Off the bus", absent: "Missed the bus" };

  /** ISO string / Timestamp / Date / millis -> "HH:mm" in India time ("" if unknown) */
  const istTime = (v) => {
    const t = v == null ? NaN : typeof v.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : +new Date(v);
    return Number.isFinite(t) ? new Date(t).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  };

  /** [{studentId, status, mark}] for every mark whose status changed in this write (new key, changed status; deleted keys do not count) */
  const changedMarks = (before, after) => {
    const out = [];
    for (const [studentId, mark] of Object.entries(after?.marks ?? {})) {
      const status = mark?.status;
      if (!MARKS.has(status) || before?.marks?.[studentId]?.status === status) continue;
      out.push({ studentId, status, mark });
    }
    return out;
  };

  /** The stop a mark happened at: the bus's stop by id, else the child's own stop; a pickup trip ends at school. */
  const stopName = (stops, mark, student, kind) => {
    const byId = mark?.stopId ? stops.find((s) => s?.id === mark.stopId)?.name : null;
    if (byId) return byId;
    if (kind === "pickup") return "school";
    return student?.busStop || stops.find((s) => s?.id === student?.busStopId)?.name || "the bus stop";
  };

  const bodyFor = (status, name, after, mark, stops, student) => {
    if (status === "boarded") return `${name} boarded ${after.bus || `Bus ${after.busId ?? ""}`.trim()}${istTime(mark.at) ? ` at ${istTime(mark.at)}` : ""}`;
    if (status === "dropped") return `${name} got off at ${stopName(stops, mark, student, after.kind)}`;
    return `${name} was not at the bus stop`;
  };

  // A crew member marks a student boarded / dropped / absent on today's trip: push the child's guardians (once per status).
  const onTransportAttendanceWritten = onDocumentWritten("schools/{sid}/tr_attendance/{id}", safe("onTransportAttendanceWritten", async (e) => {
    const sid = e.params.sid;
    const before = e.data?.before?.data(), after = e.data?.after?.data();
    if (!after) return;
    const changed = changedMarks(before, after);
    if (!changed.length) return;
    // back-filled or corrected past days update the record but send no "today" push
    if (after.date !== istToday()) { logger.info("transport marks on another day, no push", { sid, id: e.params.id, date: after.date }); return; }
    const tripId = after.tripId || e.params.id;
    const [studentSnaps, bus] = await Promise.all([
      db.getAll(...changed.map((c) => S(sid).collection("students").doc(c.studentId))),
      after.busId ? S(sid).collection("tr_buses").doc(after.busId).get() : null,
    ]);
    const stops = Array.isArray(bus?.get("stops")) ? bus.get("stops") : [];
    const students = studentSnaps.filter((s) => s.exists).map((s) => ({ id: s.id, ...s.data() }));
    const rows = guardiansOf(students).map(({ uid, student }) => {
      const { status, mark } = changed.find((c) => c.studentId === student.id);
      return {
        id: `trp_${tripId}_${student.id}_${status}`, uid, studentId: student.id, type: "transport",
        title: TITLE[status], body: bodyFor(status, student.name ?? "Your child", after, mark, stops, student), route: "/home/track",
      };
    });
    if (!rows.length) { logger.info("no guardian logins for the marked students", { sid, tripId, students: changed.map((c) => c.studentId) }); return; }
    const sent = await notifyParents(sid, rows);
    logger.info("transport alerts", { sid, tripId, changed: changed.length, sent });
  }));

  // A crew member applies for leave: admin bell (Transport > Leaves), like a staff leave request.
  const onCrewLeaveRequested = onDocumentCreated("schools/{sid}/tr_crew_leaves/{id}", safe("onCrewLeaveRequested", async (e) => {
    const l = e.data?.data();
    if (!l || l.status !== "Pending") return;
    const range = l.to && l.to !== l.from ? `${l.from} to ${l.to}` : l.from;
    let name = l.name;
    if (!name && l.crewId) { const c = await S(e.params.sid).collection("tr_crew").doc(l.crewId).get(); name = c.exists ? c.get("name") : null; }
    const who = `${name ?? "A crew member"}${l.role ? ` (${l.role}${l.bus ? `, ${l.bus}` : ""})` : ""}`;
    await notifyAdmin(e.params.sid, {
      category: "approvals", title: "Transport leave request", href: "/transport?tab=leaves",
      body: `${who} applied for ${l.type ?? "leave"} (${l.days ?? "?"} day${l.days === 1 ? "" : "s"}, ${range}): ${l.reason ?? ""}`.trim(),
    });
  }));

  return { onTransportAttendanceWritten, onCrewLeaveRequested };
};
