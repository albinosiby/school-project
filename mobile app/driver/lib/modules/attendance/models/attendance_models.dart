import 'package:equatable/equatable.dart';
import '../../trips/models/trip_models.dart';

/// Status of one student on one trip (contract 14.4).
enum MarkStatus { boarded, absent, dropped }

extension MarkStatusX on MarkStatus {
  String get code => name;
  String get label => switch (this) {
    MarkStatus.boarded => 'Boarded',
    MarkStatus.absent => 'Absent',
    MarkStatus.dropped => 'Dropped',
  };
  static MarkStatus? parse(Object? v) => switch ('$v') {
    'boarded' => MarkStatus.boarded,
    'absent' => MarkStatus.absent,
    'dropped' => MarkStatus.dropped,
    _ => null,
  };
}

/// `marks.{studentId}` of a `tr_attendance` doc.
class Mark extends Equatable {
  const Mark({required this.status, required this.at, required this.by, this.byName = '', this.stopId});
  final MarkStatus status;
  final DateTime at;
  final String by, byName;
  final String? stopId;

  factory Mark.fromJson(Map<String, dynamic> j) => Mark(
    status: MarkStatusX.parse(j['status']) ?? MarkStatus.boarded,
    at: parseIso(j['at']) ?? DateTime.fromMillisecondsSinceEpoch(0),
    by: '${j['by'] ?? ''}',
    byName: '${j['byName'] ?? ''}',
    stopId: j['stopId'] == null ? null : '${j['stopId']}',
  );
  Map<String, dynamic> toJson() => {
    'status': status.code, 'at': at.toUtc().toIso8601String(), 'by': by, 'byName': byName, if (stopId != null) 'stopId': stopId,
  };

  @override
  List<Object?> get props => [status, at, by, byName, stopId];
}

/// `tr_attendance/{date}_{busId}_{kind}`: the marks of one trip.
class TripAttendance extends Equatable {
  const TripAttendance({required this.tripId, required this.busId, required this.date, required this.kind, this.bus = '', this.total = 0, this.marks = const {}});
  final String tripId, busId, date, bus;
  final TripKind kind;
  final int total;
  final Map<String, Mark> marks;

  Mark? of(String studentId) => marks[studentId];
  int count(MarkStatus s) => marks.values.where((m) => m.status == s).length;
  int get boarded => count(MarkStatus.boarded);
  int get dropped => count(MarkStatus.dropped);
  int get absent => count(MarkStatus.absent);
  int get pending => total - marks.length;

  factory TripAttendance.empty(Trip t) => TripAttendance(tripId: t.id, busId: t.busId, bus: t.bus, date: t.date, kind: t.kind, total: t.total);

  factory TripAttendance.fromJson(Map<String, dynamic> j, {String? id}) {
    final raw = j['marks'];
    return TripAttendance(
      tripId: '${j['tripId'] ?? id ?? ''}',
      busId: '${j['busId'] ?? ''}',
      bus: '${j['bus'] ?? ''}',
      date: '${j['date'] ?? ''}',
      kind: TripKindX.parse(j['kind']),
      total: (j['total'] as num?)?.toInt() ?? 0,
      marks: raw is Map ? {for (final e in raw.entries) if (e.value is Map) '${e.key}': Mark.fromJson(Map<String, dynamic>.from(e.value as Map))} : const {},
    );
  }

  Map<String, dynamic> toJson() => {
    'tripId': tripId, 'busId': busId, 'bus': bus, 'date': date, 'kind': kind.code, 'total': total,
    'marks': {for (final e in marks.entries) e.key: e.value.toJson()}, 'boarded': boarded, 'dropped': dropped, 'absent': absent,
  };

  TripAttendance withMark(String studentId, Mark? mark) {
    final next = Map<String, Mark>.from(marks);
    if (mark == null) {
      next.remove(studentId);
    } else {
      next[studentId] = mark;
    }
    return TripAttendance(tripId: tripId, busId: busId, bus: bus, date: date, kind: kind, total: total, marks: next);
  }

  @override
  List<Object?> get props => [tripId, busId, bus, date, kind, total, marks];
}
