import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/bloc/school_states.dart';
import '../../school/models/school_models.dart';
import '../bloc/students_bloc.dart';
import '../bloc/students_events.dart';
import '../bloc/students_states.dart';
import '../models/classes_models.dart';
import '../models/student_metrics.dart';
import 'widgets/classes_ui.dart';

enum ProfileTab { overview, academics, attendance }

const _tabLabels = {ProfileTab.overview: 'Overview', ProfileTab.academics: 'Academics', ProfileTab.attendance: 'Attendance'};

/// Figma 1153:13003 "3.4 Student Profile", 1153:12199 "3.4.1 Academics", 1153:12530 "3.4.2 Attendance".
class StudentProfileScreen extends StatelessWidget {
  const StudentProfileScreen({super.key, required this.id, required this.tab});
  final String id;
  final ProfileTab tab;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<StudentsBloc>()..add(const StudentsLoadRequested()),
        child: BlocListener<StudentsBloc, StudentsState>(
          listenWhen: (a, b) => a.noticeSeq != b.noticeSeq,
          listener: (ctx, s) => showNotice(ctx, s.notice),
          child: _ProfileView(id: id, tab: tab),
        ),
      );
}

String _tabPath(ProfileTab t, String id) => switch (t) {
      ProfileTab.overview => RoutePaths.student(id),
      ProfileTab.academics => RoutePaths.studentAcademics(id),
      ProfileTab.attendance => RoutePaths.studentAttendance(id),
    };

class _ProfileView extends StatelessWidget {
  const _ProfileView({required this.id, required this.tab});
  final String id;
  final ProfileTab tab;

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final logs = context.watch<StudentsBloc>().state.logs;
    final title = switch (tab) { ProfileTab.overview => 'STUDENT PROFILE', ProfileTab.academics => 'STUDENT ACADEMICS', ProfileTab.attendance => 'STUDENT ATTENDANCE' };
    final st = school.students.where((s) => s.id == id).firstOrNull;
    if (st == null) {
      return DetailScaffold(
        title: title, fallbackRoute: RoutePaths.students,
        body: school.status == SchoolStatus.loaded ? const AppEmptyState('Student not found', icon: Icons.person_off_outlined) : const Center(child: CircularProgressIndicator()),
      );
    }
    final cls = school.classById(st.classId);
    final classmates = school.studentsOf(st.classId);
    final avg = avgScore(st);
    final rank = rankIn(classmates, st);
    final size = classmates.length;
    final topPct = (rank * 100 / (size == 0 ? 1 : size)).ceil();
    final behaviour = '${RoutePaths.behaviour}?classId=${st.classId}&studentId=$id';
    final year = (school.teacher?.year ?? '').replaceAll('AY ', '').replaceAll('-', '–');

