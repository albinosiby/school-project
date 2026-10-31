import 'dart:async';
import '../constants/app_constants.dart';
import '../modules/attendance/models/attendance_models.dart';
import '../modules/attendance/repositories/attendance_repository_interface.dart';
import '../modules/auth/models/auth_models.dart';
import '../modules/auth/repositories/auth_repository_interface.dart';
import '../modules/crew/models/crew_models.dart';
import '../modules/crew/repositories/crew_repository_interface.dart';
import '../modules/crew_attendance/models/crew_attendance_models.dart';
import '../modules/crew_attendance/repositories/crew_attendance_repository_interface.dart';
import '../modules/leave/models/leave_models.dart';
import '../modules/leave/repositories/leave_repository_interface.dart';
import '../modules/notices/models/notice_models.dart';
import '../modules/notices/repositories/notice_repository_interface.dart';
import '../modules/students/models/student_models.dart';
import '../modules/students/repositories/firebase_student_repository.dart' show rosterOrder;
import '../modules/students/repositories/student_repository_interface.dart';
import '../modules/trips/models/trip_models.dart';
import '../modules/trips/repositories/trip_repository_interface.dart';
import '../utils/exceptions/app_exception.dart';
import '../utils/services/cache_service.dart';
import '../utils/services/firebase/crew_session.dart' show hhmm, isoDay;
import '../utils/services/local_storage_service.dart';
import '../utils/services/mock_latency.dart';
import 'demo_data.dart';

/// Who is signed in on the local backend (shared by every mock repository).
class MockSession {
  MockSession(this.store);
  final DemoStore store;
  CrewUser? user;
  String get crewId => user?.crewId ?? '';
  CrewMember get me => store.crew[crewId]!;
  String get busId => me.busId ?? '';
}

class MockAuthRepository implements IAuthRepository {
  MockAuthRepository(this._session, this._storage);
  final MockSession _session;
  final LocalStorageService _storage;

  CrewUser _userFor(CrewMember c) => CrewUser(uid: 'uid_${c.id}', email: c.email, name: c.name, schoolId: 'demo_school', crewId: c.id, role: c.role);

  @override
  Future<CrewUser> signIn(String email, String password) async {
    await MockLatency.wait();
    final c = _session.store.crew.values.where((c) => c.email.toLowerCase() == email.trim().toLowerCase()).firstOrNull;
    if (c == null || password != DemoStore.password) throw AppException(message: 'Incorrect email or password.', statusCode: 401);
    await _storage.setString(AppConstants.sessionKey, c.id);
    return _session.user = _userFor(c);
  }

  @override
  Future<CrewUser?> restore() async {
    final id = _storage.getString(AppConstants.sessionKey);
    final c = id == null ? null : _session.store.crew[id];
    return c == null ? null : _session.user = _userFor(c);
  }

  @override
  Future<void> sendPasswordReset(String email) async {
    await MockLatency.wait();
    if (!email.contains('@')) throw AppException(message: 'Enter a valid email address.');
  }

  @override
  Future<void> signOut() async {
    await _storage.remove(AppConstants.sessionKey);
    _session.user = null;
  }
}

class MockCrewRepository implements ICrewRepository {
  MockCrewRepository(this._session, this._cache);
  final MockSession _session;
  final CacheService _cache;
  DemoStore get _store => _session.store;

  @override
  Stream<CrewContext> watchContext() => cacheFirst(
    cache: _cache, key: 'ctx:${_session.crewId}', refreshOn: _store.changes,
    fetch: () async {
      await MockLatency.wait();
      final me = _session.me;
      final bus = _store.buses[me.busId];
      final partner = bus == null ? null : _store.crew.values.where((c) => c.busId == bus.id && c.id != me.id).firstOrNull;
      return CrewContext(me: me, bus: bus, partner: partner, schoolName: DemoStore.schoolName);
    },
  );

  @override
  Future<void> updateProfile({String? phone, String? address, String? emergencyName, String? emergencyPhone}) async {
    await MockLatency.wait();
    _store.crew[_session.crewId] = _session.me.copyWith(phone: phone, address: address, emergencyName: emergencyName, emergencyPhone: emergencyPhone);
    _store.notify();
  }
}

class MockStudentRepository implements IStudentRepository {
  MockStudentRepository(this._session, this._cache);
  final MockSession _session;
  final CacheService _cache;

