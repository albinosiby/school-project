import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/app_config.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../attendance/models/attendance_models.dart' show AttCode, minimumAttendance, attendanceThresholdLabel, todayDate;
import '../../school/bloc/school_bloc.dart';
import '../../school/models/school_models.dart';
import '../bloc/class_hub_bloc.dart';
import '../bloc/class_hub_events.dart';
import '../models/student_metrics.dart';
import '../../tasks/models/homework_grading.dart';
import '../../tasks/models/homework_models.dart';
import '../../tasks/screens/homework_screen.dart' show dueLabel;

const _sorts = ['Roll number', 'Name', 'Attendance (low first)'];

/// A class page: who is in the class and how they are doing today. The class teacher also gets the leave requests,
/// birthdays, low-attendance follow-ups and roll numbers. Supports `?classId=` and `?q=`.
class StudentsScreen extends StatelessWidget {
  const StudentsScreen({super.key, this.classId, this.query, this.subjectView = false});
  final String? classId, query;

  /// Opened from "Subjects you teach": the subject teacher's view, without the class-teacher tools (those live on
  /// the class management page), even for her own class.
  final bool subjectView;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<ClassHubBloc>()..add(const ClassHubLoadRequested()),
    child: _ClassView(classId: classId, query: query, subjectView: subjectView),
  );
}

class _ClassView extends StatefulWidget {
  const _ClassView({this.classId, this.query, this.subjectView = false});
  final String? classId, query;
  final bool subjectView;
  @override
  State<_ClassView> createState() => _ClassViewState();
}

class _ClassViewState extends State<_ClassView> {
  late final _search = TextEditingController(text: widget.query ?? '');
  late String _q = widget.query ?? '';
  String _filter = 'All';
  String _sort = _sorts.first;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final hub = context.watch<ClassHubBloc>().state;
    final cls = classOr(school.classes, widget.classId);
    if (cls == null) {
      return DetailScaffold(title: 'Class', fallbackRoute: RoutePaths.classes, body: const AppEmptyState('No classes assigned', icon: Icons.class_outlined));
    }
    final ct = cls.classTeacher && !widget.subjectView;
    final roster = [...school.studentsOf(cls.id)];
    final today = hub.todayOf(cls.id);
    final leaveToday = hub.onLeaveToday(roster);
    final leaves = ct ? hub.pendingLeaves(roster) : const [];
    final low = [for (final s in roster) if (s.attendance > 0 && s.attendance < minimumAttendance) s];
    final birthdays = _birthdays(roster);
    final noRoll = roster.where((s) => s.roll <= 0).length;
    AttCode? statusOf(Student s) => today?.marks.containsKey(s.id) == true ? today!.codeOf(s.id) : null;

    final filters = {
      'All': roster.length,
      'Absent today': roster.where((s) => statusOf(s) == AttCode.absent).length,
      'Below $attendanceThresholdLabel%': low.length,
      'On leave': leaveToday.length,
    };
    final q = _q.trim().toLowerCase();
    final list = [
      for (final s in roster)
        if (switch (_filter) {
              'Absent today' => statusOf(s) == AttCode.absent,
              'On leave' => leaveToday.contains(s.id),
              'All' => true,
              _ => low.contains(s),
            } &&
            (q.isEmpty || '${s.name} ${s.roll} ${s.adm} ${s.guardian}'.toLowerCase().contains(q)))
          s,
    ];
    switch (_sort) {
      case 'Name':
        list.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
      case 'Attendance (low first)':
        list.sort((a, b) => a.attendance.compareTo(b.attendance));
      default:
        list.sort((a, b) => (a.roll <= 0 ? 9999 : a.roll).compareTo(b.roll <= 0 ? 9999 : b.roll));
    }
    final subjects = cls.subjectNames.isNotEmpty ? cls.subjectNames.join(', ') : cls.subject;
    final boys = roster.where((s) => s.gender.toLowerCase() == 'male').length;
    final girls = roster.where((s) => s.gender.toLowerCase() == 'female').length;

