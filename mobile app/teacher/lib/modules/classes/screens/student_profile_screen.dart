import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../attendance/models/attendance_models.dart';
import '../../attendance/screens/widgets/notify_parent_sheet.dart';
import '../../attendance/repositories/attendance_repository_interface.dart';
import '../../engage/repositories/message_repository_interface.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/bloc/school_states.dart';
import '../../school/models/school_models.dart';
import '../../tasks/models/homework_models.dart';
import '../bloc/student_profile_bloc.dart';
import '../bloc/student_profile_events.dart';
import '../bloc/student_profile_states.dart';
import '../models/classes_models.dart';
import 'widgets/student_details_tab.dart';

enum ProfileTab { overview, academics, attendance, details }

const _tabLabels = {ProfileTab.overview: 'Overview', ProfileTab.attendance: 'Attendance', ProfileTab.academics: 'Academics', ProfileTab.details: 'Details'};

/// A student's profile from real records. Every teacher of the class sees the overview, attendance and academics;
/// the class teacher also gets the full record (contacts, address, health, admission) and can correct it.
class StudentProfileScreen extends StatelessWidget {
  const StudentProfileScreen({super.key, required this.id, required this.tab});
  final String id;
  final ProfileTab tab;
  @override
  Widget build(BuildContext context) => BlocProvider(create: (_) => getIt<StudentProfileBloc>(), child: _ProfileView(id: id, initial: tab));
}

class _ProfileView extends StatefulWidget {
  const _ProfileView({required this.id, required this.initial});
  final String id;
  final ProfileTab initial;
  @override
  State<_ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<_ProfileView> {
  late ProfileTab _tab = widget.initial;
  bool _requested = false;

  /// Loads once the student (and so the class and the class-teacher flag) is known.
  void _load(Student st, bool ct) {
    if (_requested) return;
    _requested = true;
    context.read<StudentProfileBloc>().add(StudentProfileLoadRequested(st.id, st.classId, details: ct));
  }

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final st = school.students.where((s) => s.id == widget.id).firstOrNull;
    if (st == null) {
      return DetailScaffold(
        title: 'Student',
        fallbackRoute: RoutePaths.classes,
        body: school.status == SchoolStatus.loaded ? const AppEmptyState('Student not found', icon: Icons.person_off_outlined) : const SchoolSkeletonList(),
      );
    }
    final cls = school.classById(st.classId);
    final ct = cls?.classTeacher == true;
    _load(st, ct);
    final s = context.watch<StudentProfileBloc>().state;
    final tabs = [ProfileTab.overview, ProfileTab.attendance, ProfileTab.academics, if (ct) ProfileTab.details];
    final tab = tabs.contains(_tab) ? _tab : ProfileTab.overview;
    return DetailScaffold(
      title: st.name,
      subtitle: cls == null ? null : 'Class ${cls.label}${st.roll > 0 ? ' • Roll ${st.roll}' : ''}',
      fallbackRoute: '${RoutePaths.students}?classId=${st.classId}',
      actions: [
        PopupMenuButton<String>(
          tooltip: 'More',
          onSelected: (v) => context.push(switch (v) {
            'log' => '${RoutePaths.behaviourNew}?classId=${st.classId}&studentId=${st.id}',
            'docs' => RoutePaths.studentDocuments(st.id),
            _ => '${RoutePaths.behaviour}?classId=${st.classId}&studentId=${st.id}',
          }),
          itemBuilder: (_) => const [
            PopupMenuItem(value: 'log', child: Text('Log behaviour')),
            PopupMenuItem(value: 'behaviour', child: Text('Conduct records')),
            PopupMenuItem(value: 'docs', child: Text('Documents')),
          ],
        ),
      ],
      body: ListView(
        padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 40.h),
        children: [
          _Header(st: st, cls: cls, ct: ct, s: s),
          SizedBox(height: 14.h),
          AppSegmented(items: [for (final t in tabs) _tabLabels[t]!], value: _tabLabels[tab]!, track: true, onChanged: (v) => setState(() => _tab = tabs.firstWhere((t) => _tabLabels[t] == v))),
          SizedBox(height: 14.h),
          if (s.status != ProfileStatus.loaded && tab != ProfileTab.details)
            const SchoolSkeletonList()
          else
            switch (tab) {
              ProfileTab.overview => _Overview(st: st, s: s, ct: ct, onTab: (t) => setState(() => _tab = t)),
              ProfileTab.attendance => _AttendanceTab(s: s),
              ProfileTab.academics => _AcademicsTab(s: s),
              ProfileTab.details => const StudentDetailsTab(),
            },
        ],
      ),
    );
  }
}

