import 'dart:convert';
import '../data_store.dart';

/// Per-collection adapters between the teacher app's local collections and the shared Firestore
/// collections defined in website/docs/DATA_CONTRACT.md. They are pure (no Firebase imports) so they
/// can be unit tested with fake data.

/// Remote documents by remote collection name (each doc includes its `id`).
typedef Remote = Map<String, List<Rec>>;

/// Who is signed in. [now] is injectable for tests.
class AdapterContext {
  const AdapterContext({required this.schoolId, required this.staffId, required this.authUid, this.clock});
  final String schoolId, staffId, authUid;
  final DateTime Function()? clock;
  DateTime get now => clock?.call() ?? DateTime.now();
}

/// One Firestore query under `schools/{schoolId}/{collection}`: equality filters plus an optional `whereIn`.
/// The pseudo field `__name__` means the document id.
class RemoteQuery {
  const RemoteQuery(this.collection, {this.eq = const {}, this.inField, this.inValues = const []});
  final String collection;
  final Map<String, Object?> eq;
  final String? inField;
  final List<String> inValues;

  String get key => '$collection|${(eq.entries.map((e) => '${e.key}=${e.value}').toList()..sort()).join('&')}|${inField ?? ''}|${inValues.join(',')}';
}

/// A write to one remote doc. Only the top-level [data] fields are replaced (nested maps are replaced as a whole).
class RemoteWrite {
  const RemoteWrite(this.collection, this.id, this.data, {this.delete = false});
  final String collection, id;
  final Rec data;
  final bool delete;
}

// ---------------------------------------------------------------------------
// Id / label helpers (contract §2)
// ---------------------------------------------------------------------------

/// Legacy local class id `c_10b` -> contract id `cls_10B`. Contract ids pass through unchanged.
String remoteClassId(String localId) {
  if (localId.startsWith('cls_')) return localId;
  final m = RegExp(r'^c_(\d+)([a-zA-Z])$').firstMatch(localId);
  return m == null ? localId : 'cls_${m.group(1)}${m.group(2)!.toUpperCase()}';
}

/// Remote class id -> local class id. Local ids are the contract ids (`cls_10B`).
String localClassId(String remoteId) => remoteId;

({String grade, String section}) gradeSectionOf(String classId) {
  final m = RegExp(r'^cls_(\d+)([A-Za-z]+)$').firstMatch(remoteClassId(classId));
  return (grade: m?.group(1) ?? '', section: m?.group(2) ?? '');
}

String classLabelOf(String classId) {
  final g = gradeSectionOf(classId);
  return g.grade.isEmpty ? classId : '${g.grade}-${g.section}';
}

const kDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/// `Mon` -> 1 .. `Sat` -> 6 (0 when unknown).
int dayNumber(Object? day) {
  final i = kDays.indexOf('$day');
  return i < 0 ? 0 : i + 1;
}

String dayName(int n) => n >= 1 && n <= 6 ? kDays[n - 1] : 'Mon';

/// Period 3 -> `P3`.
String slotOf(Object? period) => 'P${(period as num?)?.toInt() ?? int.tryParse('$period') ?? 1}';

/// `P3` -> 3.
int periodOf(Object? slot) => int.tryParse('$slot'.replaceAll(RegExp(r'[^0-9]'), '')) ?? 1;

String shortSubject(String subject) {
  const known = {'Mathematics': 'Math', 'Advanced Mathematics': 'Math', 'Science': 'Sci', 'Physics': 'Phy', 'Chemistry': 'Chem', 'Biology': 'Bio', 'English': 'Eng', 'Social Science': 'SST'};
  return known[subject] ?? (subject.length <= 4 ? subject : subject.substring(0, 4));
}

String firstName(String full) {
  final parts = full.split(' ').where((p) => p.isNotEmpty && !RegExp(r'^(Mr|Mrs|Ms|Dr|Prof|Sir)\.?$', caseSensitive: false).hasMatch(p)).toList();
  return parts.isEmpty ? full : parts.first;
}

String _isoDay(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

Rec _clean(Rec r) => jsonDecode(jsonEncode(r)) as Rec;

List<Rec> _docs(Remote r, String c) => r[c] ?? const [];

Rec? _byId(Remote r, String c, String id) {
  for (final d in _docs(r, c)) {
    if (d['id'] == id) return d;
  }
  return null;
}

/// Staff doc of the signed-in teacher.
Rec staffOf(AdapterContext ctx, Remote r) => _byId(r, 'staff', ctx.staffId) ?? {'id': ctx.staffId};

Rec stamp(AdapterContext ctx, Rec data) => {...data, 'teacherId': ctx.staffId, 'updatedAt': ctx.now.toIso8601String(), 'updatedBy': ctx.authUid};

/// Class ids the teacher teaches or is class teacher of (assignments, classes, own periods).
List<String> myClassIds(AdapterContext ctx, Remote r) {
  final ids = <String>{};
  for (final a in _docs(r, 'assignments')) {
    if (a['teacherId'] == ctx.staffId && a['classId'] != null) ids.add('${a['classId']}');
  }
  for (final c in _docs(r, 'classes')) {
    if (c['classTeacherId'] == ctx.staffId) ids.add('${c['id']}');
  }
  for (final p in _docs(r, 'ops_periods')) {
    if (p['teacherId'] == ctx.staffId && p['classId'] != null) ids.add('${p['classId']}');
  }
  return ids.toList()..sort();
}

/// Firestore `whereIn` takes at most 30 values: split into several queries.
List<RemoteQuery> inQueries(String collection, String field, Iterable<String> values) {
  final v = values.toSet().toList()..sort();
  return [for (var i = 0; i < v.length; i += 30) RemoteQuery(collection, inField: field, inValues: v.sublist(i, i + 30 > v.length ? v.length : i + 30))];
}

// ---------------------------------------------------------------------------
// Adapter base + private collections
// ---------------------------------------------------------------------------

abstract class StoreAdapter {
  const StoreAdapter(this.local);

  /// Local collection name (what repositories use).
  final String local;

  /// Remote collections [build] reads (when one changes the local collection is rebuilt).
  Set<String> get sources;

  /// What to listen to. May depend on already loaded data (e.g. students of the teacher's classes).
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote);

  /// The local rows.
  List<Rec> build(AdapterContext ctx, Remote remote);

  /// Remote writes for a full local [row] (create or update). Empty = nothing to write (read-only).
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) => const [];

  List<RemoteWrite> delete(AdapterContext ctx, Remote remote, Rec row) => const [];

  /// Id for a new row (null = let the store generate one).
  String? newId(AdapterContext ctx, Rec row) => null;

  bool get readOnly => false;
}

/// Teacher-private collection: stored under the school with a `teacherId` field (§5), under the same name or
/// [remoteName]. Remote names must carry a teacher-private prefix (`hm_`, `tk_`…) or the rules deny them.
class PrivateAdapter extends StoreAdapter {
  const PrivateAdapter(super.local, [this.remoteName]);
  final String? remoteName;
  String get _remote => remoteName ?? local;

  @override
  Set<String> get sources => {_remote};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [RemoteQuery(_remote, eq: {'teacherId': ctx.staffId})];

