import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../../teachers/models/teacher_models.dart';
import '../../teachers/repositories/teachers_repository_interface.dart';
import '../models/ptm_models.dart';
import 'ptm_repository_interface.dart';

/// Parent-teacher meetings (data contract §13.7). The school office publishes `ptm_slots` per teacher in the admin web;
/// the parent books one as `ptm_bookings/{slotId}` (one booking per slot), cancels or reschedules it, and sees the
/// minutes the school shares. Slots are limited to the child's teachers (class teacher + timetable).
class FirebasePtmRepository implements IPtmRepository {
  FirebasePtmRepository(this._session, this._teachers);
  final ParentSession _session;
  final ITeachersRepository _teachers;

  static const _modeLabels = {MeetingMode.inPerson: 'In-Person', MeetingMode.virtual: 'Virtual'};

  CollectionReference<Json> get _slots => _session.col('ptm_slots');
  CollectionReference<Json> get _bookings => _session.col('ptm_bookings');

  @override
  Stream<PtmData> watchPtm(String childId) {
    final teachers = _teachers.watchTeachers(childId).map<Object>((t) => [t.classTeacher, ...t.faculty]);
    // slots that have not started yet; booked ones stay so the times read as taken
    final slots = _session.whenReady(
      () => _slots.where('startMs', isGreaterThanOrEqualTo: DateTime.now().millisecondsSinceEpoch).snapshots(),
    );
    final bookings = _session.whenReady(() => _bookings.where('studentId', isEqualTo: childId).snapshots());
    return combineLatest<Object>([teachers, slots, bookings]).map((v) {
      final list = (v[0] as List<Teacher>).where((t) => t.id.isNotEmpty).toList();
      final ids = {for (final t in list) t.id};
      Teacher? byId(String id) => list.where((t) => t.id == id).firstOrNull;
      return PtmData(
        teachers: list,
        slots: [
          for (final d in (v[1] as QuerySnapshot<Json>).docs)
            if (ids.contains('${d.data()['teacherId'] ?? ''}')) slotFromDoc(d.id, d.data()),
        ],
        meetings: [
          for (final d in (v[2] as QuerySnapshot<Json>).docs)
            meetingFromDoc(d.id, d.data(), childId, byId('${d.data()['teacherId'] ?? ''}')),
        ],
      );
    });
  }

  @override
  Future<Meeting> book({
    required String childId,
    required String teacherId,
    required String slotId,
    required MeetingMode mode,
    required String agenda,
  }) async {
    final data = await _bookingFor(childId: childId, teacherId: teacherId, slotId: slotId, mode: mode, agenda: agenda);
    await _write(() => _bookings.doc(slotId).set(data));
    return meetingFromDoc(slotId, data, childId, null);
  }

  @override
  Future<Meeting> reschedule({required String childId, required String meetingId, required String slotId}) async {
    final old = (await _bookings.doc(meetingId).get()).data();
    if (old == null || old['status'] != 'Scheduled') throw AppException(message: 'This meeting can no longer be changed.');
    final mode = old['mode'] == 'Virtual' ? MeetingMode.virtual : MeetingMode.inPerson;
    final data = await _bookingFor(
      childId: childId,
      teacherId: '${old['teacherId'] ?? ''}',
      slotId: slotId,
      mode: mode,
      agenda: '${old['agenda'] ?? ''}',
    );
    final batch = _session.db.batch()
      ..update(_bookings.doc(meetingId), _cancel())
      ..set(_bookings.doc(slotId), data);
    await _write(batch.commit);
    return meetingFromDoc(slotId, data, childId, null);
  }

  @override
  Future<void> cancel({required String childId, required String meetingId}) =>
      _write(() => _bookings.doc(meetingId).update(_cancel()));

  @override
  Future<void> recordJoin({required String childId, required String meetingId}) async {
    try {
      await _bookings.doc(meetingId).update({'joinedAt': nowUtc(), 'updatedAt': nowUtc(), 'updatedBy': _session.uid});
    } catch (_) {
      // the join itself (opening the Meet link) matters more than the record
    }
  }

  Map<String, Object> _cancel() => {
    'status': 'Cancelled',
    'cancelledBy': 'parent',
    'cancelledAt': nowUtc(),
    'updatedAt': nowUtc(),
    'updatedBy': _session.uid,
  };