/// Photo, name, ids, and call / message / notify shortcuts.
class _Header extends StatelessWidget {
  const _Header({required this.st, required this.cls, required this.ct, required this.s});
  final Student st;
  final SchoolClass? cls;
  final bool ct;
  final StudentProfileState s;

  Future<void> _notify(BuildContext context) async {
    final absents = s.absences;
    final mondays = absents.where((r) => DateTime.parse(r.date).weekday == DateTime.monday).length;
    final r = await showNotifySheet(context, st, cls: cls, absentCount: absents.length, mondays: mondays);
    if (r == null) return;
    await getIt<IAttendanceRepository>().addNotice(r.notice);
    if (r.chat) await getIt<IMessageRepository>().send(to: ['g_${st.id}'], text: r.notice.message);
  }

  @override
  Widget build(BuildContext context) {
    final age = st.ageOn(DateTime.now());
    final digits = st.phone.replaceAll(RegExp(r'[^0-9+]'), '');
    final rate = s.attendance.days > 0 ? s.attendanceRate : st.attendance;
    final low = rate > 0 && rate < minimumAttendance;
    return AppCard(
      radius: R.xxl,
      padding: EdgeInsets.all(16.r),
      child: Column(
        children: [
          Row(
            children: [
              Avatar(st.name, size: 68, image: st.photo.isEmpty ? null : st.photo),
              SizedBox(width: 14.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(st.name, style: T.h2, maxLines: 2, overflow: TextOverflow.ellipsis),
                    SizedBox(height: 4.h),
                    Wrap(
                      spacing: 6.w,
                      runSpacing: 4.h,
                      children: [
                        if (ct) const Pill('Your class', tone: Tone.brand, icon: Icons.workspace_premium_rounded),
                        if (st.adm.isNotEmpty) Pill('Adm ${st.adm}', tone: Tone.neutral),
                        if (st.gender.isNotEmpty || age != null) Pill([if (st.gender.isNotEmpty) st.gender, if (age != null) '$age yrs'].join(' • '), tone: Tone.neutral),
                      ],
                    ),
                  ],
                ),
              ),
              Column(
                children: [
                  Text(rate > 0 ? '${rate.round()}%' : '—', style: T.h2.copyWith(color: low ? C.danger : C.successDark)),
                  Text('attendance', style: T.small.copyWith(fontSize: 10.5.sp)),
                ],
              ),
            ],
          ),
          SizedBox(height: 14.h),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg)),
            child: Row(
              children: [
                Icon(Icons.family_restroom_rounded, size: 18.r, color: C.slate),
                SizedBox(width: 8.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(st.guardian.isEmpty ? 'Guardian not recorded' : st.guardian, style: T.bodyStrong.copyWith(fontSize: 13.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                      Text([if (st.relation.isNotEmpty) st.relation, if (st.phone.isNotEmpty) st.phone].join(' • '), style: T.small.copyWith(fontSize: 12.sp)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 12.h),
          Row(
            children: [
              _Quick(Icons.call_outlined, 'Call', digits.isEmpty ? null : () => launchUrl(Uri(scheme: 'tel', path: digits))),
              _Quick(Icons.chat_bubble_outline_rounded, 'Message', () => context.push(RoutePaths.message('g_${st.id}'))),
              _Quick(Icons.notifications_active_outlined, 'Notify', () => _notify(context)),
              _Quick(Icons.emoji_events_outlined, 'Log', () => context.push('${RoutePaths.behaviourNew}?classId=${st.classId}&studentId=${st.id}')),
            ],
          ),
        ],
      ),
    );
  }
}

class _Quick extends StatelessWidget {
  const _Quick(this.icon, this.label, this.onTap);
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Padding(
      padding: EdgeInsets.symmetric(horizontal: 3.w),
      child: Material(
        color: onTap == null ? C.surface : C.panel,
        borderRadius: BorderRadius.circular(R.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(R.md),
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 9.h),
            child: Column(
              children: [
                Icon(icon, size: 19.r, color: onTap == null ? C.muted : C.primary),
                SizedBox(height: 3.h),
                Text(label, style: T.smallStrong.copyWith(fontSize: 11.sp, color: onTap == null ? C.muted : C.ink)),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.child, this.action, this.onAction});
  final String title;
  final Widget child;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 12.h),
    child: AppCard(
      radius: R.xl,
      padding: EdgeInsets.all(14.r),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: T.h3)),
              if (action != null) GestureDetector(onTap: onAction, child: Text(action!, style: T.smallStrong.copyWith(color: C.primary))),
            ],
          ),
          SizedBox(height: 10.h),
          child,
        ],
      ),
    ),
  );
}

