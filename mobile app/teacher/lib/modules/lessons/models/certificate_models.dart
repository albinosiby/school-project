import 'package:equatable/equatable.dart';

int _int(dynamic v, [int d = 0]) => (v as num?)?.toInt() ?? d;

/// Certificate layout (collection `cr_templates`). [color] is an ARGB int.
class CertTemplate extends Equatable {
  const CertTemplate({required this.id, required this.name, required this.category, this.desc = '', this.orientation = 'Landscape', this.color = 0xFF2F4FD8, this.popular = false});
  final String id, name, category, desc, orientation;
  final int color;
  final bool popular;

  bool get portrait => orientation == 'Portrait';

  factory CertTemplate.fromJson(Map<String, dynamic> j) => CertTemplate(
        id: '${j['id'] ?? ''}', name: '${j['name'] ?? ''}', category: '${j['category'] ?? ''}', desc: '${j['desc'] ?? ''}',
        orientation: '${j['orientation'] ?? 'Landscape'}', color: _int(j['color'], 0xFF2F4FD8), popular: j['popular'] == true,
      );
  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'category': category, 'desc': desc, 'orientation': orientation, 'color': color, 'popular': popular};

  @override
  List<Object?> get props => [id, name, category, desc, orientation, color, popular];
}

/// A certificate issued (or pending signature) to a student (collection `cr_certs`). [status]: `issued` or `pending`.
class StudentCertificate extends Equatable {
  const StudentCertificate({
    required this.id, required this.studentId, required this.student, required this.roll, required this.cls, required this.title, this.citation = '',
    this.status = 'pending', this.date = '', this.templateId = '', this.authority = '', this.code = '',
  });
  final String id, studentId, student, cls, title, citation, status, date, templateId, authority, code;
  final int roll;

  bool get issued => status == 'issued';
  String get rollLabel => 'Roll #${'$roll'.padLeft(2, '0')}';

  factory StudentCertificate.fromJson(Map<String, dynamic> j) => StudentCertificate(
        id: '${j['id'] ?? ''}', studentId: '${j['studentId'] ?? ''}', student: '${j['student'] ?? ''}', roll: _int(j['roll']), cls: '${j['cls'] ?? ''}',
        title: '${j['title'] ?? ''}', citation: '${j['citation'] ?? ''}', status: '${j['status'] ?? 'pending'}', date: '${j['date'] ?? ''}',
        templateId: '${j['templateId'] ?? ''}', authority: '${j['authority'] ?? ''}', code: '${j['code'] ?? ''}',
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'studentId': studentId, 'student': student, 'roll': roll, 'cls': cls, 'title': title, 'citation': citation, 'status': status,
        'date': date, 'templateId': templateId, 'authority': authority, 'code': code,
      };
  StudentCertificate copyWith({String? status, String? date}) =>
      StudentCertificate.fromJson({...toJson(), 'status': ?status, 'date': ?date});

  @override
  List<Object?> get props => [id, studentId, student, roll, cls, title, citation, status, date, templateId, authority, code];
}

/// The teacher's own professional certification (collection `cr_mine`). [status]: `verified`, `active`, `expiring`.
class MyCertification extends Equatable {
  const MyCertification({required this.id, required this.title, required this.issuer, this.status = 'verified', this.kind = 'cert', this.tags = const [], this.validity = '', this.code = '', this.hours = 0});
  final String id, title, issuer, status, kind, validity, code;
  final List<String> tags;
  final int hours;

  factory MyCertification.fromJson(Map<String, dynamic> j) => MyCertification(
        id: '${j['id'] ?? ''}', title: '${j['title'] ?? ''}', issuer: '${j['issuer'] ?? ''}', status: '${j['status'] ?? 'verified'}', kind: '${j['kind'] ?? 'cert'}',
        tags: [for (final t in (j['tags'] as List? ?? const [])) '$t'], validity: '${j['validity'] ?? ''}', code: '${j['code'] ?? ''}', hours: _int(j['hours']),
      );
  Map<String, dynamic> toJson() => {'id': id, 'title': title, 'issuer': issuer, 'status': status, 'kind': kind, 'tags': tags, 'validity': validity, 'code': code, 'hours': hours};

  @override
  List<Object?> get props => [id, title, issuer, status, kind, tags, validity, code, hours];
}

/// The certificate being composed on the Issue screen and shown on the Preview screen (doc `cr_draft`).
class CertificateDraft extends Equatable {
  const CertificateDraft({required this.studentId, required this.title, required this.citation, this.authority = '', this.templateId = 'tp_1', this.seal = true, this.mark = false});
  final String studentId, title, citation, authority, templateId;
  final bool seal, mark;

  static CertificateDraft? fromJson(Map<String, dynamic> j) {
    if ('${j['studentId'] ?? ''}'.isEmpty) return null;
    return CertificateDraft(
      studentId: '${j['studentId']}', title: '${j['title'] ?? ''}', citation: '${j['citation'] ?? ''}', authority: '${j['authority'] ?? ''}',
      templateId: '${j['templateId'] ?? 'tp_1'}', seal: j['seal'] != false, mark: j['mark'] == true,
    );
  }
  Map<String, dynamic> toJson() => {'studentId': studentId, 'title': title, 'citation': citation, 'authority': authority, 'templateId': templateId, 'seal': seal, 'mark': mark};

  @override
  List<Object?> get props => [studentId, title, citation, authority, templateId, seal, mark];
}