  /// Single-document collections (`settings`) use the collection name as the row id; remotely that id gets the
  /// teacher's staff id so every teacher has their own document.
  String _remoteId(AdapterContext ctx, String id) => id == local ? '${local}_${ctx.staffId}' : id;

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    final rows = [
      for (final d in _docs(remote, _remote))
        if (d['teacherId'] == ctx.staffId) {..._stripMeta(d), if (d['id'] == '${local}_${ctx.staffId}') 'id': local},
    ];
    return sortByOrd(rows);
  }

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) => [RemoteWrite(_remote, _remoteId(ctx, '${row['id']}'), stamp(ctx, _withoutId(row)))];

  @override
  List<RemoteWrite> delete(AdapterContext ctx, Remote remote, Rec row) => [RemoteWrite(_remote, _remoteId(ctx, '${row['id']}'), const {}, delete: true)];
}

Rec _withoutId(Rec r) => {...r}..remove('id');
Rec _stripMeta(Rec d) => {...d}
  ..remove('teacherId')
  ..remove('updatedBy');

/// Newest first: rows carry `ord` (microseconds, negative = appended). Rows without it keep their order.
List<Rec> sortByOrd(List<Rec> rows) {
  num o(Rec r) => (r['ord'] as num?) ?? 0;
  final idx = {for (var i = 0; i < rows.length; i++) rows[i]['id']: i};
  return [...rows]..sort((a, b) {
      final c = o(b).compareTo(o(a));
      return c != 0 ? c : (idx[a['id']] ?? 0).compareTo(idx[b['id']] ?? 0);
    });
}

/// Shared master data the teacher only reads (school, calendar...). Fields pass through.
class ReadOnlyAdapter extends StoreAdapter {
  const ReadOnlyAdapter(super.local, this.remoteName, {this.where = const {}});
  final String remoteName;
  final Map<String, Object?> where;

  @override
  bool get readOnly => true;
  @override
  Set<String> get sources => {remoteName};
  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [RemoteQuery(remoteName, eq: where)];
  @override
  List<Rec> build(AdapterContext ctx, Remote remote) => [..._docs(remote, remoteName)];
}

// ---------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------

/// `me`: the signed-in teacher = staff doc + school; profile edits (name/email/phone) are stored as a private overlay.
class MeAdapter extends StoreAdapter {
  const MeAdapter() : super('me');
  static const editable = ['name', 'email', 'phone'];

  @override
  Set<String> get sources => {'staff', 'school', 'me'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [
        const RemoteQuery('staff'),
        const RemoteQuery('school'),
        RemoteQuery('me', eq: {'teacherId': ctx.staffId}),
      ];

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    final staff = staffOf(ctx, remote);
    if (_byId(remote, 'staff', ctx.staffId) == null) return [];
    final school = _byId(remote, 'school', 'school') ?? const {};
    final over = _byId(remote, 'me', ctx.staffId) ?? const {};
    String s(String k, [String d = '']) => '${over[k] ?? staff[k] ?? d}';
    final name = s('name');
    final year = '${school['academicYear'] ?? ''}';
    return [
      {
        'id': 'me', 'staffId': ctx.staffId, 'name': name, 'short': firstName(name), 'title': '${staff['title'] ?? staff['designation'] ?? staff['role'] ?? ''}',
        'subjects': '${staff['subjects'] ?? staff['department'] ?? ''}', 'designation': '${staff['designation'] ?? staff['role'] ?? ''}', 'empId': '${staff['empId'] ?? ''}',
        'school': '${school['name'] ?? ''}', 'year': year.isEmpty ? '' : 'AY $year', 'term': '${school['term'] ?? ''}', 'email': s('email'), 'phone': s('phone'),
        'joined': '${staff['joined'] ?? ''}', 'online': true,
      }
    ];
  }

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) =>
      [RemoteWrite('me', ctx.staffId, stamp(ctx, {for (final k in editable) if (row[k] != null) k: row[k]}))];
}

/// `classes`: the classes the teacher teaches (assignments + class teacher + own periods), joined with her subject/topic.
class ClassesAdapter extends StoreAdapter {
  const ClassesAdapter() : super('classes');

  @override
  bool get readOnly => true;
  @override
  Set<String> get sources => {'classes', 'assignments', 'ops_periods', 'students'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) {
    final ids = myClassIds(ctx, remote);
    return [
      RemoteQuery('assignments', eq: {'teacherId': ctx.staffId}),
      RemoteQuery('ops_periods', eq: {'teacherId': ctx.staffId}),
      RemoteQuery('classes', eq: {'classTeacherId': ctx.staffId}),
      ...inQueries('classes', '__name__', ids),
    ];
  }

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    final ids = myClassIds(ctx, remote);
    final rows = <Rec>[];
    for (final id in ids) {
      final c = _byId(remote, 'classes', id);
      if (c == null) continue;
      final mine = [for (final a in _docs(remote, 'assignments')) if (a['teacherId'] == ctx.staffId && a['classId'] == id) a];
      final studs = [for (final s in _docs(remote, 'students')) if (s['classId'] == id) s];
      final att = studs.isEmpty ? 0.0 : studs.fold<double>(0, (t, s) => t + ((s['attendance'] as num?)?.toDouble() ?? 0)) / studs.length;
      rows.add({
        'id': localClassId(id), 'grade': '${c['grade']}', 'section': '${c['section']}', 'subject': mine.isEmpty ? '' : '${mine.first['subject']}',
        'topic': mine.isEmpty ? '' : '${mine.first['topic'] ?? ''}', 'room': '${c['room'] ?? ''}', 'wing': '${c['wing'] ?? ''}',
        'students': (c['studentCount'] as num?)?.toInt() ?? studs.length, 'classTeacher': c['classTeacherId'] == ctx.staffId, 'rep': '',
        'attendance': double.parse(att.toStringAsFixed(1)),
      });
    }
    rows.sort((a, b) => (b['classTeacher'] == true ? 1 : 0).compareTo(a['classTeacher'] == true ? 1 : 0));
    return rows;
  }
}

/// `students` of the teacher's classes. The contract keeps the letter grade in `perfGrade`.
class StudentsAdapter extends StoreAdapter {
  const StudentsAdapter() : super('students');

  @override
  bool get readOnly => true;
  @override
  Set<String> get sources => {'students'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => inQueries('students', 'classId', myClassIds(ctx, remote));

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    final rows = [
      for (final s in _docs(remote, 'students'))
        {
          'id': s['id'], 'name': s['name'], 'roll': s['roll'], 'classId': localClassId('${s['classId']}'), 'adm': s['grn'] ?? '', 'guardian': s['guardian'] ?? '',
          'phone': s['phone'] ?? '', 'attendance': (s['attendance'] as num?)?.toInt() ?? 0, 'grade': s['perfGrade'] ?? '',
        }
    ];
    rows.sort((a, b) {
      final c = '${a['classId']}'.compareTo('${b['classId']}');
      return c != 0 ? c : ((a['roll'] as num?) ?? 0).compareTo((b['roll'] as num?) ?? 0);
    });
    return rows;
  }
}

/// `tt_periods`: the teacher's own `ops_periods` (Mon..Sat -> 1..6, 3 -> `P3`), this week's substitution duties,
/// and her private extras (remedial / prep) stored in the private `tt_periods` collection.
class PeriodsAdapter extends StoreAdapter {
  const PeriodsAdapter() : super('tt_periods');

