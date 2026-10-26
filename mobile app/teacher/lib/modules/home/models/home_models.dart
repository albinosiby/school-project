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
    this.biometric = true, this.classUpdates = true, this.parentMessages = true, this.urgent = true, this.sound = true, this.defaultClass,
    this.quickMark = true, this.dnd = false, this.dndFrom = '18:00', this.dndTo = '07:30', this.parentMute = false, this.sync = 'Real-time', this.lastSync,
  });
  final bool biometric, classUpdates, parentMessages, urgent, sound, quickMark, dnd, parentMute;
  final String dndFrom, dndTo, sync;
  final String? defaultClass, lastSync;

  static const syncOptions = ['Real-time', 'Every 15 minutes', 'Hourly', 'Manual only'];

  factory AppSettings.fromJson(Map<String, dynamic> j) => AppSettings(
        biometric: j['biometric'] != false, classUpdates: j['classUpdates'] != false, parentMessages: j['parentMessages'] != false,
        urgent: j['urgent'] != false, sound: j['sound'] != false, defaultClass: j['defaultClass'] as String?, quickMark: j['quickMark'] != false,
        dnd: j['dnd'] == true, dndFrom: j['dndFrom'] as String? ?? '18:00', dndTo: j['dndTo'] as String? ?? '07:30', parentMute: j['parentMute'] == true,
        sync: j['sync'] as String? ?? 'Real-time', lastSync: j['lastSync'] as String?,
      );
  Map<String, dynamic> toJson() => {
        'biometric': biometric, 'classUpdates': classUpdates, 'parentMessages': parentMessages, 'urgent': urgent, 'sound': sound,
        'defaultClass': ?defaultClass, 'quickMark': quickMark, 'dnd': dnd, 'dndFrom': dndFrom, 'dndTo': dndTo, 'parentMute': parentMute,
        'sync': sync, 'lastSync': ?lastSync,
      };
  AppSettings copyWith({
    bool? biometric, bool? classUpdates, bool? parentMessages, bool? sound, String? defaultClass, bool? quickMark, bool? dnd,
    String? dndFrom, String? dndTo, bool? parentMute, String? sync, String? lastSync,
  }) =>
      AppSettings(
        biometric: biometric ?? this.biometric, classUpdates: classUpdates ?? this.classUpdates, parentMessages: parentMessages ?? this.parentMessages,
        urgent: urgent, sound: sound ?? this.sound, defaultClass: defaultClass ?? this.defaultClass, quickMark: quickMark ?? this.quickMark,
        dnd: dnd ?? this.dnd, dndFrom: dndFrom ?? this.dndFrom, dndTo: dndTo ?? this.dndTo, parentMute: parentMute ?? this.parentMute,
        sync: sync ?? this.sync, lastSync: lastSync ?? this.lastSync,
      );

  @override
  List<Object?> get props => [biometric, classUpdates, parentMessages, urgent, sound, defaultClass, quickMark, dnd, dndFrom, dndTo, parentMute, sync, lastSync];
}

class Qualification extends Equatable {
  const Qualification({required this.title, required this.note, this.tone = 'neutral'});
  final String title, note, tone;
  factory Qualification.fromJson(Map<String, dynamic> j) => Qualification(title: j['title'] as String? ?? '', note: j['note'] as String? ?? '', tone: j['tone'] as String? ?? 'neutral');
  Map<String, dynamic> toJson() => {'title': title, 'note': note, 'tone': tone};
  @override
  List<Object?> get props => [title, note, tone];
}

/// Faculty details shown on Profile and the Digital Faculty ID (single document `hm_profile`).
class FacultyProfile extends Equatable {
  const FacultyProfile({
    this.department = '', this.bloodGroup = '', this.emergency = '', this.validThrough = '', this.token = '', this.cardNo = '', this.desk = '',
    this.attendancePct = 0, this.experience = 0, this.qualifications = const [],
  });
  final String department, bloodGroup, emergency, validThrough, token, cardNo, desk;
  final double attendancePct;
  final int experience;
  final List<Qualification> qualifications;

  factory FacultyProfile.fromJson(Map<String, dynamic> j) => FacultyProfile(
        department: j['department'] as String? ?? '', bloodGroup: j['bloodGroup'] as String? ?? '', emergency: j['emergency'] as String? ?? '',
        validThrough: j['validThrough'] as String? ?? '', token: j['token'] as String? ?? '', cardNo: j['cardNo'] as String? ?? '',
        desk: j['desk'] as String? ?? '', attendancePct: (j['attendancePct'] as num?)?.toDouble() ?? 0, experience: (j['experience'] as num?)?.toInt() ?? 0,
        qualifications: [for (final q in (j['qualifications'] as List? ?? const [])) Qualification.fromJson(Map<String, dynamic>.from(q as Map))],
      );
  Map<String, dynamic> toJson() => {
        'department': department, 'bloodGroup': bloodGroup, 'emergency': emergency, 'validThrough': validThrough, 'token': token, 'cardNo': cardNo,
        'desk': desk, 'attendancePct': attendancePct, 'experience': experience, 'qualifications': [for (final q in qualifications) q.toJson()],
      };
  FacultyProfile copyWith({String? desk, String? emergency}) => FacultyProfile.fromJson({...toJson(), 'desk': ?desk, 'emergency': ?emergency});

  @override
  List<Object?> get props => [department, bloodGroup, emergency, validThrough, token, cardNo, desk, attendancePct, experience, qualifications];
}
