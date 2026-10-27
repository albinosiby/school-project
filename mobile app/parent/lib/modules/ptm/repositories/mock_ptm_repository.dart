import 'dart:async';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../../teachers/repositories/teachers_demo_data.dart';
import '../models/ptm_models.dart';
import 'ptm_demo_data.dart';
import 'ptm_repository_interface.dart';

/// In-memory PTM bookings. Writes change the per-child state and push fresh data through [watchPtm].
class MockPtmRepository implements IPtmRepository {
  MockPtmRepository(this._cache);
  final CacheService _cache;
  final Map<String, List<Meeting>> _meetings = {};
  final Map<String, List<PtmSlot>> _slots = {};
  final _changes = StreamController<void>.broadcast();
  int _seq = 0;

  List<Meeting> _meetingsOf(String childId) =>
      _meetings[childId] ??= PtmDemoData.meetings(childId);

  List<PtmSlot> _slotsOf(String childId) => _slots[childId] ??=
      PtmDemoData.slots(TeachersDemoData.forChild(childId).faculty);

  PtmData _build(String childId) {
    final taken = {
      for (final m in _meetingsOf(childId))
        if (m.status == MeetingStatus.scheduled && m.slotId != null) m.slotId,
    };
    return PtmData(
      meetings: List.unmodifiable(_meetingsOf(childId)),
      teachers: TeachersDemoData.forChild(childId).faculty,
      slots: [
        for (final s in _slotsOf(childId))
          taken.contains(s.id)
              ? PtmSlot(
                  id: s.id,
                  teacherId: s.teacherId,
                  start: s.start,
                  mins: s.mins,
                  booked: true,
                )
              : s,
      ],
    );
  }

  @override
  Stream<PtmData> watchPtm(String childId) => cacheFirst(
    cache: _cache,
    key: 'ptm:$childId',
    fetch: () async {
      await MockLatency.wait();
      return _build(childId);
    },
    refetch: () async => _build(childId),
    refreshOn: _changes.stream,
  );

  PtmSlot _freeSlot(String childId, String slotId, {String? teacherId}) {
    final data = _build(childId);
    final slot = data.slots.where((s) => s.id == slotId).firstOrNull;
    if (slot == null)
      throw AppException(message: 'That slot no longer exists.');
    if (teacherId != null && slot.teacherId != teacherId)
      throw AppException(message: 'That slot belongs to another teacher.');
    if (slot.booked)
      throw AppException(
        message: 'That slot was just taken. Please pick another time.',
      );
    return slot;
  }

  Meeting _meeting(String childId, String id) {
    final m = _meetingsOf(childId).where((m) => m.id == id).firstOrNull;
    if (m == null) throw AppException(message: 'Meeting not found.');
    return m;
  }

  void _replace(String childId, Meeting m) {
    final list = _meetingsOf(childId);
    list[list.indexWhere((x) => x.id == m.id)] = m;
    _changes.add(null);
  }

  @override
  Future<Meeting> book({
    required String childId,
    required String teacherId,
    required String slotId,
    required MeetingMode mode,
    required String agenda,
  }) async {
    await MockLatency.wait();
    final teacher = TeachersDemoData.forChild(childId).byId(teacherId);
    if (teacher == null) throw AppException(message: 'Teacher not found.');
    final slot = _freeSlot(childId, slotId, teacherId: teacherId);
    final n = ++_seq;
    final code =
        'ptm-bk${n.toString().padLeft(2, '0')}-${teacher.id.substring(4, 7)}';
    final m = Meeting(
      id: 'ptm_${childId}_b$n',
      childId: childId,
      title: '${teacher.subject} Progress Discussion',
      agenda: agenda.trim(),
      teacherId: teacher.id,
      teacherName: teacher.name,
      teacherRole: teacher.isClassTeacher
          ? '${teacher.subject} • Class Teacher'
          : teacher.subject,
      start: slot.start,
      mins: slot.mins,
      mode: mode,
      location: mode == MeetingMode.virtual ? 'Google Meet' : teacher.room,
      link: mode == MeetingMode.virtual
          ? 'https://meet.google.com/$code'
          : null,
      slotId: slot.id,
    );
    _meetingsOf(childId).add(m);
    _changes.add(null);
    return m;
  }

  @override
  Future<Meeting> reschedule({
    required String childId,
    required String meetingId,
    required String slotId,
  }) async {
    await MockLatency.wait();
    final m = _meeting(childId, meetingId);
    if (m.status != MeetingStatus.scheduled)
      throw AppException(message: 'Only scheduled meetings can be moved.');
    final slot = _freeSlot(childId, slotId, teacherId: m.teacherId);
    final moved = m.copyWith(start: slot.start, slotId: slot.id);
    _replace(childId, moved);
    return moved;
  }

  @override
  Future<void> cancel({
    required String childId,
    required String meetingId,
  }) async {
    await MockLatency.wait();
    final m = _meeting(childId, meetingId);
    _replace(childId, m.copyWith(status: MeetingStatus.cancelled));
  }

  @override
  Future<void> recordJoin({
    required String childId,
    required String meetingId,
  }) async {
    final m = _meeting(childId, meetingId);
    _replace(childId, m.copyWith(joinedAt: DateTime.now()));
  }
}