  @override
  Set<String> get sources => {'ops_periods', 'ops_substitutions', 'assignments', 'classes', 'tt_periods'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [
        RemoteQuery('ops_periods', eq: {'teacherId': ctx.staffId}),
        RemoteQuery('ops_substitutions', eq: {'substituteTeacherId': ctx.staffId}),
        RemoteQuery('tt_periods', eq: {'teacherId': ctx.staffId}),
      ];

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    String topicFor(String classId, String subject) {
      for (final a in _docs(remote, 'assignments')) {
        if (a['teacherId'] == ctx.staffId && a['classId'] == classId && a['subject'] == subject) return '${a['topic'] ?? ''}';
      }
      return '';
    }

    final rows = <Rec>[];
    for (final p in _docs(remote, 'ops_periods')) {
      if (p['teacherId'] != ctx.staffId) continue;
      final cid = '${p['classId']}';
      rows.add({
        'id': p['id'], 'day': dayNumber(p['day']), 'slot': slotOf(p['period']), 'kind': 'core', 'classId': localClassId(cid), 'label': classLabelOf(cid),
        'subject': '${p['subject']}', 'short': shortSubject('${p['subject']}'), 'room': '${p['room'] ?? ''}', 'topic': topicFor(cid, '${p['subject']}'),
      });
    }
    final now = ctx.now;
    final monday = DateTime(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1));
    final from = _isoDay(monday), to = _isoDay(monday.add(const Duration(days: 5)));
    for (final s in _docs(remote, 'ops_substitutions')) {
      final date = '${s['date']}';
      if (s['substituteTeacherId'] != ctx.staffId || s['status'] == 'Declined' || date.compareTo(from) < 0 || date.compareTo(to) > 0) continue;
      final cid = '${s['classId']}';
      final cls = _byId(remote, 'classes', cid);
      rows.add({
        'id': 'sp_${s['id']}', 'day': dayNumber(s['day']), 'slot': slotOf(s['period']), 'kind': 'sub', 'classId': localClassId(cid), 'label': classLabelOf(cid),
        'subject': '${s['subject']} (Sub)', 'short': 'Sub', 'room': '${cls?['room'] ?? ''}', 'topic': '${s['topic'] ?? ''}', 'subId': s['id'],
      });
    }
    // private extras never shadow a real period in the same slot
    final taken = {for (final r in rows) '${r['day']}_${r['slot']}'};
    for (final e in sortByOrd([for (final d in _docs(remote, 'tt_periods')) if (d['teacherId'] == ctx.staffId) _stripMeta(d)])) {
      if (!taken.contains('${e['day']}_${e['slot']}')) rows.add(e);
    }
    return rows;
  }

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) {
    final kind = row['kind'];
    if (kind != 'remedial' && kind != 'prep') return const [];
    return [RemoteWrite('tt_periods', '${row['id']}', stamp(ctx, _withoutId(row)))];
  }

  @override
  List<RemoteWrite> delete(AdapterContext ctx, Remote remote, Rec row) =>
      _byId(remote, 'tt_periods', '${row['id']}') == null ? const [] : [RemoteWrite('tt_periods', '${row['id']}', const {}, delete: true)];
}

/// `tt_subs`: substitution duties assigned to the teacher (`ops_substitutions`, status Assigned/Accepted/Declined)
/// plus a private overlay (`tt_subs`) for the checklist and attachments.
class SubstitutionsAdapter extends StoreAdapter {
  const SubstitutionsAdapter() : super('tt_subs');
  static const _toLocal = {'Assigned': 'pending', 'Accepted': 'accepted', 'Declined': 'declined'};
  static const _toRemote = {'pending': 'Assigned', 'accepted': 'Accepted', 'declined': 'Declined'};

  @override
  Set<String> get sources => {'ops_substitutions', 'staff', 'classes', 'tt_subs'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [
        RemoteQuery('ops_substitutions', eq: {'substituteTeacherId': ctx.staffId}),
        const RemoteQuery('staff'),
        RemoteQuery('classes', eq: {'classTeacherId': ctx.staffId}),
        ...inQueries('classes', '__name__', [for (final s in _docs(remote, 'ops_substitutions')) '${s['classId']}']),
        RemoteQuery('tt_subs', eq: {'teacherId': ctx.staffId}),
      ];

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    final rows = <Rec>[];
    for (final s in _docs(remote, 'ops_substitutions')) {
      if (s['substituteTeacherId'] != ctx.staffId) continue;
      final cid = '${s['classId']}';
      final cls = _byId(remote, 'classes', cid);
      final absent = _byId(remote, 'staff', '${s['absentTeacherId']}') ?? const {};
      final over = _byId(remote, 'tt_subs', '${s['id']}') ?? const {};
      rows.add({
        'id': s['id'], 'day': dayNumber(s['day']), 'slot': slotOf(s['period']), 'status': _toLocal['${s['status']}'] ?? 'pending',
        'classLabel': '${classLabelOf(cid)} ${s['subject']}', 'subject': '${s['subject']}', 'classId': localClassId(cid), 'faculty': '${absent['name'] ?? ''}',
        'dept': '${absent['department'] ?? ''}', 'role': '${absent['role'] ?? ''}', 'room': '${cls?['room'] ?? ''}', 'posted': '${s['date']}',
        'tag': 'Substitution', 'chapter': '${s['topic'] ?? ''}', 'objective': '${s['topic'] ?? ''}', 'directive': '${s['note'] ?? ''}', 'date': s['date'],
        'tasks': over['tasks'] ?? const <Rec>[], 'files': over['files'] ?? const <Rec>[], 'contacts': over['contacts'] ?? const <Rec>[],
      });
    }
    rows.sort((a, b) => '${a['date']}'.compareTo('${b['date']}'));
    return rows;
  }

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) {
    final id = '${row['id']}';
    return [
      // status lives on the shared substitution record (the admin sees accept/decline)
      RemoteWrite('ops_substitutions', id, {'status': _toRemote['${row['status']}'] ?? 'Assigned', 'updatedAt': ctx.now.toIso8601String(), 'updatedBy': ctx.authUid}),
      RemoteWrite('tt_subs', id, stamp(ctx, {'tasks': row['tasks'] ?? const [], 'files': row['files'] ?? const [], 'contacts': row['contacts'] ?? const []})),
    ];
  }
}

// ---------------------------------------------------------------------------
// Shared records both sides write (contract §4)
// ---------------------------------------------------------------------------

/// `att_records` <-> `ops_attendance`: id `{date}_{classId}_{period}`; `marks` lists only non-present students.
class AttendanceAdapter extends StoreAdapter {
  const AttendanceAdapter() : super('att_records');

  @override
  Set<String> get sources => {'ops_attendance'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [RemoteQuery('ops_attendance', eq: {'teacherId': ctx.staffId})];

  @override
  String? newId(AdapterContext ctx, Rec row) => idFor(row);

  static String idFor(Rec row) => '${row['date']}_${remoteClassId('${row['classId']}')}_${row['period']}';

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    final rows = [
      for (final d in _docs(remote, 'ops_attendance'))
        if (d['teacherId'] == ctx.staffId)
          {
            'id': d['id'], 'classId': localClassId('${d['classId']}'), 'date': d['date'], 'period': (d['period'] as num?)?.toInt() ?? 1, 'total': (d['total'] as num?)?.toInt() ?? 0,
            'marks': Map<String, dynamic>.from(d['marks'] as Map? ?? const {}), 'submitted': d['submitted'] == true, 'updatedAt': d['updatedAt'],
          }
    ];
    rows.sort((a, b) {
      final c = '${b['date']}'.compareTo('${a['date']}');
      return c != 0 ? c : ((a['period'] as num?) ?? 0).compareTo((b['period'] as num?) ?? 0);
    });
    return rows;
  }

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) {
    final cid = remoteClassId('${row['classId']}');
    final g = gradeSectionOf(cid);
    return [
      RemoteWrite('ops_attendance', idFor(row), stamp(ctx, {
        'date': row['date'], 'classId': cid, 'grade': g.grade, 'section': g.section, 'period': row['period'], 'total': row['total'],
        'marks': row['marks'] ?? const {}, 'submitted': row['submitted'] == true,
      })),
    ];
  }
}

