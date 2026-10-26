import 'package:equatable/equatable.dart';

/// An invigilation duty — collection `ed_duties`. [report], [start], [end] are `HH:mm`.
class ExamDuty extends Equatable {
  const ExamDuty({
    required this.id, required this.code, required this.subject, this.sub = '', required this.date, required this.start, required this.end, this.hall = '', this.venue = '',
    this.role = '', this.partner = '', this.partnerRole = '', this.candidates = 0, this.status = 'upcoming', this.report = '', this.swap = '', this.swapWith = '',
    this.swapReason = '', this.cls = '', this.control = '', this.checked = const [], this.submitted = false,
  });
  final String id, code, subject, sub, date, start, end, hall, venue, role, partner, partnerRole, status, report, swap, swapWith, swapReason, cls, control;
  final int candidates;
  final List<int> checked;
  final bool submitted;

  bool get upcoming => status == 'upcoming';
  bool get completed => status == 'completed';
  bool get chief => role == 'Chief Invigilator';
  bool get swapRequested => swap.isNotEmpty;
  bool get solo => partner == 'Self';
  String get sortKey => '$date $start';
  String get shortHall => hall.replaceFirst('Examination ', '');

  factory ExamDuty.fromJson(Map<String, dynamic> j) => ExamDuty(
        id: '${j['id'] ?? ''}', code: '${j['code'] ?? ''}', subject: '${j['subject'] ?? ''}', sub: '${j['sub'] ?? ''}', date: '${j['date'] ?? ''}', start: '${j['start'] ?? ''}',
        end: '${j['end'] ?? ''}', hall: '${j['hall'] ?? ''}', venue: '${j['venue'] ?? ''}', role: '${j['role'] ?? ''}', partner: '${j['partner'] ?? ''}',
        partnerRole: '${j['partnerRole'] ?? ''}', candidates: (j['candidates'] as num?)?.toInt() ?? 0, status: '${j['status'] ?? 'upcoming'}', report: '${j['report'] ?? ''}',
        swap: '${j['swap'] ?? ''}', swapWith: '${j['swapWith'] ?? ''}', swapReason: '${j['swapReason'] ?? ''}', cls: '${j['cls'] ?? ''}', control: '${j['control'] ?? ''}',
        checked: [for (final x in (j['checked'] as List? ?? const [])) (x as num).toInt()], submitted: j['submitted'] == true,
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'code': code, 'subject': subject, 'sub': sub, 'date': date, 'start': start, 'end': end, 'hall': hall, 'venue': venue, 'role': role, 'partner': partner,
        'partnerRole': partnerRole, 'candidates': candidates, 'status': status, 'report': report, 'swap': swap, 'swapWith': swapWith, 'swapReason': swapReason, 'cls': cls,
        'control': control, 'checked': checked, 'submitted': submitted,
      };
  ExamDuty copyWith({String? swap, String? swapWith, String? swapReason, List<int>? checked, bool? submitted}) =>
      ExamDuty.fromJson({...toJson(), 'swap': ?swap, 'swapWith': ?swapWith, 'swapReason': ?swapReason, 'checked': ?checked, 'submitted': ?submitted});

  @override
  List<Object?> get props => [id, code, subject, sub, date, start, end, hall, venue, role, partner, partnerRole, candidates, status, report, swap, swapWith, swapReason, cls, control, checked, submitted];
}

/// A candidate seated in an exam hall — collection `ed_candidates`.
class Candidate extends Equatable {
  const Candidate({
    required this.id, required this.dutyId, required this.desk, required this.seq, required this.set, required this.name, required this.roll, this.cls = '', this.cbse = '',
    this.omr = '', this.supp = 0, this.suppCode = '', this.status = 'present', this.absentReason = '', this.malpractice = '',
  });
  final String id, dutyId, desk, set, name, cls, cbse, omr, suppCode, status, absentReason, malpractice;
  final int seq, roll, supp;

  bool get absent => status == 'absent';
  String get rollText => roll.toString().padLeft(2, '0');
  String get deskLabel => desk.replaceFirst('D-', 'Desk ');
  String get shortName {
    final p = name.split(' ');
    return p.length > 1 ? '${p.first} ${p.last[0]}.' : p.first;
  }

  factory Candidate.fromJson(Map<String, dynamic> j) => Candidate(
        id: '${j['id'] ?? ''}', dutyId: '${j['dutyId'] ?? ''}', desk: '${j['desk'] ?? ''}', seq: (j['seq'] as num?)?.toInt() ?? 0, set: '${j['set'] ?? ''}',
        name: '${j['name'] ?? ''}', roll: (j['roll'] as num?)?.toInt() ?? 0, cls: '${j['cls'] ?? ''}', cbse: '${j['cbse'] ?? ''}', omr: '${j['omr'] ?? ''}',
        supp: (j['supp'] as num?)?.toInt() ?? 0, suppCode: '${j['suppCode'] ?? ''}', status: '${j['status'] ?? 'present'}', absentReason: '${j['absentReason'] ?? ''}',
        malpractice: '${j['malpractice'] ?? ''}',
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'dutyId': dutyId, 'desk': desk, 'seq': seq, 'set': set, 'name': name, 'roll': roll, 'cls': cls, 'cbse': cbse, 'omr': omr, 'supp': supp,
        'suppCode': suppCode, 'status': status, 'absentReason': absentReason, 'malpractice': malpractice,
      };
  Candidate copyWith({String? status, int? supp, String? suppCode, String? malpractice}) =>
      Candidate.fromJson({...toJson(), 'status': ?status, 'supp': ?supp, 'suppCode': ?suppCode, 'malpractice': ?malpractice});

  @override
  List<Object?> get props => [id, dutyId, desk, seq, set, name, roll, cls, cbse, omr, supp, suppCode, status, absentReason, malpractice];
}
