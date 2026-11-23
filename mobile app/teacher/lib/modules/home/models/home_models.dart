import 'package:equatable/equatable.dart';

/// A pending action card on the Home tab (collection `hm_pending`).
class PendingTask extends Equatable {
  const PendingTask({required this.id, required this.tag, required this.tone, required this.due, required this.title, required this.desc, required this.route, this.done = false});
  final String id, tag, tone, due, title, desc, route;
  final bool done;

  factory PendingTask.fromJson(Map<String, dynamic> j) => PendingTask(
        id: j['id'] as String, tag: j['tag'] as String? ?? '', tone: j['tone'] as String? ?? 'brand', due: j['due'] as String? ?? '',
        title: j['title'] as String? ?? '', desc: j['desc'] as String? ?? '', route: j['route'] as String? ?? '', done: j['done'] == true,
      );
  Map<String, dynamic> toJson() => {'id': id, 'tag': tag, 'tone': tone, 'due': due, 'title': title, 'desc': desc, 'route': route, 'done': done};
  PendingTask copyWith({bool? done}) => PendingTask(id: id, tag: tag, tone: tone, due: due, title: title, desc: desc, route: route, done: done ?? this.done);

  @override
  List<Object?> get props => [id, tag, tone, due, title, desc, route, done];
}

/// A duty / reminder card on the Home tab (collection `hm_reminders`).
class Reminder extends Equatable {
  const Reminder({required this.id, required this.title, required this.time, required this.place, required this.route});
  final String id, title, time, place, route;

  factory Reminder.fromJson(Map<String, dynamic> j) => Reminder(
        id: j['id'] as String, title: j['title'] as String? ?? '', time: j['time'] as String? ?? '', place: j['place'] as String? ?? '', route: j['route'] as String? ?? '',
      );
  Map<String, dynamic> toJson() => {'id': id, 'title': title, 'time': time, 'place': place, 'route': route};
  Reminder copyWith({String? title, String? time}) => Reminder(id: id, title: title ?? this.title, time: time ?? this.time, place: place, route: route);

  @override
  List<Object?> get props => [id, title, time, place, route];
}

/// App preferences (single document `settings`).
class AppSettings extends Equatable {
  const AppSettings({
    this.classUpdates = true, this.parentMessages = true, this.urgent = true, this.sound = true,
    this.lastSync,
  });
  final bool classUpdates, parentMessages, urgent, sound;
  final String? lastSync;

  factory AppSettings.fromJson(Map<String, dynamic> j) => AppSettings(
        classUpdates: j['classUpdates'] != false, parentMessages: j['parentMessages'] != false,
        urgent: j['urgent'] != false, sound: j['sound'] != false,
        lastSync: j['lastSync'] as String?,
      );
  Map<String, dynamic> toJson() => {
        'classUpdates': classUpdates, 'parentMessages': parentMessages, 'urgent': urgent, 'sound': sound,
        'lastSync': ?lastSync,
      };
  AppSettings copyWith({
    bool? classUpdates, bool? parentMessages, bool? sound, String? lastSync,
  }) =>
      AppSettings(
        classUpdates: classUpdates ?? this.classUpdates, parentMessages: parentMessages ?? this.parentMessages,
        urgent: urgent, sound: sound ?? this.sound,
        lastSync: lastSync ?? this.lastSync,
      );

  @override
  List<Object?> get props => [classUpdates, parentMessages, urgent, sound, lastSync];
}

class Qualification extends Equatable {
  const Qualification({required this.title, required this.note, this.tone = 'neutral'});
  final String title, note, tone;
  factory Qualification.fromJson(Map<String, dynamic> j) => Qualification(title: j['title'] as String? ?? '', note: j['note'] as String? ?? '', tone: j['tone'] as String? ?? 'neutral');
  Map<String, dynamic> toJson() => {'title': title, 'note': note, 'tone': tone};
  @override
  List<Object?> get props => [title, note, tone];
}

/// One labelled value on the Profile page (mirrors a dashboard "details" row).
class ProfileField extends Equatable {
  const ProfileField(this.label, this.value);
  final String label, value;
  factory ProfileField.fromJson(Map<String, dynamic> j) => ProfileField(j['label'] as String? ?? '', j['value'] as String? ?? '');
  Map<String, dynamic> toJson() => {'label': label, 'value': value};
  @override
  List<Object?> get props => [label, value];
}

/// A Profile page section: groups of fields (qualifications have one group each). `note` replaces an empty body.
class ProfileSection extends Equatable {
  const ProfileSection({required this.key, required this.title, this.groups = const [], this.note = ''});
  final String key, title, note;
  final List<List<ProfileField>> groups;
  bool get isEmpty => groups.every((g) => g.isEmpty) && note.isEmpty;
  factory ProfileSection.fromJson(Map<String, dynamic> j) => ProfileSection(
        key: j['key'] as String? ?? '', title: j['title'] as String? ?? '', note: j['note'] as String? ?? '',
        groups: [
          for (final g in (j['groups'] as List? ?? const []))
            [for (final f in (g as List? ?? const [])) ProfileField.fromJson(Map<String, dynamic>.from(f as Map))],
        ],
      );
  Map<String, dynamic> toJson() => {'key': key, 'title': title, 'note': note, 'groups': [for (final g in groups) [for (final f in g) f.toJson()]]};
  @override
  List<Object?> get props => [key, title, note, groups];
}

