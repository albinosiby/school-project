import 'package:equatable/equatable.dart';

/// `tr_crew_attendance/{date}_{crewId}` (contract 14.5): one crew member's check-in day.
class CrewDay extends Equatable {
  const CrewDay({required this.crewId, required this.date, this.inTime, this.outTime, this.status = 'Present', this.source = 'app', this.note = '', this.name = '', this.role = '', this.busId = ''});
  final String crewId, date, status, source, note, name, role, busId;
  final String? inTime, outTime;

  static String idFor(String date, String crewId) => '${date}_$crewId';
  String get id => idFor(date, crewId);
  bool get punchedIn => (inTime ?? '').isNotEmpty;
  bool get punchedOut => (outTime ?? '').isNotEmpty;

  factory CrewDay.fromJson(Map<String, dynamic> j) => CrewDay(
    crewId: '${j['crewId'] ?? ''}', date: '${j['date'] ?? ''}',
    inTime: j['in'] == null ? null : '${j['in']}', outTime: j['out'] == null ? null : '${j['out']}',
    status: '${j['status'] ?? 'Present'}', source: '${j['source'] ?? 'app'}', note: '${j['note'] ?? ''}',
    name: '${j['name'] ?? ''}', role: '${j['role'] ?? ''}', busId: '${j['busId'] ?? ''}',
  );
  Map<String, dynamic> toJson() => {
    'crewId': crewId, 'name': name, 'role': role, 'busId': busId, 'date': date, 'in': inTime, 'out': outTime,
    'status': status, 'source': source, 'note': note,
  };

  @override
  List<Object?> get props => [crewId, date, inTime, outTime, status, source, note, name, role, busId];
}

/// Today's check-in state plus the month's history.
class CrewAttendance extends Equatable {
  const CrewAttendance({this.today, this.month = const [], this.checkInBy = '06:30'});
  final CrewDay? today;
  final List<CrewDay> month;
  final String checkInBy;

  int count(String status) => month.where((d) => d.status == status).length;

  @override
  List<Object?> get props => [today, month, checkInBy];
}