/// `tk_homework` <-> `ops_homework`: teacher shape plus the denormalized admin fields (teacher, grade, section, assigned, submitted, total).
class HomeworkAdapter extends StoreAdapter {
  const HomeworkAdapter() : super('tk_homework');
  static const denormalized = ['teacherId', 'teacher', 'grade', 'section', 'assigned', 'submitted', 'total'];

  @override
  Set<String> get sources => {'ops_homework', 'staff', 'students'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [
        RemoteQuery('ops_homework', eq: {'teacherId': ctx.staffId}),
        RemoteQuery('staff', eq: {'__name__': ctx.staffId}),
      ];

  /// Admin web statuses ("Published", "Completed", "Draft") in the teacher app's words.
  static String localStatus(Object? s) => switch ('${s ?? ''}'.toLowerCase()) { 'published' || '' => 'open', 'completed' => 'closed', final v => v };

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    final rows = <Rec>[];
    for (final d in _docs(remote, 'ops_homework')) {
      if (d['teacherId'] != ctx.staffId || d['classId'] == null) continue;
      final cid = '${d['classId']}';
      final subs = Map<String, dynamic>.from(d['submissions'] as Map? ?? const {});
      // homework created in the admin web has no per-student entries yet: every student of the class starts pending
      if (subs.isEmpty) {
        for (final st in _docs(remote, 'students')) {
          if (st['classId'] == cid) subs['${st['id']}'] = {'status': 'pending', 'feedback': ''};
        }
      }
      rows.add({
        ...({...d}..removeWhere((k, _) => denormalized.contains(k))), 'classId': localClassId(cid), 'submissions': subs,
        'status': localStatus(d['status']), 'createdAt': d['createdAt'] ?? '${d['assigned'] ?? ''}T08:00:00', 'maxMarks': d['maxMarks'] ?? 20,
      });
    }
    return sortByOrd(rows..sort((a, b) => '${b['createdAt']}'.compareTo('${a['createdAt']}')));
  }

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) {
    final cid = remoteClassId('${row['classId']}');
    final g = gradeSectionOf(cid);
    final subs = Map<String, dynamic>.from(row['submissions'] as Map? ?? const {});
    final submitted = subs.values.where((s) => s is Map && (s['status'] == 'submitted' || s['status'] == 'graded')).length;
    final created = '${row['createdAt'] ?? ''}';
    return [
      RemoteWrite('ops_homework', '${row['id']}', stamp(ctx, {
        ..._withoutId(row), 'classId': cid, 'teacher': '${staffOf(ctx, remote)['name'] ?? ''}', 'grade': g.grade, 'section': g.section,
        'assigned': created.length >= 10 ? created.substring(0, 10) : _isoDay(ctx.now), 'submitted': submitted, 'total': subs.length,
      })),
    ];
  }

  @override
  List<RemoteWrite> delete(AdapterContext ctx, Remote remote, Rec row) => [RemoteWrite('ops_homework', '${row['id']}', const {}, delete: true)];
}

/// `att_marks` <-> `exm_marks`: id `{paperId}__cand_{studentId}`, theory = marks. Status/tag/note ride along.
/// Does an admin exam paper's subject cover a subject the teacher is assigned? ("Science" covers "Physics").
bool subjectCovers(String paper, String assigned) {
  final p = paper.toLowerCase(), a = assigned.toLowerCase();
  if (p.isEmpty || a.isEmpty) return false;
  if (p == a || p.contains(a) || a.contains(p)) return true;
  // the natural sciences only: "Social Science" and "Computer Science" are other subjects
  bool sci(String x) => const {'physics', 'chemistry', 'biology'}.any(x.contains) || (x.contains('science') && !x.contains('social') && !x.contains('computer'));
  return sci(p) && sci(a);
}

/// `att_exams` <- the admin's `exm_papers` (+ `exm_cycles` for the name): one exam per paper and class the teacher
/// teaches that subject in. Local id `{paperId}@{classId}`. A paper without `classIds` covers every class of its grade.
/// Submitting is the teacher's own state, kept in the private `att_exam_state` overlay (teachers cannot edit papers).
class ExamsAdapter extends StoreAdapter {
  const ExamsAdapter() : super('att_exams');

  static String localId(String paperId, String classId) => '$paperId@$classId';
  static ({String paperId, String? classId}) parse(String localId) {
    final i = localId.indexOf('@');
    return i < 0 ? (paperId: localId, classId: null) : (paperId: localId.substring(0, i), classId: localId.substring(i + 1));
  }

  @override
  Set<String> get sources => {'exm_papers', 'exm_cycles', 'assignments', 'classes', 'att_exam_state'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [
        const RemoteQuery('exm_papers'),
        const RemoteQuery('exm_cycles'),
        RemoteQuery('assignments', eq: {'teacherId': ctx.staffId}),
        RemoteQuery('att_exam_state', eq: {'teacherId': ctx.staffId}),
      ];

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    final mine = [for (final a in _docs(remote, 'assignments')) if (a['teacherId'] == ctx.staffId) a];
    final rows = <Rec>[];
    for (final p in _docs(remote, 'exm_papers')) {
      final listed = [for (final c in p['classIds'] as List? ?? const []) '$c'];
      final cycle = _byId(remote, 'exm_cycles', '${p['cycleId'] ?? ''}');
      for (final a in mine) {
        final classId = '${a['classId']}';
        final inPaper = listed.isNotEmpty ? listed.contains(classId) : gradeSectionOf(classId).grade == '${p['grade']}';
        if (!inPaper || !subjectCovers('${p['subject'] ?? ''}', '${a['subject'] ?? ''}')) continue;
        final id = localId('${p['id']}', classId);
        final st = _byId(remote, 'att_exam_state', id);
        // the admin locked the marks window, or published this class's results (published lists class labels like "10-B")
        final published = [for (final c in p['published'] as List? ?? const []) '$c'];
        final locked = p['locked'] == true || cycle?['locked'] == true || published.contains(classId) || published.contains(classLabelOf(classId));
        rows.add({
          'id': id, 'classId': localClassId(classId), 'name': '${cycle?['short'] ?? cycle?['title'] ?? 'Exam'}',
          'subject': '${p['subject'] ?? a['subject']}', 'max': (p['theory'] as num?)?.toInt() ?? 100,
          'status': locked ? 'Locked' : '${st?['status'] ?? 'Draft'}', 'submittedAt': st?['submittedAt'], 'sections': const <Rec>[],
          'date': p['date'], 'paperId': p['id'],
        });
      }
    }
    rows.sort((a, b) => '${b['date'] ?? ''}'.compareTo('${a['date'] ?? ''}'));
    return rows;
  }

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) => [
        RemoteWrite('att_exam_state', '${row['id']}', stamp(ctx, {'status': row['status'], 'submittedAt': row['submittedAt'], 'teacherId': ctx.staffId})),
      ];
}

/// `att_marks` <-> `exm_marks` (admin shape + studentId/teacherId/classId). Local exam ids are `{paperId}@{classId}`.
class MarksAdapter extends StoreAdapter {
  const MarksAdapter() : super('att_marks');

  static String remoteId(String paperId, String studentId) => '${paperId}__cand_$studentId';

  @override
  Set<String> get sources => {'exm_marks', 'students'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [RemoteQuery('exm_marks', eq: {'teacherId': ctx.staffId})];

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) => [
        for (final d in _docs(remote, 'exm_marks'))
          if (d['teacherId'] == ctx.staffId) _local(d, '${d['classId'] ?? _byId(remote, 'students', '${d['studentId']}')?['classId'] ?? ''}'),
      ];

