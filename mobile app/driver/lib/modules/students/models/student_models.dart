import 'package:equatable/equatable.dart';

/// A student on the crew's bus: the `students` doc slice the roster needs (contract 14.2).
class BusStudent extends Equatable {
  const BusStudent({
    required this.id,
    required this.name,
    this.grade = '',
    this.section = '',
    this.classId = '',
    this.roll = 0,
    this.grn = '',
    this.guardian = '',
    this.relation = '',
    this.phone = '',
    this.busId = '',
    this.busStopId = '',
    this.busStop = '',
    this.photoUrl,
    this.medicalNote = '',
  });
  final String id, name, grade, section, classId, grn, guardian, relation, phone, busId, busStopId, busStop, medicalNote;
  final int roll;
  final String? photoUrl;

  String get classLabel => grade.isEmpty ? '' : 'Class $grade${section.isEmpty ? '' : '-$section'}';
  String get rollLabel => roll == 0 ? '' : 'Roll #${roll.toString().padLeft(2, '0')}';
  bool get hasPhone => phone.replaceAll(RegExp(r'\D'), '').length >= 6;

  factory BusStudent.fromJson(Map<String, dynamic> j, {String? id}) => BusStudent(
    id: id ?? '${j['id'] ?? ''}',
    name: '${j['name'] ?? ''}',
    grade: '${j['grade'] ?? ''}',
    section: '${j['section'] ?? ''}',
    classId: '${j['classId'] ?? ''}',
    roll: (j['roll'] as num?)?.toInt() ?? 0,
    grn: '${j['grn'] ?? ''}',
    guardian: '${j['guardian'] ?? ''}',
    relation: '${j['relation'] ?? ''}',
    phone: '${j['phone'] ?? ''}',
    busId: '${j['busId'] ?? ''}',
    busStopId: '${j['busStopId'] ?? ''}',
    busStop: '${j['busStop'] ?? ''}',
    photoUrl: j['photoUrl'] == null ? null : '${j['photoUrl']}',
    medicalNote: '${j['medicalNote'] ?? ''}',
  );

  Map<String, dynamic> toJson() => {
    'id': id, 'name': name, 'grade': grade, 'section': section, 'classId': classId, 'roll': roll, 'grn': grn,
    'guardian': guardian, 'relation': relation, 'phone': phone, 'busId': busId, 'busStopId': busStopId, 'busStop': busStop,
    if (photoUrl != null) 'photoUrl': photoUrl, if (medicalNote.isNotEmpty) 'medicalNote': medicalNote,
  };

  @override
  List<Object?> get props => [id, name, grade, section, classId, roll, grn, guardian, relation, phone, busId, busStopId, busStop, photoUrl, medicalNote];
}

/// The roster in route order: by the position of the child's stop in the bus's stop list (the admin web may reorder stops
/// without renumbering their ids), children without a known stop last, then roll and name.
List<BusStudent> inRouteOrder(List<BusStudent> roster, List<String> stopIds) {
  int pos(BusStudent s) {
    final i = stopIds.indexOf(s.busStopId);
    return i < 0 ? stopIds.length : i;
  }
  return [...roster]..sort((a, b) {
      final p = pos(a).compareTo(pos(b));
      if (p != 0) return p;
      final r = a.roll.compareTo(b.roll);
      return r != 0 ? r : a.name.compareTo(b.name);
    });
}