    return DetailScaffold(
      title: title, fallbackRoute: RoutePaths.students,
      actions: [
        IconAction(Icons.share_outlined, 'Share profile', () => showNotice(context, 'Profile link copied')),
        PopupMenuButton<String>(
          tooltip: 'More',
          onSelected: (v) => context.push(v == 'log' ? '${RoutePaths.behaviourNew}?classId=${st.classId}&studentId=$id' : behaviour),
          itemBuilder: (_) => const [PopupMenuItem(value: 'log', child: Text('Log behaviour')), PopupMenuItem(value: 'behaviour', child: Text('View conduct records'))],
        ),
      ],
      body: ListView(padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 40.h), children: [
        Center(
          child: Stack(clipBehavior: Clip.none, children: [
            Container(
              padding: EdgeInsets.all(6.r), decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: C.panelBorder, width: 2)),
              child: Avatar(st.name, size: 88),
            ),
            Positioned(
              right: 2.r, bottom: 2.r,
              child: Container(
                width: 28.r, height: 28.r, decoration: BoxDecoration(color: C.primary, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)),
                child: Icon(Icons.verified_rounded, size: 16.r, color: Colors.white),
              ),
            ),
          ]),
        ),
        SizedBox(height: 12.h),
        Text(st.name, style: T.title, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
        SizedBox(height: 4.h),
        Text('Class ${cls == null ? '' : clsName(cls)} • ${cls?.subject ?? ''} • Academic Year $year', style: T.small, textAlign: TextAlign.center, maxLines: 2),
        SizedBox(height: 14.h),
        Row(children: [
          Expanded(
            child: AppButton('Call Parent', icon: Icons.call_rounded, kind: BtnKind.outline, small: true,
                onPressed: () => context.read<StudentsBloc>().add(GuardianCalled(studentId: id, name: st.guardian, phone: st.phone))),
          ),
          SizedBox(width: 8.w),
          Expanded(child: AppButton('Message', icon: Icons.chat_bubble_outline_rounded, kind: BtnKind.outline, small: true, onPressed: () => context.push(RoutePaths.messageNew))),
          SizedBox(width: 8.w),
          Expanded(child: AppButton('Documents', icon: Icons.description_outlined, kind: BtnKind.outline, small: true, onPressed: () => context.push(RoutePaths.studentDocuments(id)))),
        ]),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.lg, padding: EdgeInsets.symmetric(vertical: 14.h, horizontal: 8.w),
          child: IntrinsicHeight(
            child: Row(children: [
              Expanded(child: _Stat('ATTENDANCE', '${st.attendance.toStringAsFixed(1)}%', st.attendance >= 85 ? 'Regular' : 'Low', st.attendance >= 85 ? Tone.success : Tone.danger)),
              const VerticalDivider(color: C.border, width: 1),
              Expanded(child: _Stat('GRADE', gradeOf(avg), 'Top $topPct%', Tone.brand, sub: '${avg.toStringAsFixed(1)}%')),
              const VerticalDivider(color: C.border, width: 1),
              Expanded(child: _Stat('MERITS', '+${meritsOf(st, logs)}', '${flagsOf(st, logs)} Flags', Tone.neutral)),
            ]),
          ),
        ),
        SizedBox(height: 14.h),
        AppSegmented(
          track: true, items: _tabLabels.values.toList(), value: _tabLabels[tab]!,
          onChanged: (v) {
            final t = _tabLabels.entries.firstWhere((e) => e.value == v).key;
            if (t != tab) context.pushReplacement(_tabPath(t, id));
          },
        ),
        SizedBox(height: 14.h),
        switch (tab) {
          ProfileTab.overview => _Overview(st: st, rank: rank, logs: logs, behaviourRoute: behaviour),
          ProfileTab.academics => _Academics(st: st, rank: rank, classmates: classmates, cls: cls, avg: avg),
          ProfileTab.attendance => _AttendanceTab(st: st, logs: logs, behaviourRoute: behaviour),
        },
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value, this.badge, this.tone, {this.sub});
  final String label, value, badge;
  final String? sub;
  final Tone tone;
  @override
  Widget build(BuildContext context) => Column(children: [
        Text(label, style: T.capsMuted.copyWith(fontSize: 10.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
        SizedBox(height: 4.h),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text.rich(TextSpan(children: [
            TextSpan(text: value, style: T.h1.copyWith(color: tone == Tone.brand ? C.primary : C.ink)),
            if (sub != null) TextSpan(text: ' $sub', style: T.small.copyWith(fontSize: 10.sp)),
          ])),
        ),
        SizedBox(height: 4.h),
        Pill(badge, tone: tone, dot: tone == Tone.success),
      ]);
}