  Rec _local(Rec d, String classId) {
    final examId = classId.isEmpty ? '${d['paperId']}' : ExamsAdapter.localId('${d['paperId']}', classId);
    return {
      'id': '${examId}_${d['studentId']}', 'examId': examId, 'studentId': d['studentId'], 'status': d['status'] ?? (d['theory'] == null ? 'Absent' : 'Present'),
      'marks': d['theory'], 'tag': d['tag'] ?? '', 'note': d['note'] ?? '',
    };
  }

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) {
    final ex = ExamsAdapter.parse('${row['examId']}'), st = '${row['studentId']}';
    return [
      RemoteWrite('exm_marks', remoteId(ex.paperId, st), {
        // internal marks, medical flag and verification belong to the admin's exam cell: never sent, so never overwritten
        'paperId': ex.paperId, 'candId': 'cand_$st', 'studentId': st, 'classId': ?ex.classId, 'theory': row['marks'],
        'status': row['status'], 'tag': row['tag'] ?? '', 'note': row['note'] ?? '', 'teacherId': ctx.staffId,
        'enteredAt': ctx.now.toIso8601String(), 'updatedBy': ctx.authUid,
      }),
    ];
  }
}

/// `lm_my` (Leave Management) and `att_leaves` (Apply Leave) <-> the one shared `staff_leaves` collection, so a request
/// made from either screen reaches the admin and both screens list every leave. `staff_leaves` uses `from`/`to`;
/// `att_leaves` rows use `start`/`end`. The admin web adds the mirrored `approvals` row (contract §9); writing it here
/// too would duplicate it, and rules forbid teachers updating approvals once it exists.
class StaffLeavesAdapter extends StoreAdapter {
  const StaffLeavesAdapter([super.local = 'lm_my']);
  bool get _att => local == 'att_leaves';

  @override
  Set<String> get sources => {'staff_leaves'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [
        RemoteQuery('staff_leaves', eq: {'staffId': ctx.staffId}),
        RemoteQuery('staff', eq: {'__name__': ctx.staffId}),
      ];

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) => sortByOrd([
        for (final d in _docs(remote, 'staff_leaves'))
          if (d['staffId'] == ctx.staffId)
            {
              ...({...d}..remove('updatedBy')..remove('teacherId')..remove('staffId')),
              'from': d['from'] ?? d['start'], 'to': d['to'] ?? d['end'],
              if (_att) ...{'start': d['start'] ?? d['from'], 'end': d['end'] ?? d['to'], 'by': d['by'] ?? (d['status'] == 'Pending' ? '' : 'School Admin'), 'handovers': d['handovers'] ?? const []},
              if (!_att) 'sanctionedBy': d['sanctionedBy'] ?? (d['status'] == 'Approved' ? 'School Admin' : ''),
            }
      ]);

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) => [
        RemoteWrite('staff_leaves', '${row['id']}', stamp(ctx, {
          ..._withoutId(row),
          'from': row['from'] ?? row['start'], 'to': row['to'] ?? row['end'], 'staffId': ctx.staffId,
          'createdAt': row['createdAt'] ?? row['at'] ?? ctx.now.toIso8601String(),
        })),
      ];
}

/// Short circular reference for an admin notice: `CIR-{year}-{last 4 of the id}` (ids are random, not serials).
String circularRef(String id, String sentAt) {
  final tail = id.replaceAll(RegExp('[^A-Za-z0-9]'), '');
  final year = sentAt.length >= 4 ? sentAt.substring(0, 4) : '${DateTime.now().year}';
  return 'CIR-$year-${tail.substring(tail.length < 4 ? 0 : tail.length - 4).toUpperCase()}';
}

/// Built-in yearly leave entitlement, used while the admin's `set_leave_policy/policy` doc is missing (§12.2).
const kLeavePolicy = [
  (id: 'CL', name: 'Casual (CL)', type: 'Casual Leave', total: 12),
  (id: 'ML', name: 'Medical (ML)', type: 'Medical Leave', total: 10),
  (id: 'DL', name: 'Duty Leave (DL)', type: 'Duty Leave', total: 6),
  (id: 'SDL', name: 'Special Duty (SDL)', type: 'Special Duty Leave', total: 5),
  (id: 'AW', name: 'Academic Workshop (AW)', type: 'Academic Workshop', total: 6),
];

/// Default school start time: a check-in after it is Late (§12.1).
const kCheckInBy = '08:15';

const policyQuery = RemoteQuery('set_leave_policy', eq: {'__name__': 'policy'});

/// Leave types of the admin's policy doc, or [kLeavePolicy] when it is missing / has no types.
List<({String id, String name, String type, int total})> leavePolicy(Remote remote) {
  final types = _byId(remote, 'set_leave_policy', 'policy')?['types'];
  if (types is! List || types.isEmpty) return kLeavePolicy;
  return [
    for (final t in types.whereType<Map>())
      (
        id: '${t['id'] ?? ''}', name: '${t['name'] ?? t['id'] ?? ''}', type: '${t['type'] ?? t['name'] ?? ''}',
        total: (t['total'] as num?)?.toInt() ?? int.tryParse('${t['total']}') ?? 0,
      ),
  ];
}

String checkInBy(Remote remote) {
  final v = '${_byId(remote, 'set_leave_policy', 'policy')?['checkInBy'] ?? ''}';
  return RegExp(r'^\d{1,2}:\d{2}$').hasMatch(v) ? v : kCheckInBy;
}

int _mins(String hhmm) {
  final p = hhmm.split(':');
  return (int.tryParse(p.first) ?? 0) * 60 + (p.length > 1 ? int.tryParse(p[1]) ?? 0 : 0);
}

String _hhmm(int mins) => '${(mins ~/ 60 % 24).toString().padLeft(2, '0')}:${(mins % 60).toString().padLeft(2, '0')}';

/// Days of approved leave of [type] in `staff_leaves`.
double usedLeave(AdapterContext ctx, Remote remote, String type) => _docs(remote, 'staff_leaves')
    .where((d) => d['staffId'] == ctx.staffId && d['type'] == type && (d['status'] == 'Approved' || d['status'] == 'Completed'))
    .fold<double>(0, (t, d) => t + ((d['days'] as num?)?.toDouble() ?? 0));

/// `att_quota` (Apply Leave "Available quota"): entitlement from the leave policy, used = approved `staff_leaves`.
class LeaveQuotaAdapter extends StoreAdapter {
  const LeaveQuotaAdapter() : super('att_quota');
  @override
  bool get readOnly => true;
  @override
  Set<String> get sources => {'staff_leaves', 'set_leave_policy'};
  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [RemoteQuery('staff_leaves', eq: {'staffId': ctx.staffId}), policyQuery];
  @override
  List<Rec> build(AdapterContext ctx, Remote remote) => [
        for (final p in leavePolicy(remote).take(3)) {'id': p.id, 'name': p.name, 'short': p.type, 'total': p.total, 'used': usedLeave(ctx, remote, p.type).ceil()},
      ];
}

/// `lm_balance` (Leave Management entitlements; that screen subtracts the used days itself).
class LeaveBalanceAdapter extends StoreAdapter {
  const LeaveBalanceAdapter() : super('lm_balance');
  @override
  bool get readOnly => true;
  @override
  Set<String> get sources => {'set_leave_policy'};
  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => const [policyQuery];
  @override
  List<Rec> build(AdapterContext ctx, Remote remote) => [
        for (final p in leavePolicy(remote)) if (p.id != 'DL') {'id': 'lb_${p.id}', 'type': p.type, 'total': p.total},
      ];
}