/// A document the office uploaded for the staff member (name and category only; files stay with the office).
class StaffDocumentRow extends Equatable {
  const StaffDocumentRow({this.id = '', required this.category, required this.label, required this.name, required this.uploadedAt});
  final String id, category, label, name, uploadedAt;
  factory StaffDocumentRow.fromJson(Map<String, dynamic> j) => StaffDocumentRow(
        id: j['id'] as String? ?? '', category: j['category'] as String? ?? '', label: j['label'] as String? ?? '', name: j['name'] as String? ?? '', uploadedAt: j['uploadedAt'] as String? ?? '');
  Map<String, dynamic> toJson() => {'id': id, 'category': category, 'label': label, 'name': name, 'uploadedAt': uploadedAt};
  @override
  List<Object?> get props => [id, category, label, name, uploadedAt];
}

/// One payroll payment (amounts in rupees), newest first on the page.
class PayrollPayment extends Equatable {
  const PayrollPayment({required this.month, required this.paidOn, required this.gross, required this.deductions, required this.net, this.reference = ''});
  final String month, paidOn, reference;
  final double gross, deductions, net;
  factory PayrollPayment.fromJson(Map<String, dynamic> j) => PayrollPayment(
        month: j['month'] as String? ?? '', paidOn: j['paidOn'] as String? ?? '', reference: j['reference'] as String? ?? '',
        gross: (j['gross'] as num?)?.toDouble() ?? 0, deductions: (j['deductions'] as num?)?.toDouble() ?? 0, net: (j['net'] as num?)?.toDouble() ?? 0);
  Map<String, dynamic> toJson() => {'month': month, 'paidOn': paidOn, 'reference': reference, 'gross': gross, 'deductions': deductions, 'net': net};
  @override
  List<Object?> get props => [month, paidOn, reference, gross, deductions, net];
}

/// Faculty details shown on Profile and the Digital Faculty ID (single document `hm_profile`). The HR sections,
/// documents, bank details and payroll history mirror the office's staff profile (server card `staff_self`).
class FacultyProfile extends Equatable {
  const FacultyProfile({
    this.department = '', this.bloodGroup = '', this.emergency = '', this.validThrough = '', this.token = '', this.cardNo = '', this.desk = '',
    this.attendancePct = 0, this.experience = 0, this.qualifications = const [],
    this.sections = const [], this.documents = const [], this.bank = const [], this.payments = const [], this.hrUpdatedAt = '',
    this.schoolLine = '', this.emergencyPhone = '',
  });
  final String department, bloodGroup, emergency, validThrough, token, cardNo, desk, hrUpdatedAt, schoolLine, emergencyPhone;
  final double attendancePct;
  final int experience;
  final List<Qualification> qualifications;
  final List<ProfileSection> sections;
  final List<StaffDocumentRow> documents;
  final List<ProfileField> bank;
  final List<PayrollPayment> payments;
  /// True once the office's HR card has reached the app (otherwise the sections are placeholders).
  bool get hasHrCard => hrUpdatedAt.isNotEmpty;

  factory FacultyProfile.fromJson(Map<String, dynamic> j) => FacultyProfile(
        department: j['department'] as String? ?? '', bloodGroup: j['bloodGroup'] as String? ?? '', emergency: j['emergency'] as String? ?? '',
        validThrough: j['validThrough'] as String? ?? '', token: j['token'] as String? ?? '', cardNo: j['cardNo'] as String? ?? '',
        desk: j['desk'] as String? ?? '', attendancePct: (j['attendancePct'] as num?)?.toDouble() ?? 0, experience: (j['experience'] as num?)?.toInt() ?? 0,
        qualifications: [for (final q in (j['qualifications'] as List? ?? const [])) Qualification.fromJson(Map<String, dynamic>.from(q as Map))],
        sections: [for (final s in (j['sections'] as List? ?? const [])) ProfileSection.fromJson(Map<String, dynamic>.from(s as Map))],
        documents: [for (final d in (j['documents'] as List? ?? const [])) StaffDocumentRow.fromJson(Map<String, dynamic>.from(d as Map))],
        bank: [for (final f in (j['bank'] as List? ?? const [])) ProfileField.fromJson(Map<String, dynamic>.from(f as Map))],
        payments: [for (final p in (j['payments'] as List? ?? const [])) PayrollPayment.fromJson(Map<String, dynamic>.from(p as Map))],
        hrUpdatedAt: j['hrUpdatedAt'] as String? ?? '', schoolLine: j['schoolLine'] as String? ?? '', emergencyPhone: j['emergencyPhone'] as String? ?? '',
      );
  Map<String, dynamic> toJson() => {
        'department': department, 'bloodGroup': bloodGroup, 'emergency': emergency, 'validThrough': validThrough, 'token': token, 'cardNo': cardNo,
        'desk': desk, 'attendancePct': attendancePct, 'experience': experience, 'qualifications': [for (final q in qualifications) q.toJson()],
        'sections': [for (final s in sections) s.toJson()], 'documents': [for (final d in documents) d.toJson()],
        'bank': [for (final f in bank) f.toJson()], 'payments': [for (final p in payments) p.toJson()], 'hrUpdatedAt': hrUpdatedAt,
        'schoolLine': schoolLine, 'emergencyPhone': emergencyPhone,
      };
  FacultyProfile copyWith({String? desk, String? emergency}) => FacultyProfile.fromJson({...toJson(), 'desk': ?desk, 'emergency': ?emergency});

  @override
  List<Object?> get props => [department, bloodGroup, emergency, validThrough, token, cardNo, desk, attendancePct, experience, qualifications, sections, documents, bank, payments, hrUpdatedAt, schoolLine, emergencyPhone];
}