  /// The booking doc for [slotId], checked against the slot first so the parent gets a clear reason.
  Future<Json> _bookingFor({
    required String childId,
    required String teacherId,
    required String slotId,
    required MeetingMode mode,
    required String agenda,
  }) async {
    final slot = (await _slots.doc(slotId).get()).data();
    if (slot == null || '${slot['teacherId'] ?? ''}' != teacherId) {
      throw AppException(message: 'This time is no longer offered. Pick another slot.');
    }
    if (slot['booked'] == true) throw AppException(message: 'This slot was just taken. Pick another time.');
    final startMs = slot['startMs'] is int ? slot['startMs'] as int : 0;
    if (startMs <= DateTime.now().millisecondsSinceEpoch) throw AppException(message: 'This slot has already started.');
    final modes = [for (final m in (slot['modes'] as List? ?? const [])) '$m'];
    if (!modes.contains(_modeLabels[mode])) {
      throw AppException(message: 'This slot is ${modes.isEmpty ? 'not bookable' : modes.join(' or ').toLowerCase()} only.');
    }
    final child = await _session.student(childId);
    return {
      'slotId': slotId,
      'teacherId': teacherId,
      'teacher': '${slot['teacher'] ?? ''}',
      'studentId': childId,
      'classId': '${child['classId'] ?? ''}',
      'studentName': '${child['name'] ?? ''}',
      'parentUid': _session.uid,
      'parentName': '${_session.user['name'] ?? _session.user['email'] ?? ''}',
      'mode': _modeLabels[mode],
      'agenda': agenda.trim(),
      'start': slot['start'],
      'startMs': startMs,
      'mins': slot['mins'],
      'room': slot['room'] ?? '',
      'link': slot['link'] ?? '',
      'status': 'Scheduled',
      'bookedAt': nowUtc(),
      'updatedAt': nowUtc(),
      'updatedBy': _session.uid,
    };
  }

  Future<void> _write(Future<void> Function() write) async {
    try {
      await write();
    } on FirebaseException catch (e) {
      if (e.code == 'permission-denied') {
        throw AppException(message: 'This slot was just taken or has changed. Pick another time.');
      }
      rethrow;
    }
  }

  static PtmSlot slotFromDoc(String id, Json d) => PtmSlot(
    id: id,
    teacherId: '${d['teacherId'] ?? ''}',
    start: parseTime(d['startMs']) ?? parseTime(d['start']) ?? DateTime.now(),
    mins: d['mins'] is int ? d['mins'] as int : 20,
    booked: d['booked'] == true,
  );

  static MeetingStatus statusOf(Object? s) => switch ('$s') {
    'Cancelled' => MeetingStatus.cancelled,
    'Attended' => MeetingStatus.attended,
    'Missed' => MeetingStatus.missed,
    _ => MeetingStatus.scheduled,
  };

  static Meeting meetingFromDoc(String id, Json d, String childId, Teacher? teacher) {
    final virtual = d['mode'] == 'Virtual';
    final link = '${d['link'] ?? ''}';
    final room = '${d['room'] ?? ''}';
    final subject = teacher?.subject ?? '';
    final minutes = '${d['minutes'] ?? ''}'.trim();
    return Meeting(
      id: id,
      childId: childId,
      title: subject.isEmpty || subject == 'Class Teacher' ? 'Parent-Teacher Meeting' : '$subject Progress Discussion',
      agenda: '${d['agenda'] ?? ''}',
      teacherId: '${d['teacherId'] ?? ''}',
      teacherName: '${d['teacher'] ?? teacher?.name ?? ''}',
      teacherRole: teacher == null ? '' : (teacher.isClassTeacher ? '${teacher.subject} • Class Teacher' : teacher.subject),
      start: parseTime(d['startMs']) ?? parseTime(d['start']) ?? DateTime.now(),
      mins: d['mins'] is int ? d['mins'] as int : 20,
      mode: virtual ? MeetingMode.virtual : MeetingMode.inPerson,
      location: virtual ? (link.isEmpty ? 'Google Meet (link to follow)' : 'Google Meet') : (room.isEmpty ? 'School office' : room),
      link: virtual && link.isNotEmpty ? link : null,
      status: statusOf(d['status']),
      minutes: minutes.isEmpty ? null : minutes,
      slotId: id,
      joinedAt: parseTime(d['joinedAt']),
    );
  }
}