Widget _guardianTile(BuildContext context, String studentId, String name, String rel, String phone) => AppCard(
      margin: EdgeInsets.only(bottom: 8.h), radius: R.lg, color: C.surface, padding: EdgeInsets.all(12.w),
      onTap: () => context.read<StudentsBloc>().add(GuardianCalled(studentId: studentId, name: name, phone: phone)),
      child: Row(children: [
        Avatar(name, size: 40),
        SizedBox(width: 12.w),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text.rich(TextSpan(children: [TextSpan(text: name, style: T.bodyStrong), TextSpan(text: '  ($rel)', style: T.small)]), maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(phone, style: T.small),
          ]),
        ),
        Semantics(label: 'Call $name', button: true, child: const IconTile(Icons.call_rounded, tone: Tone.success, size: 36)),
      ]),
    );

Widget _honorCard(BehaviourLog h, {int lines = 3}) => AppCard(
      margin: EdgeInsets.only(bottom: 8.h), radius: R.lg, padding: EdgeInsets.all(12.w),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(h.badge, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
          Pill('+${h.merits} Merits', tone: Tone.success),
        ]),
        SizedBox(height: 4.h),
        Text(h.note, style: T.small, maxLines: lines, overflow: TextOverflow.ellipsis),
        SizedBox(height: 4.h),
        Text('${h.teacher} • ${fmtAgo(h.at)}', style: T.small.copyWith(color: C.muted)),
      ]),
    );

List<BehaviourLog> _praise(List<BehaviourLog> logs, String id) => logsFor(logs, id).where((l) => l.kind == 'praise').toList()..sort((a, b) => b.at.compareTo(a.at));

class _Overview extends StatelessWidget {
  const _Overview({required this.st, required this.rank, required this.logs, required this.behaviourRoute});
  final Student st;
  final int rank;
  final List<BehaviourLog> logs;
  final String behaviourRoute;
  @override
  Widget build(BuildContext context) {
    final g2 = secondGuardian(st);
    final honors = _praise(logs, st.id);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      AppCard(
        radius: R.xxl, padding: EdgeInsets.all(14.w),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Academic Mastery', style: T.h3),
                Text('Term 2 Cumulative Assessments', style: T.small),
              ]),
            ),
            Pill('Rank #$rank'),
          ]),
          SizedBox(height: 12.h),
          for (var i = 0; i < 3; i++) _SubjectBar(st, i),
          TextButton(
            onPressed: () => context.pushReplacement(RoutePaths.studentAcademics(st.id)),
            style: TextButton.styleFrom(minimumSize: Size(44.r, 44.r)),
            child: Text('View Full Grade Sheet  →', style: T.bodyStrong.copyWith(color: C.primary)),
          ),
        ]),
      ),
      const SectionHeader('Guardian & Emergency Info'),
      _guardianTile(context, st.id, st.guardian, 'Guardian', st.phone),
      _guardianTile(context, st.id, g2.name, 'Secondary', g2.phone),
      SectionHeader('Honors & Merits Timeline', action: 'View All', onAction: () => context.push(behaviourRoute)),
      if (honors.isEmpty) const AppCard(child: AppEmptyState('No honors yet', hint: 'Praise logs for this student appear here.', icon: Icons.emoji_events_outlined)),
      for (final h in honors) _honorCard(h),
    ]);
  }
}