/// `att_staff` <-> `staff_attendance/{date}_{staffId}` (§12.1): one doc per day, whatever local id the punch-in used.
/// The first write of a day (punch in) sends in/status (Late after the policy's `checkInBy`); later writes (punch out)
/// send `out`, and `in`/`status` only when the check-in time itself changed, so an admin correction is kept.
class StaffAttendanceAdapter extends StoreAdapter {
  const StaffAttendanceAdapter() : super('att_staff');

  static String remoteId(String date, String staffId) => '${date}_$staffId';

  @override
  Set<String> get sources => {'staff_attendance', 'set_leave_policy'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [RemoteQuery('staff_attendance', eq: {'staffId': ctx.staffId}), policyQuery];

  @override
  String? newId(AdapterContext ctx, Rec row) => remoteId('${row['date']}', ctx.staffId);

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) => [
        for (final d in _docs(remote, 'staff_attendance'))
          if (d['staffId'] == ctx.staffId)
            {'id': d['id'], 'date': d['date'], 'in': d['in'], 'out': d['out'], 'status': d['status'] ?? 'Present', 'note': d['note'] ?? '', 'source': d['source'] ?? 'app'},
      ]..sort((a, b) => '${b['date']}'.compareTo('${a['date']}'));

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) {
    final date = '${row['date'] ?? _isoDay(ctx.now)}';
    final id = remoteId(date, ctx.staffId);
    final cur = _byId(remote, 'staff_attendance', id);
    final inT = row['in'] as String?;
    var status = '${row['status'] ?? 'Present'}';
    if (inT != null && (status == 'Present' || status == 'Late')) status = _mins(inT) > _mins(checkInBy(remote)) ? 'Late' : 'Present';
    final data = cur == null
        ? {'staffId': ctx.staffId, 'date': date, 'in': inT, 'out': row['out'], 'status': status, 'note': row['note'] ?? '', 'source': 'app'}
        : {'out': row['out'], if (inT != cur['in']) ...{'in': inT, 'status': status}};
    return [RemoteWrite('staff_attendance', id, stamp(ctx, data))];
  }
}

/// `att_regs` <-> `staff_regularizations` (§12.1). The teacher creates Pending requests and may edit them only while
/// Pending; the admin's decision (status, decisionNote, decidedAt) is read back.
class RegularizationsAdapter extends StoreAdapter {
  const RegularizationsAdapter() : super('att_regs');

  @override
  Set<String> get sources => {'staff_regularizations'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [RemoteQuery('staff_regularizations', eq: {'staffId': ctx.staffId})];

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) => [
        for (final d in _docs(remote, 'staff_regularizations'))
          if (d['staffId'] == ctx.staffId)
            {
              'id': d['id'], 'date': d['date'] ?? '', 'type': d['type'] ?? '', 'time': d['time'] ?? '', 'reason': d['reason'] ?? '', 'note': d['note'] ?? '',
              'status': d['status'] ?? 'Pending', 'at': d['at'] ?? '', 'decisionNote': d['decisionNote'] ?? '', 'decidedAt': d['decidedAt'],
            },
      ]..sort((a, b) => '${b['at']}'.compareTo('${a['at']}'));

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) {
    final cur = _byId(remote, 'staff_regularizations', '${row['id']}');
    if (cur != null && (cur['status'] ?? 'Pending') != 'Pending') return const [];
    return [
      RemoteWrite('staff_regularizations', '${row['id']}', stamp(ctx, {
        'staffId': ctx.staffId, 'date': row['date'], 'type': row['type'], 'time': row['time'], 'reason': row['reason'] ?? '', 'note': row['note'] ?? '',
        'status': 'Pending', 'at': row['at'] ?? ctx.now.toIso8601String(),
      })),
    ];
  }
}

/// `lm_student` and `att_slips` <-> `student_leaves` of the teacher's classes (parents write, the teacher decides).
class StudentLeavesAdapter extends StoreAdapter {
  const StudentLeavesAdapter(super.local, {required this.src});

  /// Which teacher-app view wrote the doc (`lm` or `slip`). Docs without it (parent app) show in both.
  final String src;
  bool get _lm => src == 'lm';

  @override
  Set<String> get sources => {'student_leaves', 'students'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => inQueries('student_leaves', 'classId', myClassIds(ctx, remote));

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    final rows = <Rec>[];
    for (final d in _docs(remote, 'student_leaves')) {
      if (d['src'] != null && d['src'] != src) continue;
      final stu = _byId(remote, 'students', '${d['studentId']}');
      final status = '${d['status'] ?? 'Pending'}';
      final base = {...d}..remove('src')..remove('updatedBy');
      rows.add({
        ...base, 'classId': localClassId('${d['classId']}'), 'name': d['name'] ?? stu?['name'] ?? '', 'roll': d['roll'] ?? stu?['roll'] ?? 0,
        'status': _lm ? status.toLowerCase() : status, 'note': _lm ? (d['decisionNote'] ?? d['note'] ?? '') : d['note'],
      });
    }
    return sortByOrd(rows);
  }

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) {
    final status = '${row['status']}';
    final cap = status.isEmpty ? 'Pending' : status[0].toUpperCase() + status.substring(1);
    final data = {..._withoutId(row), 'classId': remoteClassId('${row['classId']}'), 'status': cap, 'src': src, 'decisionNote': row['note'] ?? row['decisionNote'] ?? ''};
    return [RemoteWrite('student_leaves', '${row['id']}', {...data, 'teacherId': ctx.staffId, 'updatedAt': ctx.now.toIso8601String(), 'updatedBy': ctx.authUid})];
  }
}

/// `lv_sessions` <-> `live_classes` (§6). `joined` is the number of `joins/{uid}` docs.
class LiveClassesAdapter extends StoreAdapter {
  const LiveClassesAdapter() : super('lv_sessions');

  /// Pseudo collection the store fills with `{id: sessionId, count: n}` from the `joins` subcollections.
  static const joinsSource = 'live_class_joins';

  @override
  Set<String> get sources => {'live_classes', joinsSource, 'classes'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [RemoteQuery('live_classes', eq: {'teacherId': ctx.staffId})];

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    final rows = <Rec>[];
    for (final d in _docs(remote, 'live_classes')) {
      if (d['teacherId'] != ctx.staffId) continue;
      final count = (_byId(remote, joinsSource, '${d['id']}')?['count'] as num?)?.toInt() ?? 0;
      final cid = '${d['classId']}';
      rows.add({
        ...({...d}..remove('teacherId')..remove('updatedBy')), 'classId': localClassId(cid), 'audience': d['audience'] ?? 'Class ${classLabelOf(cid)}',
        'joined': count > ((d['joined'] as num?)?.toInt() ?? 0) ? count : (d['joined'] as num?)?.toInt() ?? 0, 'status': d['status'] ?? 'upcoming',
      });
    }
    return sortByOrd(rows);
  }

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) => [
        RemoteWrite('live_classes', '${row['id']}', stamp(ctx, {
          ..._withoutId(row)..remove('joined'), 'classId': remoteClassId('${row['classId']}'), 'createdAt': row['createdAt'] ?? ctx.now.toIso8601String(),
        })),
      ];

  @override
  List<RemoteWrite> delete(AdapterContext ctx, Remote remote, Rec row) => [RemoteWrite('live_classes', '${row['id']}', const {}, delete: true)];
}

