import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../models/leave_models.dart';
import 'leave_repository_interface.dart';

/// `student_leaves` (§13.3): the guardian applies, the class teacher decides in the teacher app.
/// The display fields the teacher app shows (`type`, `cat`, `daysLabel`, `dateText`, `by`) are written with the request.
class FirebaseLeaveRepository implements ILeaveRepository {
  FirebaseLeaveRepository(this._session);
  final ParentSession _session;

  @override
  Stream<List<LeaveRequest>> watchLeaves(String childId) =>
      _session.col('student_leaves').where('studentId', isEqualTo: childId).snapshots().map((q) {
        final list = [for (final d in q.docs) fromDoc(d.id, d.data())]..sort((a, b) => b.appliedOn.compareTo(a.appliedOn));
        return list;
      });

  /// History plus the attendance base for the impact projection (from `par_attendance`).
  @override
  Stream<LeaveOverview> watchOverview(String childId) => combineLatest<Object>([
        watchLeaves(childId),
        _session.col('par_attendance').where('studentId', isEqualTo: childId).snapshots(),
      ]).map((both) {
        var attended = 0.0, working = 0;
        for (final doc in (both[1] as QuerySnapshot<Json>).docs) {
          final days = doc.data()['days'];
          if (days is! Map) continue;
          for (final code in days.values) {
            working++;
            if (code == 'P' || code == 'L') attended += 1;
            if (code == 'H') attended += 0.5;
          }
        }
        return LeaveOverview(history: both[0] as List<LeaveRequest>, attendedDays: attended, workingDays: working);
      });

  @override
  Future<LeaveRequest> apply({
    required String childId,
    required DateTime from,
    required DateTime to,
    required String reason,
    LeaveType type = LeaveType.other,
    String? attachment,
  }) async {
    final child = await _session.student(childId);
    final f = dateOnly(from), t = dateOnly(to);
    final days = t.difference(f).inDays + 1;
    final fmt = DateFormat('MMM d');
    final now = DateTime.now();
    final medical = type == LeaveType.medical || RegExp(r'sick|fever|ill|doctor|hospital|medical', caseSensitive: false).hasMatch(reason);
    final ref = _session.col('student_leaves').doc();
    final data = {
      'studentId': childId,
      'classId': '${child['classId'] ?? ''}',
      'name': '${child['name'] ?? ''}',
      'roll': child['roll'] ?? 0,
      'from': isoDay(f),
      'to': isoDay(t),
      'days': days,
      'daysLabel': days == 1 ? '1 Day' : '$days Days',
      'dateText': days == 1 ? fmt.format(f) : '${fmt.format(f)} – ${fmt.format(t)}',
      'reason': reason.trim(),
      'type': medical ? 'Medical Leave' : type == LeaveType.familyEvent ? 'Family Event' : 'Personal Leave',
      'leaveType': type.name,
      if (attachment != null && attachment.isNotEmpty) 'attachmentName': attachment,
      'cat': medical ? 'medical' : 'leave',
      'by': '${_session.user['name'] ?? child['guardian'] ?? 'Parent'} (${child['relation'] ?? 'Parent'})',
      'status': 'Pending',
      'parentUid': _session.uid,
      'appliedOn': isoDay(now),
      'createdAt': now.toUtc().toIso8601String(),
      'updatedAt': now.toUtc().toIso8601String(),
      'updatedBy': _session.uid,
    };
    await ref.set(data);
    return fromDoc(ref.id, data);
  }

  static LeaveRequest fromDoc(String id, Json d) {
    final from = parseDay(d['from']) ?? today();
    return LeaveRequest(
      id: id,
      childId: '${d['studentId'] ?? ''}',
      from: from,
      to: parseDay(d['to']) ?? from,
      reason: '${d['reason'] ?? ''}',
      appliedOn: parseDay(d['appliedOn']) ?? parseTime(d['createdAt']) ?? from,
      status: switch ('${d['status'] ?? ''}'.toLowerCase()) {
        'approved' => LeaveStatus.approved,
        'rejected' => LeaveStatus.rejected,
        _ => LeaveStatus.pending,
      },
      reviewerNote: '${d['decisionNote'] ?? ''}'.isEmpty ? null : '${d['decisionNote']}',
      type: LeaveType.values.asNameMap()['${d['leaveType']}'] ?? ('${d['cat']}' == 'medical' ? LeaveType.medical : LeaveType.other),
      attachment: '${d['attachmentName'] ?? ''}'.isEmpty ? null : '${d['attachmentName']}',
      reviewer: '${d['status'] ?? 'Pending'}' == 'Pending' ? null : 'Class teacher',
    );
  }
}