class _Muted extends StatelessWidget {
  const _Muted(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(text, style: T.small);
}

const _mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
String _dm(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? iso : '${d.day} ${_mon[d.month - 1]}';
}

class _Overview extends StatelessWidget {
  const _Overview({required this.st, required this.s, required this.ct, required this.onTab});
  final Student st;
  final StudentProfileState s;
  final bool ct;
  final ValueChanged<ProfileTab> onTab;
  @override
  Widget build(BuildContext context) {
    final a = s.attendance;
    final graded = [for (final e in s.exams) if (e.mark?.total != null && e.exam.maxTotal > 0) e];
    final pendingHw = s.homework.where((h) => h.submissions[st.id]?.status == SubmissionStatus.pending).length;
    final d = s.details;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Card(
          title: 'Attendance',
          action: 'Calendar',
          onAction: () => onTab(ProfileTab.attendance),
          child: a.days == 0
              ? const _Muted('No registers submitted yet this year.')
              : Row(
                  children: [
                    _Num('${a.present}', 'Present', C.successDark),
                    _Num('${a.absent}', 'Absent', C.danger),
                    _Num('${a.late}', 'Late', C.warningDark),
                    _Num('${a.excused}', 'Excused', C.purple),
                  ],
                ),
        ),
        if (ct && d != null && (d.conditions.isNotEmpty || d.assistance.isNotEmpty || d.bloodGroup.isNotEmpty))
          _Card(
            title: 'Health',
            action: 'Details',
            onAction: () => onTab(ProfileTab.details),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (d.bloodGroup.isNotEmpty) Text('Blood group ${d.bloodGroup}', style: T.bodyStrong),
                if (d.conditions.isNotEmpty) Text(d.conditions, style: T.body.copyWith(color: C.danger)),
                if (d.assistance.isNotEmpty) Text('Support: ${d.assistance}', style: T.small),
              ],
            ),
          ),
        _Card(
          title: 'Academics',
          action: 'All',
          onAction: () => onTab(ProfileTab.academics),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (graded.isEmpty) const _Muted('No marks entered for this class yet.'),
              for (final e in graded.take(3)) _ExamRow(e),
              if (s.homework.isNotEmpty) ...[
                SizedBox(height: 6.h),
                Text(
                  pendingHw == 0 ? 'All ${s.homework.length} assignments turned in' : '$pendingHw of ${s.homework.length} assignments not turned in',
                  style: T.small.copyWith(color: pendingHw == 0 ? C.successDark : C.warningDark, fontWeight: FontWeight.w600),
                ),
              ],
            ],
          ),
        ),
        _Card(
          title: 'Behaviour',
          action: 'Log',
          onAction: () => context.push('${RoutePaths.behaviourNew}?classId=${st.classId}&studentId=${st.id}'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (s.logs.isEmpty) const _Muted('No behaviour logged.'),
              for (final l in s.logs.take(3)) _LogRow(l),
            ],
          ),
        ),
        if (s.leaves.isNotEmpty)
          _Card(
            title: 'Leave requests',
            child: Column(children: [for (final l in s.leaves.take(3)) _LeaveRow(l)]),
          ),
        if (st.bus.isNotEmpty || st.busStop.isNotEmpty)
          _Card(
            title: 'Transport',
            child: Row(
              children: [
                Icon(Icons.directions_bus_outlined, size: 18.r, color: C.slate),
                SizedBox(width: 8.w),
                Expanded(child: Text([st.bus, st.busStop].where((e) => e.isNotEmpty).join(' • '), style: T.body.copyWith(color: C.ink))),
              ],
            ),
          ),
      ],
    );
  }
}

class _Num extends StatelessWidget {
  const _Num(this.value, this.label, this.color);
  final String value, label;
  final Color color;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(value, style: T.h2.copyWith(color: color)),
        Text(label, style: T.small.copyWith(fontSize: 11.sp)),
      ],
    ),
  );
}

