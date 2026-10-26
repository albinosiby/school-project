import 'package:equatable/equatable.dart';
import 'package:intl/intl.dart';

/// Attendance code of one student in one record.
enum AttCode {
  present('P', 'Present'),
  absent('A', 'Absent'),
  late('L', 'Late'),
  excused('E', 'Excused');

  const AttCode(this.code, this.label);
  final String code, label;
  static AttCode of(String? c) => AttCode.values.firstWhere((e) => e.code == c, orElse: () => AttCode.present);
}

/// Period timetable (number -> start/end, 24h).
const Map<int, (String, String)> periodTimes = {
  1: ('08:30', '09:15'),
  2: ('09:15', '10:00'),
  3: ('10:15', '11:00'),
  4: ('11:00', '11:45'),
  5: ('13:30', '14:15'),
  6: ('14:15', '15:00'),
  7: ('15:00', '15:45'),
};

String dkey(DateTime d) => DateFormat('yyyy-MM-dd').format(d);
DateTime todayDate() {
  final n = DateTime.now();
  return DateTime(n.year, n.month, n.day);
}

String fmtKey(String key, [String pattern = 'MMM d, yyyy']) {
  final d = DateTime.tryParse(key);
  return d == null ? key : DateFormat(pattern).format(d);
}

/// '08:15' -> '08:15 AM'
String t12(String? hhmm) {
  if (hhmm == null || hhmm.isEmpty) return '--';
  final p = hhmm.split(':');
  final h = int.parse(p[0]);
  final m = int.parse(p[1]);
  return '${(h % 12 == 0 ? 12 : h % 12).toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')} ${h >= 12 ? 'PM' : 'AM'}';
}

int mins(String hhmm) {
  final p = hhmm.split(':');
  return int.parse(p[0]) * 60 + int.parse(p[1]);
}

String two(num n) => n.toString().padLeft(2, '0');
String hm(int m) => '${two(m ~/ 60)}:${two(m % 60)}';
String nowHm() {
  final n = DateTime.now();
  return '${two(n.hour)}:${two(n.minute)}';
}

String periodRange(int p) => '${t12(periodTimes[p]!.$1)} – ${t12(periodTimes[p]!.$2)}';

typedef AttCounts = ({int total, int present, int absent, int late, int excused});

/// One attendance sheet (class + date + period). [marks] only lists non-present students.
class AttendanceRecord extends Equatable {
  const AttendanceRecord({required this.id, required this.classId, required this.date, required this.period, required this.total, this.marks = const {}, this.submitted = false, this.updatedAt = ''});
  final String id, classId, date, updatedAt;
  final int period, total;
  final Map<String, String> marks;
  final bool submitted;

  AttCode codeOf(String studentId) => AttCode.of(marks[studentId]);

  AttCounts get counts {
    var a = 0, l = 0, e = 0;
    for (final v in marks.values) {
      if (v == 'A') a++;
      if (v == 'L') l++;
      if (v == 'E') e++;
    }
    return (total: total, present: total - a - l - e, absent: a, late: l, excused: e);
  }

  /// Present + late, in percent.
  double get rate => total == 0 ? 0 : (counts.present + counts.late) * 100 / total;

  factory AttendanceRecord.fromJson(Map<String, dynamic> j) {
    final m = {for (final e in (j['marks'] as Map? ?? const {}).entries) '${e.key}': '${e.value}'};
    return AttendanceRecord(
      id: j['id'] as String? ?? '', classId: j['classId'] as String? ?? '', date: j['date'] as String? ?? '', period: (j['period'] as num?)?.toInt() ?? 1,
      total: (j['total'] as num?)?.toInt() ?? m.length, marks: m, submitted: j['submitted'] == true, updatedAt: j['updatedAt'] as String? ?? '',
    );
  }
  Map<String, dynamic> toJson() => {'id': id, 'classId': classId, 'date': date, 'period': period, 'total': total, 'marks': marks, 'submitted': submitted, 'updatedAt': updatedAt};
  AttendanceRecord copyWith({int? total, Map<String, String>? marks, bool? submitted, String? updatedAt}) => AttendanceRecord(
        id: id, classId: classId, date: date, period: period, total: total ?? this.total, marks: marks ?? this.marks,
        submitted: submitted ?? this.submitted, updatedAt: updatedAt ?? this.updatedAt,
      );
  @override
  List<Object?> get props => [id, classId, date, period, total, marks, submitted, updatedAt];
}

