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

  /** Where a child got off: a pickup trip always ends at school (the mark keeps the stop the child boarded at); on a drop
   *  trip the bus's stop by id, else the child's own stop. */
  const stopName = (stops, mark, student, kind) => {
    if (kind === "pickup") return "school";
    const byId = mark?.stopId ? stops.find((s) => s?.id === mark.stopId)?.name : null;
    if (byId) return byId;
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
        id: `trp_${tripId}_${student.id}_${status}_${uid}`, uid, studentId: student.id, type: "transport",
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

  // ---------- par_transport/{studentId}: the parent's view of the child's bus (contract 14.9) ----------
  const TRIP_KINDS = ["pickup", "drop"];
  const crewCard = (c) => (c ? { name: c.name ?? "", phone: c.phone ?? "" } : { name: "", phone: "" });
  const iso = (v) => (v == null ? null : typeof v.toDate === "function" ? v.toDate().toISOString() : String(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /** Recomputes par_transport for [studentIds] (all students of the same bus share one read of the bus, crew, trips, marks). */
  async function rebuildTransport(sid, studentIds) {
    const ids = [...new Set(studentIds.filter(Boolean))];
    if (!ids.length) return 0;
    const snaps = await db.getAll(...ids.map((id) => S(sid).collection("students").doc(id)));
    const today = istToday();
    const byBus = new Map();
    for (const s of snaps) {
      const busId = s.exists && s.get("deleted") !== true ? s.get("busId") || "" : "";
      if (!byBus.has(busId)) byBus.set(busId, []);
      byBus.get(busId).push(s);
    }
    let written = 0;
    for (const [busId, students] of byBus) {
      const batch = db.batch();
      if (!busId) {
        for (const s of students) { batch.delete(S(sid).collection("par_transport").doc(s.id)); written++; }
        await batch.commit();
        continue;
      }
      const busSnap = await S(sid).collection("tr_buses").doc(busId).get();
      if (!busSnap.exists) {
        for (const s of students) { batch.delete(S(sid).collection("par_transport").doc(s.id)); written++; }
        await batch.commit();
        continue;
      }
      const bus = busSnap.data();
      const crewIds = [bus.driverId, bus.attendantId].filter(Boolean);
      const crewSnaps = crewIds.length ? await db.getAll(...crewIds.map((id) => S(sid).collection("tr_crew").doc(id))) : [];
      const crew = Object.fromEntries(crewSnaps.filter((c) => c.exists).map((c) => [c.id, c.data()]));
      const dayIds = TRIP_KINDS.map((k) => `${today}_${busId}_${k}`);
      const [trips, marks] = await Promise.all([
        db.getAll(...dayIds.map((id) => S(sid).collection("tr_trips").doc(id))),
        db.getAll(...dayIds.map((id) => S(sid).collection("tr_attendance").doc(id))),
      ]);
      const stops = (Array.isArray(bus.stops) ? bus.stops : []).map((x) => ({ id: x.id ?? "", name: x.name ?? "", pickupTime: x.pickupTime ?? "", dropTime: x.dropTime ?? "" }));
      const existing = await db.getAll(...students.map((s) => S(sid).collection("par_transport").doc(s.id)));
      students.forEach((s, i) => {
        const st = s.data();
        const stop = stops.find((x) => x.id === st.busStopId);
        const todayFor = (k) => {
          const t = trips[k].exists ? trips[k].data() : null;
          const m = marks[k].exists ? marks[k].get(`marks.${s.id}`) ?? marks[k].data()?.marks?.[s.id] : null;
          return { status: t?.status ?? null, startedAt: iso(t?.startedAt), endedAt: iso(t?.endedAt), mark: m?.status ?? null, markAt: iso(m?.at) };
        };
        const doc = {
          studentId: s.id, busId, bus: `Bus ${bus.number ?? ""}`.trim(), regNo: bus.regNo ?? "", routeName: bus.routeName ?? "", model: bus.model ?? "",
          stopId: st.busStopId ?? "", stop: stop?.name ?? st.busStop ?? "", pickupTime: stop?.pickupTime ?? "", dropTime: stop?.dropTime ?? "",
          stops, driver: crewCard(crew[bus.driverId]), attendant: crewCard(crew[bus.attendantId]),
          today: { date: today, pickup: todayFor(0), drop: todayFor(1) },
        };
        const prev = existing[i].exists ? existing[i].data() : null;
        if (prev) { const { updatedAt: _u, ...rest } = prev; void _u; if (same(rest, doc)) return; }
        batch.set(S(sid).collection("par_transport").doc(s.id), { ...doc, updatedAt: new Date().toISOString() });
        written++;
      });
      await batch.commit();
    }
    return written;
  }

  // tools (backfill, e2e) call it as onTransportProjectionBus.rebuild(sid, ids); a plain export would not be a function to deploy
  const studentsOfBus = async (sid, busId) => (busId ? (await S(sid).collection("students").where("busId", "==", busId).get()).docs.map((d) => d.id) : []);

  // a child put on / taken off a bus, moved to another stop, renamed
  const onTransportProjectionStudent = onDocumentWritten("schools/{sid}/students/{studentId}", safe("onTransportProjectionStudent", async (e) => {
    const b = e.data?.before?.data(), a = e.data?.after?.data();
    const keys = ["busId", "busStopId", "busStop", "deleted"];
    if (b && a && keys.every((k) => b[k] === a[k])) return;
    if (!b?.busId && !a?.busId) return;
    await rebuildTransport(e.params.sid, [e.params.studentId]);
  }));

  // the bus's number, stops or crew changed
  const onTransportProjectionBus = onDocumentWritten("schools/{sid}/tr_buses/{busId}", safe("onTransportProjectionBus", async (e) => {
    const b = e.data?.before?.data(), a = e.data?.after?.data();
    const keys = ["number", "regNo", "routeName", "model", "stops", "driverId", "attendantId"];
    if (b && a && keys.every((k) => same(b[k], a[k]))) return;
    await rebuildTransport(e.params.sid, await studentsOfBus(e.params.sid, e.params.busId));
  }));

  // a crew member's name / phone changed (or they moved bus)
  const onTransportProjectionCrew = onDocumentWritten("schools/{sid}/tr_crew/{crewId}", safe("onTransportProjectionCrew", async (e) => {
    const b = e.data?.before?.data(), a = e.data?.after?.data();
    if (b && a && ["name", "phone", "busId"].every((k) => b[k] === a[k])) return;
    const buses = [...new Set([b?.busId, a?.busId].filter(Boolean))];
    const ids = (await Promise.all(buses.map((x) => studentsOfBus(e.params.sid, x)))).flat();
    await rebuildTransport(e.params.sid, ids);
  }));

  // today's trip started / ended
  const onTransportProjectionTrip = onDocumentWritten("schools/{sid}/tr_trips/{tripId}", safe("onTransportProjectionTrip", async (e) => {
    const b = e.data?.before?.data(), a = e.data?.after?.data();
    const t = a ?? b;
    if (!t || t.date !== istToday()) return;
    if (b && a && ["status", "startedAt", "endedAt"].every((k) => same(b[k], a[k]))) return;
    await rebuildTransport(e.params.sid, await studentsOfBus(e.params.sid, t.busId));
  }));

  // a pupil marked on today's trip: only the children whose mark changed
  const onTransportProjectionMarks = onDocumentWritten("schools/{sid}/tr_attendance/{id}", safe("onTransportProjectionMarks", async (e) => {
    const b = e.data?.before?.data(), a = e.data?.after?.data();
    const t = a ?? b;
    if (!t || t.date !== istToday()) return;
    const ids = new Set([...Object.keys(b?.marks ?? {}), ...Object.keys(a?.marks ?? {})]);
    const changed = [...ids].filter((id) => !same(b?.marks?.[id] ?? null, a?.marks?.[id] ?? null));
    await rebuildTransport(e.params.sid, changed);
  }));

  onTransportProjectionBus.rebuild = rebuildTransport;
  return {
    onTransportAttendanceWritten, onCrewLeaveRequested,
    onTransportProjectionStudent, onTransportProjectionBus, onTransportProjectionCrew, onTransportProjectionTrip, onTransportProjectionMarks,
  };
};
