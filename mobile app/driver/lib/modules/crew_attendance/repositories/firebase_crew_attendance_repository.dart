import 'dart:async';
import '../../../constants/app_constants.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/crew_session.dart';
import '../../crew/models/crew_models.dart';
import '../models/crew_attendance_models.dart';
import 'crew_attendance_repository_interface.dart';

/// `tr_crew_attendance/{date}_{crewId}` (contract 14.5).
class FirebaseCrewAttendanceRepository implements ICrewAttendanceRepository {
  FirebaseCrewAttendanceRepository(this._session);
  final CrewSession _session;

  @override
  Stream<CrewAttendance> watch(String month) => _session.whenReady(() {
        final today = isoDay(DateTime.now());
        final todayStream = _session.col('tr_crew_attendance').doc(CrewDay.idFor(today, _session.crewId)).snapshots().map((s) => s.data() == null ? null : CrewDay.fromJson(s.data()!));
        final monthStream = _session.col('tr_crew_attendance')
            .where('crewId', isEqualTo: _session.crewId)
            .where('date', isGreaterThanOrEqualTo: '$month-01')
            .where('date', isLessThanOrEqualTo: '$month-31')
            .snapshots()
            .map((q) => [for (final d in q.docs) CrewDay.fromJson(d.data())]..sort((a, b) => b.date.compareTo(a.date)));
        final policy = _session.col('tr_settings').doc('policy').snapshots().map((s) => '${s.data()?['checkInBy'] ?? AppConstants.defaultCheckInBy}');
        late StreamController<CrewAttendance> out;
        final subs = <StreamSubscription<void>>[];
        CrewDay? t;
        List<CrewDay>? m;
        String? p;
        void push() {
          if (m != null && p != null) out.add(CrewAttendance(today: t, month: m!, checkInBy: p!));
        }
        var seenToday = false;
        out = StreamController(
          onListen: () {
            subs.add(todayStream.listen((v) { t = v; seenToday = true; push(); }, onError: out.addError));
            subs.add(monthStream.listen((v) { m = v; if (seenToday) push(); }, onError: out.addError));
            subs.add(policy.listen((v) { p = v; if (seenToday) push(); }, onError: out.addError));
          },
          onCancel: () async {
            for (final s in subs) {
              await s.cancel();
            }
          },
        );
        return out.stream;
      });

  @override
  Future<void> punchIn() async {
    final now = DateTime.now();
    final date = isoDay(now);
    final ref = _session.col('tr_crew_attendance').doc(CrewDay.idFor(date, _session.crewId));
    if ((await ref.get()).exists) throw AppException(message: 'You already checked in today.');
    final policy = await _session.col('tr_settings').doc('policy').get();
    final by = '${policy.data()?['checkInBy'] ?? AppConstants.defaultCheckInBy}';
    final me = _session.me;
    await ref.set({
      ...CrewDay(
        crewId: _session.crewId, name: me?.name ?? _session.user?.name ?? '', role: _session.role.code, busId: _session.busId,
        date: date, inTime: hhmm(now), status: hhmm(now).compareTo(by) > 0 ? 'Late' : 'Present', source: 'app',
      ).toJson(),
      'updatedAt': nowUtc(), 'updatedBy': _session.uid,
    });
  }

  @override
  Future<void> punchOut() async {
    final now = DateTime.now();
    final ref = _session.col('tr_crew_attendance').doc(CrewDay.idFor(isoDay(now), _session.crewId));
    if (!(await ref.get()).exists) throw AppException(message: 'Check in before checking out.');
    await ref.update({'out': hhmm(now), 'updatedAt': nowUtc(), 'updatedBy': _session.uid});
  }
}