class _ExamRow extends StatelessWidget {
  const _ExamRow(this.e);
  final ExamResult e;
  @override
  Widget build(BuildContext context) {
    final m = e.mark;
    final max = e.exam.maxTotal;
    final pct = m?.total == null || max == 0 ? null : m!.total! * 100 / max;
    final text = m == null
        ? 'Not entered'
        : m.absent
        ? m.status
        : m.total != null
        ? '${m.total}/$max'
        : (m.gradeValue.isEmpty ? '—' : m.gradeValue);
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 5.h),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(e.exam.name, style: T.bodyStrong.copyWith(fontSize: 13.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(e.exam.subject, style: T.small.copyWith(fontSize: 11.5.sp)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(text, style: T.bodyStrong.copyWith(color: pct == null ? C.slate : (pct < 40 ? C.danger : C.ink))),
              if (pct != null) Text('${pct.round()}%', style: T.small.copyWith(fontSize: 11.sp)),
            ],
          ),
        ],
      ),
    );
  }
}

class _LogRow extends StatelessWidget {
  const _LogRow(this.l);
  final BehaviourLog l;
  @override
  Widget build(BuildContext context) {
    final good = l.kind == 'praise';
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 5.h),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(good ? Icons.thumb_up_alt_outlined : Icons.flag_outlined, size: 18.r, color: good ? C.successDark : C.danger),
          SizedBox(width: 8.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.badge.isEmpty ? (good ? 'Praise' : 'Concern') : l.badge, style: T.bodyStrong.copyWith(fontSize: 13.5.sp)),
                if (l.note.isNotEmpty) Text(l.note, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          Text(_dm(l.at.length >= 10 ? l.at.substring(0, 10) : l.at), style: T.small.copyWith(fontSize: 11.sp)),
        ],
      ),
    );
  }
}

class _LeaveRow extends StatelessWidget {
  const _LeaveRow(this.l);
  final LeaveSlip l;
  @override
  Widget build(BuildContext context) {
    final tone = switch (l.status) {
      'Approved' => Tone.success,
      'Rejected' => Tone.danger,
      _ => Tone.warning,
    };
    return InkWell(
      onTap: () => context.push(RoutePaths.leaveSlip(l.id)),
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 6.h),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${l.type} • ${_dm(l.from)}${l.to == l.from ? '' : ' – ${_dm(l.to)}'}', style: T.bodyStrong.copyWith(fontSize: 13.5.sp)),
                  if (l.reason.isNotEmpty) Text(l.reason, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            Pill(l.status, tone: tone),
          ],
        ),
      ),
    );
  }
}

/// Month calendar of the student's marks (navigable), counts and the list of absences.
class _AttendanceTab extends StatefulWidget {
  const _AttendanceTab({required this.s});
  final StudentProfileState s;
  @override
  State<_AttendanceTab> createState() => _AttendanceTabState();
}

class _AttendanceTabState extends State<_AttendanceTab> {
  /// Height of every day cell (date + up to two rows of period dots).
  static const _cellH = 50.0;