class _SubjectBar extends StatelessWidget {
  const _SubjectBar(this.st, this.i);
  final Student st;
  final int i;
  @override
  Widget build(BuildContext context) {
    final d = subjectDefs[i];
    final v = subjectVisuals[i];
    final sc = subjectScore(st, i);
    return Container(
      margin: EdgeInsets.only(bottom: 8.h), padding: EdgeInsets.all(12.r),
      decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
      child: Column(children: [
        Row(children: [
          IconTile(v.$1, tone: v.$2, size: 32),
          SizedBox(width: 10.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(d.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
              Text(d.teacher, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
          Text.rich(TextSpan(children: [TextSpan(text: '$sc', style: T.h2.copyWith(color: C.primary)), TextSpan(text: '/100', style: T.small)])),
        ]),
        SizedBox(height: 8.h),
        AppProgress(sc / 100),
      ]),
    );
  }
}

class _Academics extends StatefulWidget {
  const _Academics({required this.st, required this.rank, required this.classmates, required this.cls, required this.avg});
  final Student st;
  final int rank;
  final List<Student> classmates;
  final SchoolClass? cls;
  final double avg;
  @override
  State<_Academics> createState() => _AcademicsState();
}

class _AcademicsState extends State<_Academics> {
  bool _byScore = true;

  String _ord(int n) => (n % 100 >= 11 && n % 100 <= 13) ? 'th' : switch (n % 10) { 1 => 'st', 2 => 'nd', 3 => 'rd', _ => 'th' };

  @override
  Widget build(BuildContext context) {
    final st = widget.st;
    final size = widget.classmates.length;
    final order = List.generate(subjectDefs.length, (i) => i);
    if (_byScore) order.sort((a, b) => subjectScore(st, b).compareTo(subjectScore(st, a)));
    final classAvg = widget.classmates.fold<double>(0, (a, o) => a + avgScore(o)) / (size == 0 ? 1 : size);
    final pctl = ((size - widget.rank) * 100 / (size == 0 ? 1 : size)).round();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      AppCard(
        radius: R.xxl, padding: EdgeInsets.all(14.w),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Benchmark Comparison', style: T.h3),
          Text('Cohort: Class ${widget.cls == null ? '' : clsName(widget.cls!)} ($size Students)', style: T.small),
          SizedBox(height: 12.h),
          _Bench('${st.name} (Rank #${widget.rank})', widget.avg, C.primary),
          _Bench('$pctl${_ord(pctl)} Percentile', 75.0 + (pctl - 75) / 4, C.purple),
          _Bench('Class Average', classAvg, C.muted),
        ]),
      ),
      Padding(
        padding: EdgeInsets.fromLTRB(2.w, 16.h, 0, 6.h),
        child: Row(children: [
          Expanded(child: Text('Subject Performance', style: T.h2)),
          TextButton(
            onPressed: () => setState(() => _byScore = !_byScore),
            style: TextButton.styleFrom(minimumSize: Size(44.r, 44.r)),
            child: Text(_byScore ? 'Sort by Score' : 'Default order', style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.sp)),
          ),
        ]),
      ),
      for (final i in order) _AcadSubject(st, i),
    ]);
  }
}

class _Bench extends StatelessWidget {
  const _Bench(this.label, this.v, this.color);
  final String label;
  final double v;
  final Color color;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 10.h),
        child: Column(children: [
          Row(children: [
            Expanded(child: Text(label, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
            Text('${v.toStringAsFixed(1)}%', style: T.smallStrong),
          ]),
          SizedBox(height: 4.h),
          ClipRRect(
            borderRadius: BorderRadius.circular(R.pill),
            child: LinearProgressIndicator(value: (v / 100).clamp(0, 1), minHeight: 8.h, color: color, backgroundColor: const Color(0xFFE5EDFB)),
          ),
        ]),
      );
}

class _AcadSubject extends StatelessWidget {
  const _AcadSubject(this.st, this.i);
  final Student st;
  final int i;
  @override
  Widget build(BuildContext context) {
    final d = subjectDefs[i];
    final v = subjectVisuals[i];
    final sc = subjectScore(st, i);
    final theory = (sc * .7).round(), internal = sc - theory;
    return AppCard(
      margin: EdgeInsets.only(bottom: 12.h), radius: R.xl, padding: EdgeInsets.all(14.w),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          IconTile(v.$1, tone: v.$2, size: 40),
          SizedBox(width: 10.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(d.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
              Text('${d.teacher} • ${d.role}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text.rich(TextSpan(children: [TextSpan(text: '$sc', style: T.h1.copyWith(color: C.primary)), TextSpan(text: '/100', style: T.small)])),
            Text('Grade ${gradeOf(sc)}', style: T.small),
          ]),
        ]),
        SizedBox(height: 10.h),
        Row(children: [
          Expanded(child: _Part('THEORY EXAM', '$theory / 70', theory / 70)),
          SizedBox(width: 8.w),
          Expanded(child: _Part('INTERNAL & PRACTICAL', '$internal / 30', internal / 30)),
        ]),
      ]),
    );
  }
}