  @override
  Stream<List<BusStudent>> watchRoster(String busId) => cacheFirst(
    cache: _cache, key: 'roster:$busId', refreshOn: _session.store.changes,
    fetch: () async {
      await MockLatency.wait();
      return _session.store.students.values.where((s) => s.busId == busId).toList()..sort(rosterOrder);
    },
  );
}

class MockTripRepository implements ITripRepository {
  MockTripRepository(this._session, this._cache);
  final MockSession _session;
  final CacheService _cache;
  DemoStore get _store => _session.store;

  @override
  Stream<List<Trip>> watchDay(String busId, String date) => cacheFirst(
    cache: _cache, key: 'trips:$busId:$date', refreshOn: _store.changes,
    fetch: () async {
      await MockLatency.wait();
      if (date == isoDay(DateTime.now())) _store.ensureDay(busId, date);
      return _store.trips.values.where((t) => t.busId == busId && t.date == date).toList()..sort((a, b) => a.kind.index.compareTo(b.kind.index));
    },
  );

  @override
  Stream<List<Trip>> watchHistory(String busId) => cacheFirst(
    cache: _cache, key: 'history:$busId', refreshOn: _store.changes,
    fetch: () async {
      await MockLatency.wait();
      final today = isoDay(DateTime.now());
      return _store.trips.values.where((t) => t.busId == busId && (t.date != today || t.isCompleted)).toList()
        ..sort((a, b) {
          final c = b.date.compareTo(a.date);
          return c != 0 ? c : b.kind.index.compareTo(a.kind.index);
        });
    },
  );

  Future<void> _put(Trip t) async {
    await MockLatency.wait();
    _store.trips[t.id] = t;
    _store.notify();
  }

  @override
  Future<void> saveChecklist(Trip trip, Checklist checklist) => _put(_store.trips[trip.id]!.copyWith(checklist: checklist, checklistAt: DateTime.now()));

  @override
  Future<void> startTrip(Trip trip, {int? odometer}) =>
      _put(_store.trips[trip.id]!.copyWith(status: TripStatus.active, startedAt: DateTime.now(), startedBy: _session.crewId, odometerStart: odometer));

  @override
  Future<void> endTrip(Trip trip, {int? odometer, String note = ''}) async {
    final att = _store.attendance[trip.id];
    var next = att;
    if (att != null && trip.kind == TripKind.pickup) {
      for (final e in att.marks.entries) {
        if (e.value.status == MarkStatus.boarded) {
          next = next!.withMark(e.key, Mark(status: MarkStatus.dropped, at: DateTime.now(), by: _session.crewId, byName: _session.me.name, stopId: e.value.stopId));
        }
      }
      _store.attendance[trip.id] = next!;
    }
    await _put(_store.trips[trip.id]!.copyWith(
      status: TripStatus.completed, endedAt: DateTime.now(), endedBy: _session.crewId, odometerEnd: odometer, note: note,
      boarded: next?.boarded ?? 0, dropped: next?.dropped ?? 0, absent: next?.absent ?? 0,
    ));
  }

  @override
  Future<void> setCurrentStop(Trip trip, String? stopId) => _put(_store.trips[trip.id]!.copyWith(currentStopId: stopId));
}

class MockAttendanceRepository implements IAttendanceRepository {
  MockAttendanceRepository(this._session, this._cache);
  final MockSession _session;
  final CacheService _cache;
  DemoStore get _store => _session.store;

  @override
  Stream<TripAttendance> watch(Trip trip) => cacheFirst(
    cache: _cache, key: 'att:${trip.id}', refreshOn: _store.changes,
    fetch: () async => _store.attendance[trip.id] ?? TripAttendance.empty(trip),
  );

  @override
  Future<void> mark(Trip trip, String studentId, MarkStatus? status, {String? stopId}) async {
    await MockLatency.wait();
    final current = _store.attendance[trip.id] ?? TripAttendance.empty(trip);
    final next = current.withMark(studentId, status == null ? null : Mark(status: status, at: DateTime.now(), by: _session.crewId, byName: _session.me.name, stopId: stopId));
    _store.attendance[trip.id] = next;
    _store.trips[trip.id] = _store.trips[trip.id]!.copyWith(boarded: next.boarded, dropped: next.dropped, absent: next.absent);
    _store.notify();
  }