/// Submitted records of [classId] (the latest one per day), optionally within [from]..[to], oldest first.
List<AttendanceRecord> dailyRecords(Iterable<AttendanceRecord> all, String classId, {String? from, String? to}) {
  final byDay = <String, AttendanceRecord>{};
  for (final r in all) {
    if (r.classId != classId || !r.submitted) continue;
    if (from != null && r.date.compareTo(from) < 0) continue;
    if (to != null && r.date.compareTo(to) > 0) continue;
    final cur = byDay[r.date];
    if (cur == null || r.updatedAt.compareTo(cur.updatedAt) > 0) byDay[r.date] = r;
  }
  return byDay.values.toList()..sort((a, b) => a.date.compareTo(b.date));
}

/// Per-student attendance % (present or late) over [records].
double studentRate(List<AttendanceRecord> records, String studentId) {
  if (records.isEmpty) return 100;
  var ok = 0;
  for (final r in records) {
    final c = r.codeOf(studentId);
    if (c == AttCode.present || c == AttCode.late) ok++;
  }
  return ok * 100 / records.length;
}

double averageRate(List<AttendanceRecord> records) => records.isEmpty ? 0 : records.map((r) => r.rate).reduce((a, b) => a + b) / records.length;

/// A period the teacher takes today (Attendance overview).
class ScheduleSlot extends Equatable {
  const ScheduleSlot({required this.id, required this.classId, required this.period});
  final String id, classId;
  final int period;
  factory ScheduleSlot.fromJson(Map<String, dynamic> j) => ScheduleSlot(id: j['id'] as String, classId: j['classId'] as String? ?? '', period: (j['period'] as num?)?.toInt() ?? 1);
  Map<String, dynamic> toJson() => {'id': id, 'classId': classId, 'period': period};
  @override
  List<Object?> get props => [id, classId, period];
}

/// Teacher's own daily punch log. status: Present | Late | Leave | Irregular.
class StaffLog extends Equatable {
  const StaffLog({required this.id, required this.date, this.inTime, this.outTime, required this.status, this.note = ''});
  final String id, date, status, note;
  final String? inTime, outTime;
  factory StaffLog.fromJson(Map<String, dynamic> j) => StaffLog(
        id: j['id'] as String? ?? '', date: j['date'] as String? ?? '', inTime: j['in'] as String?, outTime: j['out'] as String?,
        status: j['status'] as String? ?? 'Present', note: j['note'] as String? ?? '',
      );
  Map<String, dynamic> toJson() => {'id': id, 'date': date, 'in': inTime, 'out': outTime, 'status': status, 'note': note};
  StaffLog copyWith({String? outTime}) => StaffLog(id: id, date: date, inTime: inTime, outTime: outTime ?? this.outTime, status: status, note: note);
  @override
  List<Object?> get props => [id, date, inTime, outTime, status, note];
}

class Regularization extends Equatable {
  const Regularization({this.id = '', required this.date, required this.type, required this.time, required this.reason, this.note = '', this.status = 'Pending', this.at = '', this.decisionNote = ''});
  final String id, date, type, time, reason, note, status, at;

  /// The admin's note when approving / rejecting (read only).
  final String decisionNote;
  factory Regularization.fromJson(Map<String, dynamic> j) => Regularization(
        id: j['id'] as String? ?? '', date: j['date'] as String? ?? '', type: j['type'] as String? ?? '', time: j['time'] as String? ?? '',
        reason: j['reason'] as String? ?? '', note: j['note'] as String? ?? '', status: j['status'] as String? ?? 'Pending', at: j['at'] as String? ?? '',
        decisionNote: j['decisionNote'] as String? ?? '',
      );
  Map<String, dynamic> toJson() => {
        if (id.isNotEmpty) 'id': id, 'date': date, 'type': type, 'time': time, 'reason': reason, 'note': note, 'status': status, 'at': at,
        if (decisionNote.isNotEmpty) 'decisionNote': decisionNote,
      };
  @override
  List<Object?> get props => [id, date, type, time, reason, note, status, at, decisionNote];
}