class _Part extends StatelessWidget {
  const _Part(this.label, this.value, this.frac);
  final String label, value;
  final double frac;
  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.all(10.r),
        decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: T.capsMuted.copyWith(fontSize: 9.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
          SizedBox(height: 4.h),
          FittedBox(
            fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
            child: Text.rich(TextSpan(children: [TextSpan(text: value, style: T.smallStrong), TextSpan(text: '  (${(frac * 100).round()}%)', style: T.small)])),
          ),
        ]),
      );
}

class _AttendanceTab extends StatelessWidget {
  const _AttendanceTab({required this.st, required this.logs, required this.behaviourRoute});
  final Student st;
  final List<BehaviourLog> logs;
  final String behaviourRoute;
  @override
  Widget build(BuildContext context) {
    final sp = attendanceSplit(st);
    final g2 = secondGuardian(st);
    final praise = _praise(logs, st.id);
    final flags = flagsOf(st, logs);
    final ok = st.attendance >= 85;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      AppCard(
        radius: R.xxl, padding: EdgeInsets.all(14.w),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('TERM 2 ATTENDANCE RATE', style: T.capsMuted.copyWith(fontSize: 10.sp))),
            Pill('${attendanceStreak(st)}d Streak', icon: Icons.local_fire_department_rounded),
          ]),
          SizedBox(height: 4.h),
          Text.rich(TextSpan(children: [
            TextSpan(text: '${st.attendance.toStringAsFixed(1)}%', style: T.stat.copyWith(fontSize: 30.sp, color: C.primary)),
            TextSpan(text: '  Target ≥ 85%', style: T.small),
          ])),
          SizedBox(height: 8.h),
          AppProgress(st.attendance / 100, tone: ok ? Tone.brand : Tone.danger),
          SizedBox(height: 6.h),
          Row(children: [
            Expanded(child: Text('Academic Term Sept - Dec 2024', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
            Text('${sp.total} Working Days', style: T.smallStrong),
          ]),
          SizedBox(height: 12.h),
          Row(children: [
            Expanded(child: _Count('${sp.present}', 'Present', Tone.neutral)),
            SizedBox(width: 6.w),
            Expanded(child: _Count('${sp.absent}', 'Absent', Tone.danger)),
            SizedBox(width: 6.w),
            Expanded(child: _Count('${sp.leave}', 'Leave', Tone.warning)),
            SizedBox(width: 6.w),
            const Expanded(child: _Count('0', 'Tardy', Tone.neutral)),
          ]),
          SizedBox(height: 10.h),
          Container(
            padding: EdgeInsets.all(10.r),
            decoration: BoxDecoration(color: C.panel, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.panelBorder)),
            child: Row(children: [
              Icon(Icons.shield_rounded, size: 16.r, color: C.primary),
              SizedBox(width: 6.w),
              Expanded(
                child: Text(
                  sp.absent == 0 ? 'Exemplary Record • Zero Unexcused Absences' : '${sp.absent} unexcused absences recorded this term',
                  style: T.smallStrong.copyWith(color: C.primary),
                ),
              ),
            ]),
          ),
        ]),
      ),
      SizedBox(height: 14.h),
      _CalendarCard(st: st),
      const SectionHeader('Disciplinary & character standing', caps: true),
      Row(children: [
        Expanded(child: StatTile(label: 'Merits', value: '+${meritsOf(st, logs)}', badge: 'Scholar', icon: Icons.emoji_events_rounded, tone: Tone.warning)),
        SizedBox(width: 8.w),
        Expanded(
          child: StatTile(
            label: flags == 0 ? 'Clean Conduct Record' : 'Active flags', value: '$flags', badge: flags == 0 ? 'Clean' : 'Review',
            icon: Icons.verified_user_outlined, tone: flags == 0 ? Tone.success : Tone.danger,
          ),
        ),
      ]),
      SectionHeader('Recent Commendations', action: 'View All (${praise.length})', onAction: () => context.push(behaviourRoute)),
      if (praise.isEmpty) const AppCard(child: AppEmptyState('No commendations yet', icon: Icons.emoji_events_outlined)),
      for (final h in praise.take(3)) _honorCard(h, lines: 2),
      const SectionHeader('Parent Communication', caps: true),
      AppCard(
        radius: R.lg, padding: EdgeInsets.all(12.w), color: C.panel, border: C.panelBorder,
        child: Row(children: [
          const IconTile(Icons.sync_rounded, size: 36),
          SizedBox(width: 10.w),
          Expanded(child: Text('App Synced • Daily automated attendance SMS and EduParent alerts active.', style: T.small)),
        ]),
      ),
      SizedBox(height: 10.h),
      _guardianTile(context, st.id, st.guardian, 'Primary Guardian', st.phone),
      _guardianTile(context, st.id, g2.name, 'Secondary Contact', g2.phone),
    ]);
  }
}