  /// The periods of one day: subject, teacher and the student's mark in each.
  void _openDay(BuildContext context, String date) {
    final slots = widget.s.slotsOn(date);
    final absent = slots.where((x) => x.code == AttCode.absent).length;
    showAppSheet<void>(
      context,
      title: fmtKey(date, 'EEEE, d MMMM'),
      subtitle: slots.isEmpty
          ? 'No periods on the timetable'
          : absent == 0
          ? (slots.every((x) => x.code == null) ? 'Not marked yet' : 'Present in every marked period')
          : 'Absent in $absent of ${slots.length} periods',
      builder: (_) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (slots.isEmpty) Text('Nothing scheduled or marked on this day.', style: T.small),
          for (final x in slots)
            Padding(
              padding: EdgeInsets.symmetric(vertical: 6.h),
              child: Row(
                children: [
                  Container(
                    width: 36.r,
                    height: 36.r,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: _dotColor(x.code).withValues(alpha: x.code == null ? 1 : .15), borderRadius: BorderRadius.circular(R.md)),
                    child: Text('P${x.period}', style: T.smallStrong.copyWith(color: x.code == null ? C.slate : _dotColor(x.code))),
                  ),
                  SizedBox(width: 12.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(x.subject, style: T.bodyStrong),
                        if (x.teacher.isNotEmpty) Text(x.teacher, style: T.small.copyWith(fontSize: 11.5.sp)),
                      ],
                    ),
                  ),
                  Pill(
                    x.code?.label ?? 'Not marked',
                    tone: switch (x.code) {
                      AttCode.present => Tone.success,
                      AttCode.absent => Tone.danger,
                      AttCode.late => Tone.warning,
                      AttCode.excused => Tone.purple,
                      null => Tone.neutral,
                    },
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  late DateTime _month = () {
    final last = widget.s.records.isEmpty ? null : DateTime.tryParse(widget.s.records.last.date);
    final t = last ?? DateTime.now();
    return DateTime(t.year, t.month);
  }();

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    final a = s.attendance;
    final lead = DateTime(_month.year, _month.month).weekday - 1;
    final days = DateUtils.getDaysInMonth(_month.year, _month.month);
    final rows = ((lead + days) / 7).ceil();
    final monthKey = '${_month.year}-${_month.month.toString().padLeft(2, '0')}';
    final inMonth = s.records.where((r) => r.date.startsWith(monthKey)).toList();
    final absentInMonth = inMonth.where((r) => r.codeOf(s.studentId) == AttCode.absent).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Card(
          title: 'This year',
          child: a.days == 0
              ? const _Muted('No registers submitted yet.')
              : Column(
                  children: [
                    Row(
                      children: [
                        Text('${s.attendanceRate.toStringAsFixed(1)}%', style: T.title.copyWith(color: s.attendanceRate < minimumAttendance ? C.danger : C.successDark)),
                        SizedBox(width: 8.w),
                        Expanded(child: Text('of ${a.days} school days • minimum $attendanceThresholdLabel%', style: T.small)),
                      ],
                    ),
                    SizedBox(height: 10.h),
                    Row(
                      children: [
                        _Num('${a.present}', 'Present', C.successDark),
                        _Num('${a.absent}', 'Absent', C.danger),
                        _Num('${a.late}', 'Late', C.warningDark),
                        _Num('${a.excused}', 'Excused', C.purple),
                      ],
                    ),
                  ],
                ),
        ),
        AppCard(
          radius: R.xl,
          padding: EdgeInsets.all(12.r),
          child: Column(
            children: [
              Row(
                children: [
                  IconButton(
                    tooltip: 'Previous month',
                    onPressed: () => setState(() => _month = DateTime(_month.year, _month.month - 1)),
                    icon: Icon(Icons.chevron_left_rounded, size: 22.r),
                  ),
                  Expanded(
                    child: Column(
                      children: [
                        Text('${const ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][_month.month - 1]} ${_month.year}', style: T.h3),
                        Text(inMonth.isEmpty ? 'No registers' : '${inMonth.length} days • $absentInMonth absent', style: T.small.copyWith(fontSize: 11.sp)),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Next month',
                    onPressed: () => setState(() => _month = DateTime(_month.year, _month.month + 1)),
                    icon: Icon(Icons.chevron_right_rounded, size: 22.r),
                  ),
                ],
              ),
              Row(
                children: [
                  for (final d in const ['M', 'T', 'W', 'T', 'F', 'S', 'S'])
                    Expanded(child: Center(child: Text(d, style: T.small.copyWith(fontSize: 11.sp, fontWeight: FontWeight.w700)))),
                ],
              ),
              SizedBox(height: 4.h),
              for (var r = 0; r < rows; r++)
                Row(
                  children: [
                    for (var c = 0; c < 7; c++)
                      Expanded(
                        child: Builder(
                          builder: (_) {
                            final n = r * 7 + c - lead + 1;
                            if (n < 1 || n > days) return SizedBox(height: _cellH.h + 4.r);
                            final key = '$monthKey-${n.toString().padLeft(2, '0')}';
                            final today = dkey(todayDate());
                            // future days: no dots yet (tapping still shows that day's timetable)
                            return _DayCell(
                              day: n,
                              date: key,
                              slots: key.compareTo(today) > 0 ? const [] : s.slotsOn(key),
                              today: key == today,
                              onTap: () => _openDay(context, key),
                            );
                          },
                        ),
                      ),
                  ],
                ),
              SizedBox(height: 8.h),
              Wrap(
                spacing: 12.w,
                children: [
                  for (final (l, c) in [('Present', C.success), ('Absent', C.danger), ('Late', C.warning), ('Excused', C.purple), ('Not marked', C.border)])
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(width: 8.r, height: 8.r, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
                        SizedBox(width: 4.w),
                        Text(l, style: T.small.copyWith(fontSize: 11.sp)),
                      ],
                    ),
                ],
              ),
            ],
          ),
        ),
        SizedBox(height: 12.h),
        _Card(
          title: 'Absences',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (s.absences.isEmpty) const _Muted('No absences recorded.'),
              for (final r in s.absences.take(12))
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 4.h),
                  child: Row(
                    children: [
                      Icon(Icons.event_busy_outlined, size: 16.r, color: C.danger),
                      SizedBox(width: 8.w),
                      Expanded(child: Text(fmtKey(r.date, 'EEEE, d MMM yyyy'), style: T.body.copyWith(color: C.ink))),
                      if (s.leaves.any((l) => l.status == 'Approved' && l.covers(r.date))) const Pill('Leave', tone: Tone.purple),
                    ],
                  ),
                ),
              if (s.absences.length > 12) Text('+${s.absences.length - 12} more', style: T.small),
            ],
          ),
        ),
      ],
    );
  }
}