/// `att_circulars`: published notices for staff (`com_notices`) plus the teacher's private read/ack/pin state.
class CircularsAdapter extends StoreAdapter {
  const CircularsAdapter() : super('att_circulars');
  static final _staffAudience = RegExp(r'staff|teacher|faculty|all school', caseSensitive: false);
  static const stateFields = ['read', 'ack', 'pinned', 'ackAt'];

  static String categoryOf(String c) {
    final l = c.toLowerCase();
    if (l.contains('event')) return 'Events';
    if (l.contains('academic')) return 'Academic';
    if (l.contains('staff') || l.contains('holiday') || l.contains('fee') || l.contains('campus') || l.contains('transport')) return 'Admin';
    return 'General';
  }

  @override
  Set<String> get sources => {'com_notices', 'att_circulars'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [
        const RemoteQuery('com_notices', eq: {'status': 'Published'}),
        RemoteQuery('att_circulars', eq: {'teacherId': ctx.staffId}),
      ];

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    final rows = <Rec>[];
    for (final n in _docs(remote, 'com_notices')) {
      if (n['status'] != 'Published' || !_staffAudience.hasMatch('${n['audience'] ?? ''}')) continue;
      final st = _byId(remote, 'att_circulars', '${n['id']}') ?? const {};
      final category = '${n['category'] ?? ''}';
      final sent = '${n['sentAt'] ?? ''}';
      final att = n['attachment'];
      rows.add({
        'id': n['id'], 'ref': circularRef('${n['id']}', '${n['sentAt'] ?? ''}'), 'cat': categoryOf(category), 'title': '${n['title']}', 'summary': '${n['body'] ?? ''}',
        'author': '${n['author'] ?? ''}', 'office': category, 'date': sent.length >= 10 ? sent.substring(0, 10) : sent, 'read': st['read'] == true, 'ack': st['ack'] == true,
        'pinned': st['pinned'] ?? n['pinned'] == true, 'audience': '${n['audience'] ?? ''}', 'points': const <String>[],
        'attachment': att == null || '$att'.isEmpty ? null : {'name': '$att', 'size': '${n['attachmentSize'] ?? ''}'}, 'ackAt': st['ackAt'],
      });
    }
    rows.sort((a, b) {
      final p = (b['pinned'] == true ? 1 : 0).compareTo(a['pinned'] == true ? 1 : 0);
      return p != 0 ? p : '${b['date']}'.compareTo('${a['date']}');
    });
    return rows;
  }

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) =>
      [RemoteWrite('att_circulars', '${row['id']}', stamp(ctx, {for (final k in stateFields) if (row[k] != null) k: row[k]}))];
}

// ---------------------------------------------------------------------------
// Exam duties (§12.3)
// ---------------------------------------------------------------------------

/// One of the teacher's invigilation duties: an `exm_duties` row, or a paper she is the `invigilatorId` of without a row.
typedef _Duty = ({String id, Rec duty, Rec paper});

/// Class labels ("10-B") a paper covers: its `classIds`, else empty (= every class of its grade).
List<String> _paperLabels(Rec paper) => [for (final c in paper['classIds'] as List? ?? const []) classLabelOf('$c')];

List<_Duty> _myDuties(AdapterContext ctx, Remote remote) {
  final out = <_Duty>[];
  final withRow = <String>{};
  for (final d in _docs(remote, 'exm_duties')) {
    if (d['staffId'] != ctx.staffId || d['deleted'] == true) continue;
    withRow.add('${d['paperId']}');
    out.add((id: '${d['id']}', duty: d, paper: _byId(remote, 'exm_papers', '${d['paperId']}') ?? const {}));
  }
  for (final p in _docs(remote, 'exm_papers')) {
    if (p['invigilatorId'] == ctx.staffId && !withRow.contains('${p['id']}')) {
      out.add((id: 'chief_${p['id']}', duty: {'paperId': p['id'], 'role': 'Chief Invigilator', 'hall': p['venue'] ?? ''}, paper: p));
    }
  }
  return out;
}

List<RemoteQuery> _dutyQueries(AdapterContext ctx, Remote remote) => [
      RemoteQuery('exm_duties', eq: {'staffId': ctx.staffId}),
      const RemoteQuery('exm_papers'),
      // the other duty holders of the same papers (partner)
      ...inQueries('exm_duties', 'paperId', [for (final d in _myDuties(ctx, remote)) '${d.duty['paperId']}']),
    ];

/// Candidates of a paper: `exm_candidates` of its classes in class + roll order.
List<Rec> _paperCandidates(Remote remote, Rec paper) {
  final labels = _paperLabels(paper);
  String label(Rec c) => '${c['cls'] ?? '${c['grade']}-${c['section']}'}';
  final rows = [
    for (final c in _docs(remote, 'exm_candidates'))
      if (labels.isNotEmpty ? labels.contains(label(c)) : '${c['grade']}' == '${paper['grade']}') c,
  ];
  return rows..sort((a, b) {
      final c = label(a).compareTo(label(b));
      return c != 0 ? c : _rollOf(a['roll']).compareTo(_rollOf(b['roll']));
    });
}

/// Roll as an int: `12`, `"12"` or the admin fixture's `"#10B-12"`.
int _rollOf(Object? roll) => roll is num ? roll.toInt() : int.tryParse(RegExp(r'(\d+)\D*$').firstMatch('$roll')?.group(1) ?? '') ?? 0;

List<RemoteQuery> _candidateQueries(Remote remote, Iterable<Rec> papers) {
  final labels = <String>{}, grades = <String>{};
  for (final p in papers) {
    final l = _paperLabels(p);
    if (l.isNotEmpty) {
      labels.addAll(l);
    } else if (p['grade'] != null) {
      grades.add('${p['grade']}');
    }
  }
  return [...inQueries('exm_candidates', 'cls', labels), ...inQueries('exm_candidates', 'grade', grades)];
}

/// Private overlay ids carry the staff id: the duty / candidate ids are shared by the teachers of a hall.
String _overlayId(AdapterContext ctx, String id) => '${id}_${ctx.staffId}';

/// `ed_duties` <- the teacher's `exm_duties` (+ papers she is chief invigilator of), with the paper, partner and her
/// private working state (`ed_duty_state`: swap request, checklist, submitted).
class ExamDutiesAdapter extends StoreAdapter {
  const ExamDutiesAdapter() : super('ed_duties');
  static const stateFields = ['swap', 'swapWith', 'swapReason', 'checked', 'submitted'];