class _Count extends StatelessWidget {
  const _Count(this.v, this.l, this.tone);
  final String v, l;
  final Tone tone;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    final neutral = tone == Tone.neutral;
    return Container(
      padding: EdgeInsets.symmetric(vertical: 10.h),
      decoration: BoxDecoration(color: neutral ? C.surface : c.bg, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: neutral ? C.border : c.fg.withValues(alpha: .25))),
      child: Column(children: [
        Text(v, style: T.h2.copyWith(color: neutral ? C.ink : c.fg)),
        Text(l, style: T.small.copyWith(fontSize: 11.sp, color: neutral ? C.slate : c.fg), maxLines: 1, overflow: TextOverflow.ellipsis),
      ]),
    );
  }
}

class _CalendarCard extends StatelessWidget {
  const _CalendarCard({required this.st});
  final Student st;
  @override
  Widget build(BuildContext context) {
    final cells = <Widget>[for (var i = 0; i < 4; i++) const SizedBox()]; // 1 Nov 2024 is a Friday
    for (var d = 1; d <= 30; d++) {
      final s = calendarStatus(st, d);
      final (bg, fg) = switch (s) {
        'present' => (C.successSoft, C.successDark),
        'absent' => (C.dangerSoft, C.danger),
        'leave' => (C.warningSoft, C.warningDark),
        _ => (C.surface, C.muted),
      };
      cells.add(Container(
        margin: EdgeInsets.all(2.r), alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(R.sm)),
        child: Text('$d', style: T.smallStrong.copyWith(color: fg)),
      ));
    }
    return AppCard(
      radius: R.xl, padding: EdgeInsets.all(14.w),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.calendar_month_rounded, color: C.primary, size: 20.r),
          SizedBox(width: 6.w),
          Text('November 2024', style: T.h3),
        ]),
        SizedBox(height: 10.h),
        Row(children: [for (final d in const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) Expanded(child: Center(child: Text(d, style: T.small.copyWith(fontSize: 10.5.sp))))]),
        SizedBox(height: 4.h),
        GridView.count(crossAxisCount: 7, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), children: cells),
        SizedBox(height: 8.h),
        Wrap(spacing: 12.w, runSpacing: 4.h, children: [
          for (final l in const [('Present', C.success), ('Excused Leave', C.warning), ('Absent', C.danger), ('Weekend/Holiday', C.muted)])
            Row(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 8.r, height: 8.r, decoration: BoxDecoration(color: l.$2, shape: BoxShape.circle)),
              SizedBox(width: 4.w),
              Text(l.$1, style: T.small.copyWith(fontSize: 10.5.sp)),
            ]),
        ]),
      ]),
    );
  }
}