    return DetailScaffold(
      title: 'Class ${cls.label}',
      subtitle: ct ? 'You are the class teacher' : (subjects.isEmpty ? 'Your class' : 'You teach $subjects'),
      fallbackRoute: RoutePaths.classes,
      body: ListView(
        padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 40.h),
        children: [
          // headline numbers
          Row(
            children: [
              Expanded(
                child: _Stat(
                  label: 'Students',
                  value: '${roster.length}',
                  sub: boys + girls == 0 ? (cls.room.isEmpty ? '' : cls.room) : '$boys boys • $girls girls',
                ),
              ),
              SizedBox(width: 8.w),
              Expanded(
                child: _Stat(
                  label: 'Today',
                  value: today == null ? '—' : '${today.counts.present + today.counts.late}/${today.total}',
                  sub: today == null ? 'Not marked' : '${today.counts.absent} absent',
                  tone: today == null ? Tone.warning : Tone.success,
                ),
              ),
              SizedBox(width: 8.w),
              Expanded(
                child: _Stat(
                  label: 'Attendance',
                  value: cls.attendance > 0 ? '${cls.attendance.toStringAsFixed(1)}%' : '—',
                  sub: low.isEmpty ? 'All above $attendanceThresholdLabel%' : '${low.length} below $attendanceThresholdLabel%',
                  tone: low.isEmpty ? Tone.success : Tone.danger,
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),
          // quick actions
          Row(
            children: [
              _Action(Icons.how_to_reg_rounded, today == null ? 'Mark attendance' : 'Attendance', () => context.push(RoutePaths.markAttendance(classId: cls.id))),
              _Action(Icons.assignment_add, 'Homework', () => context.push('${RoutePaths.homeworkNew}?classId=${cls.id}')),
              _Action(Icons.grading_rounded, 'Marks', () => context.push('${RoutePaths.marks}?class=${cls.id}')),
              _Action(Icons.emoji_events_outlined, 'Behaviour', () => context.push('${RoutePaths.behaviour}?classId=${cls.id}')),
            ],
          ),
          // class teacher: what needs her today
          if (ct) ...[
            if (today == null || leaves.isNotEmpty || birthdays.isNotEmpty || noRoll > 0) ...[
              SizedBox(height: 16.h),
              Text('Needs your attention', style: T.h3),
              SizedBox(height: 8.h),
            ],
            if (today == null)
              _Alert(
                icon: Icons.how_to_reg_outlined,
                tone: Tone.warning,
                title: "Today's attendance is not marked",
                sub: 'Mark the register for ${roster.length} students',
                onTap: () => context.push(RoutePaths.markAttendance(classId: cls.id)),
              ),
            for (final l in leaves.take(3))
              _Alert(
                icon: Icons.event_note_rounded,
                tone: Tone.brand,
                title: 'Leave request • ${roster.where((s) => s.id == l.studentId).firstOrNull?.name ?? 'Student'}',
                sub: '${l.type} • ${_range(l.from, l.to)}${l.reason.isEmpty ? '' : ' • ${l.reason}'}',
                onTap: () => context.push(RoutePaths.leaveSlip(l.id)),
              ),
            if (leaves.length > 3)
              _Alert(
                icon: Icons.more_horiz_rounded,
                tone: Tone.brand,
                title: '${leaves.length - 3} more leave requests',
                sub: 'Open the attendance overview',
                onTap: () => context.push(RoutePaths.attendanceHistory),
              ),
            if (birthdays.isNotEmpty)
              _Alert(
                icon: Icons.cake_outlined,
                tone: Tone.purple,
                title: birthdays.length == 1 ? 'Birthday this week' : '${birthdays.length} birthdays this week',
                sub: birthdays.map((b) => '${b.$1.name.split(' ').first} (${b.$2})').join(', '),
              ),
            if (noRoll > 0 && AppConfig.isFirebase)
              _Alert(
                icon: Icons.format_list_numbered_rounded,
                tone: Tone.neutral,
                title: '$noRoll ${noRoll == 1 ? 'student has' : 'students have'} no roll number',
                sub: 'Assign them in alphabetical order',
                onTap: () => _assignRollsByName(context, roster),
              ),
          ],
          SizedBox(height: 18.h),
          _HomeworkSection(classId: cls.id, homework: [for (final h in hub.homework) if (h.classId == cls.id) h], roster: roster),
          SizedBox(height: 18.h),
          Row(
            children: [
              Expanded(child: Text('Students', style: T.h2)),
              PopupMenuButton<String>(
                tooltip: 'Sort',
                initialValue: _sort,
                onSelected: (v) => setState(() => _sort = v),
                itemBuilder: (_) => [for (final s in _sorts) PopupMenuItem(value: s, child: Text(s))],
                child: Row(
                  children: [
                    Icon(Icons.sort_rounded, size: 18.r, color: C.primary),
                    SizedBox(width: 4.w),
                    Text(_sort, style: T.smallStrong.copyWith(color: C.primary)),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 10.h),
          AppSearchField(hint: 'Search name, roll or admission no.', controller: _search, onChanged: (v) => setState(() => _q = v)),
          SizedBox(height: 10.h),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: AppChoiceChips(
              items: [for (final e in filters.entries) '${e.key} (${e.value})'],
              value: '$_filter (${filters[_filter]})',
              dense: true,
              onChanged: (v) => setState(() => _filter = v.substring(0, v.lastIndexOf(' ('))),
            ),
          ),
          SizedBox(height: 10.h),
          if (list.isEmpty)
            Padding(
              padding: EdgeInsets.only(top: 24.h),
              child: AppEmptyState(roster.isEmpty ? 'No students yet' : 'No one matches', icon: Icons.person_search_outlined),
            )
          else
            AppCard(
              radius: R.xl,
              padding: EdgeInsets.symmetric(vertical: 4.h),
              child: Column(
                children: [
                  for (var i = 0; i < list.length; i++) ...[
                    if (i > 0) Divider(height: 1, indent: 66.w, color: C.border),
                    _StudentRow(
                      s: list[i],
                      today: statusOf(list[i]),
                      onLeave: leaveToday.contains(list[i].id),
                      onRoll: ct && AppConfig.isFirebase ? () => showDialog<void>(context: context, builder: (_) => _RollDialog(list[i])) : null,
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }

  /// Students whose birthday falls in the next 7 days (with the day label).
  static List<(Student, String)> _birthdays(List<Student> roster) {
    final t = todayDate();
    final out = <(Student, String, int)>[];
    for (final s in roster) {
      final d = DateTime.tryParse(s.dob);
      if (d == null) continue;
      for (var i = 0; i < 7; i++) {
        final day = t.add(Duration(days: i));
        if (day.month == d.month && day.day == d.day) {
          out.add((s, i == 0 ? 'today' : i == 1 ? 'tomorrow' : _dm(day), i));
          break;
        }
      }
    }
    out.sort((a, b) => a.$3.compareTo(b.$3));
    return [for (final o in out) (o.$1, o.$2)];
  }

  static const _mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  static String _dm(DateTime d) => '${d.day} ${_mon[d.month - 1]}';
  static String _range(String from, String to) {
    final a = DateTime.tryParse(from), b = DateTime.tryParse(to);
    if (a == null) return from;
    if (b == null || from == to) return _dm(a);
    return '${_dm(a)} – ${_dm(b)}';
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.sub = '', this.tone = Tone.brand});
  final String label, value, sub;
  final Tone tone;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.all(12.r),
    decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: T.small.copyWith(fontSize: 11.sp)),
        SizedBox(height: 2.h),
        FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(value, style: T.h2.copyWith(color: toneColors(tone).fg))),
        if (sub.isNotEmpty) Text(sub, style: T.small.copyWith(fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
      ],
    ),
  );
}

class _Action extends StatelessWidget {
  const _Action(this.icon, this.label, this.onTap);
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Padding(
      padding: EdgeInsets.symmetric(horizontal: 3.w),
      child: Material(
        color: C.panel,
        borderRadius: BorderRadius.circular(R.lg),
        child: InkWell(
          borderRadius: BorderRadius.circular(R.lg),
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 10.h, horizontal: 4.w),
            child: Column(
              children: [
                Icon(icon, size: 20.r, color: C.primary),
                SizedBox(height: 4.h),
                Text(label, style: T.smallStrong.copyWith(fontSize: 10.5.sp), textAlign: TextAlign.center, maxLines: 2),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _Alert extends StatelessWidget {
  const _Alert({required this.icon, required this.tone, required this.title, required this.sub, this.onTap});
  final IconData icon;
  final Tone tone;
  final String title, sub;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 8.h),
    child: AppCard(
      radius: R.lg,
      padding: EdgeInsets.all(12.r),
      onTap: onTap,
      child: Row(
        children: [
          IconTile(icon, tone: tone, size: 38),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: T.bodyStrong.copyWith(fontSize: 13.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(sub, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          if (onTap != null) Icon(Icons.chevron_right_rounded, color: C.muted, size: 20.r),
        ],
      ),
    ),
  );
}

/// One student: photo, name, roll and admission number, today's mark and attendance.
class _StudentRow extends StatelessWidget {
  const _StudentRow({required this.s, required this.today, required this.onLeave, this.onRoll});
  final Student s;
  final AttCode? today;
  final bool onLeave;
  final VoidCallback? onRoll;
  @override
  Widget build(BuildContext context) {
    final low = s.attendance > 0 && s.attendance < minimumAttendance;
    final (tag, tone) = onLeave
        ? ('On leave', Tone.purple)
        : switch (today) {
            AttCode.absent => ('Absent', Tone.danger),
            AttCode.late => ('Late', Tone.warning),
            AttCode.excused => ('Excused', Tone.neutral),
            _ => ('', Tone.neutral),
          };
    return InkWell(
      key: ValueKey('student-row-${s.id}'),
      onTap: () => context.push(RoutePaths.student(s.id)),
      onLongPress: onRoll,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
        child: Row(
          children: [
            Avatar(s.name, size: 42, image: s.photo.isEmpty ? null : s.photo),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(s.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                  SizedBox(height: 2.h),
                  Text(
                    [s.roll > 0 ? 'Roll ${s.roll.toString().padLeft(2, '0')}' : 'No roll no.', if (s.adm.isNotEmpty) 'Adm ${s.adm}'].join(' • '),
                    style: T.small.copyWith(fontSize: 11.5.sp),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (tag.isNotEmpty) ...[Pill(tag, tone: tone), SizedBox(width: 8.w)],
            if (s.attendance > 0)
              Text('${s.attendance.round()}%', style: T.smallStrong.copyWith(color: low ? C.danger : C.successDark)),
            if (onRoll != null)
              IconButton(
                tooltip: 'Roll number',
                visualDensity: VisualDensity.compact,
                onPressed: onRoll,
                icon: Icon(Icons.more_vert_rounded, size: 18.r, color: C.slate),
              )
            else
              Icon(Icons.chevron_right_rounded, color: C.muted, size: 20.r),
          ],
        ),
      ),
    );
  }
}

/// Numbers every student without a roll in name order, continuing after the highest number already in use, through
/// the server's per-student allotment (which refuses a number another student holds). Renumbering a division that is
/// already numbered is done by the office on the dashboard.
Future<void> _assignRollsByName(BuildContext context, List<Student> roster) async {
  final pending = [for (final s in roster) if (s.roll <= 0) s]..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
  if (pending.isEmpty) return;
  var next = roster.fold<int>(0, (m, s) => s.roll > m ? s.roll : m) + 1;
  final ok = await AppDialogs.showConfirmDialog(
    context,
    title: 'Assign roll numbers?',
    message: '${pending.length} students have no roll number. They get $next to ${next + pending.length - 1} in alphabetical order: ${pending.take(3).map((s) => s.name).join(', ')}${pending.length > 3 ? '…' : ''}.',
    confirm: 'Assign',
  );
  if (!ok || !context.mounted) return;
  final callable = FirebaseFunctions.instanceFor(region: 'asia-south1').httpsCallable('assignStudentRoll');
  var done = 0;
  String? failure;
  for (final s in pending) {
    try {
      await callable.call({'studentId': s.id, 'roll': next});
      done++;
      next++;
    } on FirebaseFunctionsException catch (error) {
      failure = error.message ?? 'Could not assign a roll number.';
      break;
    } catch (_) {
      failure = 'Could not assign a roll number.';
      break;
    }
  }
  if (!context.mounted) return;
  AppDialogs.showSnackBar(context, message: failure == null ? 'Roll numbers assigned to $done students' : '$done assigned, then: $failure');
}

class _RollDialog extends StatefulWidget {
  const _RollDialog(this.student);
  final Student student;

  @override
  State<_RollDialog> createState() => _RollDialogState();
}

class _RollDialogState extends State<_RollDialog> {
  late final _input = TextEditingController(
    text: widget.student.roll > 0 ? widget.student.roll.toString() : '',
  );
  String? _error;
  bool _saving = false;

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _assign({bool automatic = false}) async {
    if (_saving) return;
    final roll = int.tryParse(_input.text);
    if (!automatic && (roll == null || roll < 1 || roll > 999)) {
      setState(() => _error = 'Enter a whole number from 1 to 999.');
      return;
    }
    setState(() { _saving = true; _error = null; });
    try {
      await FirebaseFunctions.instanceFor(region: 'asia-south1').httpsCallable('assignStudentRoll').call(
        {'studentId': widget.student.id, 'roll': automatic ? null : roll},
      );
      if (mounted) {
        setState(() => _saving = false);
        Navigator.of(context).pop();
      }
    } on FirebaseFunctionsException catch (error) {
      if (mounted) setState(() => _error = error.message ?? 'Could not assign the roll number.');
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not assign the roll number.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_saving,
    child: AlertDialog(
      title: Text('Roll number for ${widget.student.name}'),
      content: TextField(
        controller: _input,
        enabled: !_saving,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(3)],
        decoration: InputDecoration(labelText: 'Roll number', errorText: _error),
      ),
      actions: [
        TextButton(onPressed: _saving ? null : () => Navigator.of(context).pop(), child: const Text('Cancel')),
        TextButton(onPressed: _saving ? null : () => _assign(automatic: true), child: const Text('Assign automatically')),
        FilledButton(onPressed: _saving ? null : () => _assign(), child: Text(_saving ? 'Saving…' : 'Save')),
      ],
    ),
  );
}

/// The class's homework: open first (soonest due), then closed; hand-in and grading progress; set new homework.
class _HomeworkSection extends StatefulWidget {
  const _HomeworkSection({required this.classId, required this.homework, required this.roster});
  final String classId;
  final List<Homework> homework;
  final List<Student> roster;
  @override
  State<_HomeworkSection> createState() => _HomeworkSectionState();
}

class _HomeworkSectionState extends State<_HomeworkSection> {
  bool _all = false;

  @override
  Widget build(BuildContext context) {
    final list = [...widget.homework]
      ..sort((a, b) {
        int rank(Homework h) => h.open ? 0 : (h.scheduled ? 1 : 2);
        return rank(a) != rank(b) ? rank(a).compareTo(rank(b)) : (rank(a) < 2 ? a.due.compareTo(b.due) : b.due.compareTo(a.due));
      });
    final shown = _all ? list : list.take(4).toList();
    final toGrade = list.fold<int>(0, (a, h) => a + HomeworkStats.of(h, widget.roster).toGrade);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Homework', style: T.h2),
                  Text(
                    list.isEmpty ? 'Nothing set yet' : '${list.where((h) => h.open).length} open${toGrade > 0 ? ' • $toGrade to grade' : ''}',
                    style: T.small.copyWith(color: toGrade > 0 ? C.primary : C.slate, fontWeight: toGrade > 0 ? FontWeight.w600 : null),
                  ),
                ],
              ),
            ),
            AppButton(
              'New',
              key: const ValueKey('hw-new'),
              small: true,
              expand: false,
              icon: Icons.add_rounded,
              onPressed: () => context.push('${RoutePaths.homeworkNew}?classId=${widget.classId}'),
            ),
          ],
        ),
        SizedBox(height: 10.h),
        if (list.isEmpty)
          AppCard(
            radius: R.lg,
            padding: EdgeInsets.all(14.r),
            child: Text('Set homework and parents get it in the parent app, where they can hand in photos or PDFs.', style: T.small),
          ),
        for (final h in shown) _HomeworkTile(h: h, stats: HomeworkStats.of(h, widget.roster)),
        if (list.length > shown.length)
          Center(child: TextButton(onPressed: () => setState(() => _all = true), child: Text('Show all ${list.length}'))),
      ],
    );
  }
}

class _HomeworkTile extends StatelessWidget {
  const _HomeworkTile({required this.h, required this.stats});
  final Homework h;
  final HomeworkStats stats;
  @override
  Widget build(BuildContext context) {
    final left = h.daysLeft(DateTime.now());
    final total = stats.total == 0 ? 1 : stats.total;
    return Padding(
      padding: EdgeInsets.only(bottom: 8.h),
      child: AppCard(
        key: ValueKey('hw-tile-${h.id}'),
        radius: R.lg,
        padding: EdgeInsets.all(12.r),
        onTap: () => context.push(RoutePaths.homework(h.id)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(h.title, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                      Text(
                        [if (h.subject.isNotEmpty) h.subject, dueLabel(h, DateTime.now())].join(' • '),
                        style: T.small.copyWith(fontSize: 11.5.sp, color: h.open && left != null && left < 0 ? C.danger : C.slate),
                      ),
                    ],
                  ),
                ),
                if (h.scheduled)
                  const Pill('Scheduled', tone: Tone.purple, icon: Icons.schedule_send_rounded)
                else if (!h.open)
                  const Pill('Closed', tone: Tone.neutral)
                else if (stats.toGrade > 0)
                  Pill('${stats.toGrade} to ${h.graded ? 'grade' : 'check'}', tone: Tone.brand),
              ],
            ),
            SizedBox(height: 8.h),
            ClipRRect(
              borderRadius: BorderRadius.circular(R.pill),
              child: SizedBox(
                height: 6.h,
                child: Row(
                  children: [
                    if (stats.graded > 0) Expanded(flex: stats.graded, child: Container(color: C.success)),
                    if (stats.toGrade > 0) Expanded(flex: stats.toGrade, child: Container(color: C.primary)),
                    if (stats.notSubmitted > 0) Expanded(flex: stats.notSubmitted, child: Container(color: C.border)),
                    if (stats.total == 0) Expanded(child: Container(color: C.border)),
                  ],
                ),
              ),
            ),
            SizedBox(height: 4.h),
            Text(
              '${stats.turnedIn}/${stats.total} handed in (${(stats.turnedIn * 100 / total).round()}%)${stats.graded > 0 ? ' • ${stats.graded} ${h.graded ? 'graded' : 'checked'}' : ''}',
              style: T.small.copyWith(fontSize: 11.sp),
            ),
          ],
        ),
      ),
    );
  }
}