class _AcademicsTab extends StatelessWidget {
  const _AcademicsTab({required this.s});
  final StudentProfileState s;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _Card(
        title: 'Exams',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (s.exams.isEmpty) const _Muted('No exams for this class that you can see.'),
            for (final e in s.exams) _ExamRow(e),
          ],
        ),
      ),
      _Card(
        title: 'Assignments',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (s.homework.isEmpty) const _Muted('No assignments yet.'),
            for (final h in s.homework.take(12)) _HomeworkRow(h: h, studentId: s.studentId),
          ],
        ),
      ),
    ],
  );
}

class _HomeworkRow extends StatelessWidget {
  const _HomeworkRow({required this.h, required this.studentId});
  final Homework h;
  final String studentId;
  @override
  Widget build(BuildContext context) {
    final sub = h.submissions[studentId];
    final (label, tone) = switch (sub?.status) {
      SubmissionStatus.graded => (sub?.marks == null ? 'Graded' : '${sub!.marks}/${h.maxMarks}', Tone.success),
      SubmissionStatus.submitted => ('Turned in', Tone.brand),
      _ => ('Pending', Tone.warning),
    };
    return InkWell(
      onTap: () => context.push(RoutePaths.homework(h.id)),
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 6.h),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(h.title, style: T.bodyStrong.copyWith(fontSize: 13.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text('${h.subject} • due ${_dm(h.due.length >= 10 ? h.due.substring(0, 10) : h.due)}', style: T.small.copyWith(fontSize: 11.5.sp)),
                ],
              ),
            ),
            Pill(label, tone: tone),
          ],
        ),
      ),
    );
  }
}

Color _dotColor(AttCode? c) => switch (c) {
  AttCode.present => C.success,
  AttCode.absent => C.danger,
  AttCode.late => C.warning,
  AttCode.excused => C.purple,
  null => C.border,
};

/// A calendar day: the date and one dot per period in timetable order (green present, red absent, amber late,
/// purple excused, grey not marked), wrapping onto a second row; every cell has the same height.
class _DayCell extends StatelessWidget {
  const _DayCell({required this.day, required this.date, required this.slots, required this.today, required this.onTap});
  final int day;
  final String date;
  final List<({int period, String subject, String teacher, AttCode? code})> slots;
  final bool today;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final marked = slots.where((x) => x.code != null).toList();
    final absent = marked.any((x) => x.code == AttCode.absent);
    final allIn = marked.isNotEmpty && !absent;
    final bg = absent ? C.dangerSoft.withValues(alpha: .55) : (allIn ? C.successSoft.withValues(alpha: .45) : Colors.transparent);
    return Semantics(
      button: true,
      label: '$date, ${marked.isEmpty ? 'not marked' : absent ? 'absent in ${marked.where((x) => x.code == AttCode.absent).length} periods' : 'present'}',
      child: GestureDetector(
        key: ValueKey('cal-day-$date'),
        onTap: onTap,
        child: Container(
          height: _AttendanceTabState._cellH.h,
          margin: EdgeInsets.all(2.r),
          padding: EdgeInsets.symmetric(horizontal: 3.w, vertical: 4.h),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(R.sm),
            border: today ? Border.all(color: C.primary, width: 1.4) : null,
          ),
          child: Column(
            children: [
              Text('$day', style: T.smallStrong.copyWith(fontSize: 11.5.sp, color: slots.isEmpty ? C.muted : (absent ? C.danger : C.ink))),
              const Spacer(),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 2.5.r,
                runSpacing: 2.5.r,
                children: [
                  for (final x in slots)
                    Container(width: 6.r, height: 6.r, decoration: BoxDecoration(color: _dotColor(x.code), shape: BoxShape.circle)),
                ],
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}