  @override
  Set<String> get sources => {'exm_duties', 'exm_papers', 'exm_cycles', 'exm_candidates', 'staff', 'ed_duty_state'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [
        ..._dutyQueries(ctx, remote),
        const RemoteQuery('exm_cycles'),
        const RemoteQuery('staff'),
        ..._candidateQueries(remote, [for (final d in _myDuties(ctx, remote)) d.paper]),
        RemoteQuery('ed_duty_state', eq: {'teacherId': ctx.staffId}),
      ];

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    final today = _isoDay(ctx.now);
    final rows = <Rec>[];
    for (final m in _myDuties(ctx, remote)) {
      final d = m.duty, p = m.paper;
      String f(String k, [String dflt = '']) => '${d[k] ?? p[k] ?? dflt}';
      final paperId = '${d['paperId']}', hall = f('hall', '${p['venue'] ?? ''}'), role = '${d['role'] ?? 'Invigilator'}';
      final labels = _paperLabels(p);
      final grade = f('grade');
      final cls = labels.isNotEmpty ? 'Class ${labels.join(', ')}' : grade.isEmpty ? '' : 'Class $grade';
      final cycle = _byId(remote, 'exm_cycles', f('cycleId'));
      final start = f('start', '09:00');
      final dur = ((p['duration'] as num?)?.toDouble() ?? 3) * 60;
      // partner: another duty holder of the same paper and hall (chief first)
      final others = [
        for (final o in _docs(remote, 'exm_duties'))
          if (o['paperId'] == paperId && o['staffId'] != ctx.staffId && o['deleted'] != true && '${o['hall'] ?? ''}' == hall) o,
      ]..sort((a, b) => (b['role'] == 'Chief Invigilator' ? 1 : 0).compareTo(a['role'] == 'Chief Invigilator' ? 1 : 0));
      final partner = others.isEmpty ? null : others.first;
      final pStaff = partner == null ? const <String, dynamic>{} : _byId(remote, 'staff', '${partner['staffId']}') ?? const {};
      final st = _byId(remote, 'ed_duty_state', _overlayId(ctx, m.id)) ?? const {};
      final date = f('date');
      final candidates = (d['candidates'] as num?)?.toInt() ?? _paperCandidates(remote, p).length;
      rows.add({
        'id': m.id, 'paperId': paperId, 'code': f('code'), 'subject': grade.isEmpty ? f('subject') : '${f('subject')} — Class $grade',
        'sub': [cycle?['short'] ?? cycle?['title'], d['note']].where((x) => x != null && '$x'.isNotEmpty).join(' • '), 'date': date, 'start': start,
        'end': '${d['end'] ?? p['end'] ?? _hhmm(_mins(start) + dur.round())}', 'hall': hall,
        'venue': '${d['venue'] ?? ([if (cls.isNotEmpty) cls, if (hall.isNotEmpty) hall].join(' • '))}', 'role': role,
        'partner': partner == null ? 'Self' : '${pStaff['name'] ?? partner['staffId']}',
        'partnerRole': partner == null ? (role == 'Chief Invigilator' ? 'Lead Chief Invigilator' : role) : [partner['role'] ?? 'Invigilator', pStaff['designation'] ?? pStaff['department']].where((x) => x != null && '$x'.isNotEmpty).join(' • '),
        'candidates': candidates, 'status': d['status'] == 'completed' || (date.isNotEmpty && date.compareTo(today) < 0) ? 'completed' : 'upcoming',
        'report': '${d['reportBy'] ?? _hhmm(_mins(start) - 30)}', 'cls': cls, 'control': '${d['control'] ?? 'Exam Control Room'}',
        'swap': st['swap'] ?? '', 'swapWith': st['swapWith'] ?? '', 'swapReason': st['swapReason'] ?? '', 'checked': st['checked'] ?? const <int>[],
        'submitted': st['submitted'] == true,
      });
    }
    rows.sort((a, b) => '${a['date']} ${a['start']}'.compareTo('${b['date']} ${b['start']}'));
    return rows;
  }

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) =>
      [RemoteWrite('ed_duty_state', _overlayId(ctx, '${row['id']}'), stamp(ctx, {'dutyId': row['id'], for (final k in stateFields) if (row[k] != null) k: row[k]}))];
}

/// `ed_candidates` <- `exm_candidates` of each duty's paper classes, seated in roll order (desk D-01…), with the
/// teacher's per-candidate state (`ed_cand_state`: attendance, supplementary sheets, malpractice). Local id `{dutyId}__{candId}`.
class ExamCandidatesAdapter extends StoreAdapter {
  const ExamCandidatesAdapter() : super('ed_candidates');
  static const stateFields = ['status', 'supp', 'suppCode', 'malpractice', 'absentReason'];

  @override
  Set<String> get sources => {'exm_duties', 'exm_papers', 'exm_candidates', 'ed_cand_state'};

  @override
  List<RemoteQuery> queries(AdapterContext ctx, Remote remote) => [
        ..._dutyQueries(ctx, remote),
        ..._candidateQueries(remote, [for (final d in _myDuties(ctx, remote)) d.paper]),
        RemoteQuery('ed_cand_state', eq: {'teacherId': ctx.staffId}),
      ];

  @override
  List<Rec> build(AdapterContext ctx, Remote remote) {
    final rows = <Rec>[];
    for (final m in _myDuties(ctx, remote)) {
      final code = '${m.duty['code'] ?? m.paper['code'] ?? ''}'.replaceAll(RegExp('[^A-Za-z0-9]'), '');
      final cands = _paperCandidates(remote, m.paper);
      for (var n = 0; n < cands.length; n++) {
        final c = cands[n];
        final id = '${m.id}__${c['id']}';
        final st = _byId(remote, 'ed_cand_state', _overlayId(ctx, id)) ?? const {};
        final seq = n + 1;
        rows.add({
          'id': id, 'dutyId': m.id, 'candId': c['id'], 'studentId': c['studentId'], 'desk': 'D-${seq.toString().padLeft(2, '0')}', 'seq': seq,
          'set': n.isEven ? 'A' : 'B', 'name': '${c['name'] ?? ''}', 'roll': _rollOf(c['roll']), 'cls': '${c['cls'] ?? '${c['grade']}-${c['section']}'}',
          'cbse': '${c['grn'] ?? ''}', 'omr': '${code.isEmpty ? 'OMR' : code}-${seq.toString().padLeft(3, '0')}',
          'supp': (st['supp'] as num?)?.toInt() ?? 0, 'suppCode': st['suppCode'] ?? '', 'status': st['status'] ?? 'present',
          'absentReason': st['absentReason'] ?? '', 'malpractice': st['malpractice'] ?? '',
        });
      }
    }
    return rows;
  }

  @override
  List<RemoteWrite> write(AdapterContext ctx, Remote remote, Rec row) => [
        RemoteWrite('ed_cand_state', _overlayId(ctx, '${row['id']}'),
            stamp(ctx, {'dutyId': row['dutyId'], 'candId': row['candId'], for (final k in stateFields) if (row[k] != null) k: row[k]})),
      ];
}

/// All adapters with a special mapping. Every other local collection is teacher-private ([PrivateAdapter]).
List<StoreAdapter> defaultAdapters() => const [
      MeAdapter(),
      ClassesAdapter(),
      StudentsAdapter(),
      PeriodsAdapter(),
      SubstitutionsAdapter(),
      AttendanceAdapter(),
      HomeworkAdapter(),
      ExamsAdapter(),
      MarksAdapter(),
      StaffLeavesAdapter(),
      StaffLeavesAdapter('att_leaves'),
      StaffAttendanceAdapter(),
      RegularizationsAdapter(),
      ExamDutiesAdapter(),
      ExamCandidatesAdapter(),
      LeaveQuotaAdapter(),
      LeaveBalanceAdapter(),
      StudentLeavesAdapter('lm_student', src: 'lm'),
      StudentLeavesAdapter('att_slips', src: 'slip'),
      LiveClassesAdapter(),
      CircularsAdapter(),
      ReadOnlyAdapter('calendar_events', 'calendar_events'),
      ReadOnlyAdapter('school', 'school'),
      // the school's `notifications` belong to the admin; the teacher's own list (also filled by push notifications) is hm_
      PrivateAdapter('notifications', 'hm_notifications'),
      PrivateAdapter('settings', 'hm_settings'),
    ];

/// Collections loaded right after login (the rest load lazily on first read).
const coreCollections = ['me', 'classes', 'students', 'tt_periods', 'tt_subs', 'att_records', 'tk_homework', 'lv_sessions', 'att_circulars', 'settings', 'notifications', 'calendar_events'];

/// Deep copy through JSON (what Firestore stores).
Rec cleanRec(Rec r) => _clean(r);