  @override
  Stream<List<TripAttendance>> watchBusHistory(String busId) => cacheFirst(
    cache: _cache, key: 'atthist:$busId', refreshOn: _store.changes,
    fetch: () async => _store.attendance.values.where((a) => a.busId == busId).toList()..sort((a, b) => b.date.compareTo(a.date)),
  );
}

class MockCrewAttendanceRepository implements ICrewAttendanceRepository {
  MockCrewAttendanceRepository(this._session, this._cache);
  final MockSession _session;
  final CacheService _cache;
  DemoStore get _store => _session.store;

  @override
  Stream<CrewAttendance> watch(String month) => cacheFirst(
    cache: _cache, key: 'crewatt:${_session.crewId}:$month', refreshOn: _store.changes,
    fetch: () async {
      await MockLatency.wait();
      final today = isoDay(DateTime.now());
      final days = _store.crewDays.values.where((d) => d.crewId == _session.crewId && d.date.startsWith(month)).toList()..sort((a, b) => b.date.compareTo(a.date));
      return CrewAttendance(today: _store.crewDays[CrewDay.idFor(today, _session.crewId)], month: days, checkInBy: _store.checkInBy);
    },
  );

  @override
  Future<void> punchIn() async {
    await MockLatency.wait();
    final now = DateTime.now();
    final id = CrewDay.idFor(isoDay(now), _session.crewId);
    if (_store.crewDays.containsKey(id)) throw AppException(message: 'You already checked in today.');
    final me = _session.me;
    _store.crewDays[id] = CrewDay(
      crewId: me.id, name: me.name, role: me.role.code, busId: me.busId ?? '', date: isoDay(now), inTime: hhmm(now),
      status: hhmm(now).compareTo(_store.checkInBy) > 0 ? 'Late' : 'Present',
    );
    _store.notify();
  }

  @override
  Future<void> punchOut() async {
    await MockLatency.wait();
    final now = DateTime.now();
    final id = CrewDay.idFor(isoDay(now), _session.crewId);
    final d = _store.crewDays[id];
    if (d == null) throw AppException(message: 'Check in before checking out.');
    _store.crewDays[id] = CrewDay(crewId: d.crewId, name: d.name, role: d.role, busId: d.busId, date: d.date, inTime: d.inTime, outTime: hhmm(now), status: d.status, source: d.source, note: d.note);
    _store.notify();
  }
}

class MockLeaveRepository implements ILeaveRepository {
  MockLeaveRepository(this._session, this._cache);
  final MockSession _session;
  final CacheService _cache;
  DemoStore get _store => _session.store;

  @override
  Stream<List<CrewLeave>> watch() => cacheFirst(
    cache: _cache, key: 'leaves:${_session.crewId}', refreshOn: _store.changes,
    fetch: () async {
      await MockLatency.wait();
      return _store.leaves.values.where((l) => l.crewId == _session.crewId).toList()
        ..sort((a, b) => (b.appliedAt ?? DateTime(0)).compareTo(a.appliedAt ?? DateTime(0)));
    },
  );

  @override
  Future<CrewLeave> apply({required String type, required String from, required String to, required String reason}) async {
    await MockLatency.wait();
    if (to.compareTo(from) < 0) throw AppException(message: 'The end date is before the start date.');
    final me = _session.me;
    final l = CrewLeave(
      id: 'lv_${me.id}_${DateTime.now().millisecondsSinceEpoch}', crewId: me.id, name: me.name, role: me.role.code, busId: me.busId ?? '',
      type: type, from: from, to: to, reason: reason, appliedAt: DateTime.now(),
    );
    _store.leaves[l.id] = l;
    _store.notify();
    return l;
  }

  @override
  Future<void> withdraw(String id) async {
    await MockLatency.wait();
    _store.leaves.remove(id);
    _store.notify();
  }
}

class MockNoticeRepository implements INoticeRepository {
  MockNoticeRepository(this._session, this._cache);
  final MockSession _session;
  final CacheService _cache;

  @override
  Stream<List<Notice>> watch() => cacheFirst(
    cache: _cache, key: 'notices', refreshOn: _session.store.changes,
    fetch: () async {
      await MockLatency.wait();
      return _session.store.notices.where((n) => n.forCrew).toList();
    },
  );
}