/// A message/call to a parent about attendance.
class ParentNotice extends Equatable {
  const ParentNotice({this.id = '', required this.studentId, required this.classId, required this.channels, required this.message, this.template, this.auto = false, this.ack = false, this.ackRequested = false, this.at = ''});
  final String id, studentId, classId, message, at;
  final String? template;
  final List<String> channels;
  final bool auto, ack, ackRequested;
  factory ParentNotice.fromJson(Map<String, dynamic> j) => ParentNotice(
        id: j['id'] as String? ?? '', studentId: j['studentId'] as String? ?? '', classId: j['classId'] as String? ?? '',
        channels: [for (final c in j['channels'] as List? ?? const []) '$c'], message: j['message'] as String? ?? '', template: j['template'] as String?,
        auto: j['auto'] == true, ack: j['ack'] == true, ackRequested: j['ackRequested'] == true, at: j['at'] as String? ?? '',
      );
  Map<String, dynamic> toJson() => {
        if (id.isNotEmpty) 'id': id, 'studentId': studentId, 'classId': classId, 'channels': channels, 'message': message, 'template': ?template,
        'auto': auto, 'ack': ack, 'ackRequested': ackRequested, 'at': at,
      };
  @override
  List<Object?> get props => [id, studentId, classId, channels, message, template, auto, ack, ackRequested, at];
}

class SlipFile extends Equatable {
  const SlipFile({required this.name, required this.meta});
  final String name, meta;
  factory SlipFile.fromJson(Map<String, dynamic> j) => SlipFile(name: j['name'] as String? ?? '', meta: j['meta'] as String? ?? '');
  Map<String, dynamic> toJson() => {'name': name, 'meta': meta};
  @override
  List<Object?> get props => [name, meta];
}

/// Student leave slip sent by a parent. status: Pending | Approved | Rejected | Clarify.
class LeaveSlip extends Equatable {
  const LeaveSlip({required this.id, required this.studentId, required this.type, required this.from, required this.to, required this.reason, this.parent = '', this.note = '', this.files = const [], this.status = 'Pending', this.decisionNote, this.decidedAt});
  final String id, studentId, type, from, to, reason, parent, note, status;
  final List<SlipFile> files;
  final String? decisionNote, decidedAt;
  bool get decided => status == 'Approved' || status == 'Rejected';
  bool covers(String date) => from.compareTo(date) <= 0 && to.compareTo(date) >= 0;
  factory LeaveSlip.fromJson(Map<String, dynamic> j) => LeaveSlip(
        id: j['id'] as String, studentId: j['studentId'] as String? ?? '', type: j['type'] as String? ?? '', from: j['from'] as String? ?? '',
        to: j['to'] as String? ?? '', reason: j['reason'] as String? ?? '', parent: j['parent'] as String? ?? '', note: j['note'] as String? ?? '',
        files: [for (final f in j['files'] as List? ?? const []) SlipFile.fromJson(Map<String, dynamic>.from(f as Map))],
        status: j['status'] as String? ?? 'Pending', decisionNote: j['decisionNote'] as String?, decidedAt: j['decidedAt'] as String?,
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'studentId': studentId, 'type': type, 'from': from, 'to': to, 'reason': reason, 'parent': parent, 'note': note,
        'files': [for (final f in files) f.toJson()], 'status': status, 'decisionNote': ?decisionNote, 'decidedAt': ?decidedAt,
      };
  @override
  List<Object?> get props => [id, studentId, type, from, to, reason, parent, note, files, status, decisionNote, decidedAt];
}

/// Medical slip uploaded by a parent. status: Pending | Approved | Rejected.
class MedicalSlip extends Equatable {
  const MedicalSlip({required this.id, required this.studentId, required this.title, required this.clinic, required this.from, required this.to, required this.days, this.file = '', this.uploader = '', this.uploadedAt = '', this.status = 'Pending', this.by = '', this.reason});
  final String id, studentId, title, clinic, from, to, file, uploader, uploadedAt, status, by;
  final int days;
  final String? reason;
  bool covers(String date) => from.compareTo(date) <= 0 && to.compareTo(date) >= 0;
  factory MedicalSlip.fromJson(Map<String, dynamic> j) => MedicalSlip(
        id: j['id'] as String, studentId: j['studentId'] as String? ?? '', title: j['title'] as String? ?? '', clinic: j['clinic'] as String? ?? '',
        from: j['from'] as String? ?? '', to: j['to'] as String? ?? '', days: (j['days'] as num?)?.toInt() ?? 1, file: j['file'] as String? ?? '',
        uploader: j['uploader'] as String? ?? '', uploadedAt: j['uploadedAt'] as String? ?? '', status: j['status'] as String? ?? 'Pending',
        by: j['by'] as String? ?? '', reason: j['reason'] as String?,
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'studentId': studentId, 'title': title, 'clinic': clinic, 'from': from, 'to': to, 'days': days, 'file': file,
        'uploader': uploader, 'uploadedAt': uploadedAt, 'status': status, 'by': by, 'reason': ?reason,
      };
  @override
  List<Object?> get props => [id, studentId, title, from, to, days, status, by, reason];
}
