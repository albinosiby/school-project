import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/models/school_models.dart';
import '../bloc/home_bloc.dart';
import '../bloc/home_events.dart';
import '../bloc/home_states.dart';
import '../../attendance/models/attendance_models.dart';
import '../models/home_models.dart';
import '../models/timetable_models.dart';
import 'widgets/home_now_card.dart';
import 'widgets/teacher_tab_header.dart';

/// Home tab (Figma 1153:2 "1. Home").
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<HomeBloc>()..add(const HomeLoadRequested()),
        child: const _HomeView(),
      );
}

class _HomeView extends StatefulWidget {
  const _HomeView();
  @override
  State<_HomeView> createState() => _HomeViewState();
}

class _HomeViewState extends State<_HomeView> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    // the "now" card follows the clock
    _tick = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  // pull to refresh: re-read (Firestore already keeps the data live)
  Future<void> _refresh() async {
    final bloc = context.read<HomeBloc>()..add(const HomeLoadRequested());
    await bloc.stream.firstWhere((s) => s.status != HomeStatus.loading).timeout(const Duration(seconds: 5), onTimeout: () => bloc.state);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<HomeBloc>().state;
    final school = context.watch<SchoolBloc>().state;
    final now = schoolNow();
    final today = state.periodsOf(now.day);
    final pending = state.open;
    final top = <Widget>[
      _GreetingCard(teacher: school.teacher),
      SizedBox(height: 16.h),
      NowCard(now: now, today: today, classOf: (id) => id == null ? null : school.classById(id)),
      SectionHeader("Today's Schedule", icon: Icons.calendar_today_outlined, action: 'View Timetable', onAction: () => context.go(RoutePaths.timetable)),
      ScheduleStrip(now: now, today: today, onTap: () => context.go(RoutePaths.timetable)),
    ];
    final tasks = <Widget>[
      SectionHeader('Pending Action Tasks', icon: Icons.assignment_late_outlined, action: 'View All', onAction: () => context.go(RoutePaths.tasks)),
      Align(
        alignment: Alignment.centerLeft,
        child: Padding(padding: EdgeInsets.only(bottom: 8.h, left: 2.w), child: Pill('${pending.length} Pending', tone: Tone.danger)),
      ),
      if (pending.isEmpty && state.status == HomeStatus.loaded) AppCard(child: Center(child: Text('All caught up!', style: T.bodyStrong))),
      for (final p in pending) _PendingCard(p),
    ];
    final classes = <Widget>[
      SectionHeader('My Assigned Classes', icon: Icons.groups_outlined, action: '${school.classes.length} Classes', onAction: () => context.go(RoutePaths.classes)),
      for (final c in school.classes) _ClassCard(c, today: state.today[c.id]),
    ];
    final actions = <Widget>[const SectionHeader('Quick Actions'), const _QuickActions()];
    final reminders = <Widget>[
      SectionHeader('Duties & Reminders', icon: Icons.notifications_active_outlined, action: 'View All', onAction: () => context.push(RoutePaths.duties)),
      for (final r in state.reminders) _ReminderCard(r),
    ];
    final quote = <Widget>[
      SizedBox(height: 14.h),
      PanelCard(
        child: Column(children: [
          Text('“Teaching is the greatest act of optimism.”', textAlign: TextAlign.center, style: T.h3.copyWith(fontStyle: FontStyle.italic)),
          SizedBox(height: 6.h),
          Text('DAILY INSPIRATION • HAVE A WONDERFUL DAY!', textAlign: TextAlign.center, style: T.caps.copyWith(fontSize: 10.sp)),
        ]),
      ),
    ];
    return Column(children: [
        const TeacherTabHeader(title: 'Teacher Portal', eyebrow: 'EDUADMIN'),
        Expanded(
          child: AppTabBody(
            onRefresh: _refresh,
            // phones: the original order; wide screens: today on the left, work lists on the right
            narrow: [...top, ...tasks, ...classes, ...actions, ...reminders, ...quote],
            side: [...tasks, ...classes, ...reminders],
            children: [...top, ...actions, ...quote],
          ),
        ),
      ]);
  }
}

class _GreetingCard extends StatelessWidget {
  const _GreetingCard({required this.teacher});
  final Teacher? teacher;

  String _greeting() {
    final h = DateTime.now().hour;
    return h < 12 ? 'Good Morning' : (h < 17 ? 'Good Afternoon' : 'Good Evening');
  }

  @override
  Widget build(BuildContext context) {
    final t = teacher;
    final name = t?.name ?? 'Teacher';
    final shortName = name.split(' ').take(2).join(' ');
    return AppCard(
      onTap: () => context.push(RoutePaths.profile), radius: R.xl, padding: EdgeInsets.all(16.r),
      child: Row(children: [
        Avatar(name, size: 56, online: true),
        SizedBox(width: 12.w),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
              decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: C.panelBorder)),
              child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text('${t?.school ?? ''} • ${t?.year ?? ''} (${t?.term ?? ''})', style: T.small.copyWith(fontSize: 10.5.sp, color: C.primary), maxLines: 1)),
            ),
            SizedBox(height: 6.h),
            Text('${_greeting()}, $shortName', style: T.h1.copyWith(fontSize: 17.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
            Text('${t?.title ?? ''} • ${t?.subjects ?? ''}', style: T.body.copyWith(fontSize: 12.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
          ]),
        ),
      ]),
    );
  }
}

class _PendingCard extends StatelessWidget {
  const _PendingCard(this.p);
  final PendingTask p;
  @override
  Widget build(BuildContext context) {
    final tone = Tone.values.asNameMap()[p.tone] ?? Tone.brand;
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppCard(
        radius: R.lg, onTap: () => openRoute(context, p.route),
        padding: EdgeInsets.fromLTRB(16.w, 14.h, 4.w, 14.h),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Pill(p.tag, tone: tone)), SizedBox(width: 8.w),
                Expanded(child: Text(p.due, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
              ]),
              SizedBox(height: 8.h),
              Text(p.title, style: T.h3.copyWith(fontSize: 14.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
              SizedBox(height: 2.h),
              Text(p.desc, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
            ]),
          ),
          IconButton(
            tooltip: 'Mark done', icon: Icon(Icons.check_circle_outline_rounded, color: C.success, size: 24.r),
            onPressed: () {
              context.read<HomeBloc>().add(HomeTaskCompleted(p.id));
              AppDialogs.showSnackBar(context, message: 'Task marked as done');
            },
          ),
        ]),
      ),
    );
  }
}

class _ClassCard extends StatelessWidget {
  const _ClassCard(this.c, {this.today});
  /// Today's submitted attendance; null when the class has not been marked yet.
  final AttCounts? today;
  final SchoolClass c;
  @override
  Widget build(BuildContext context) {
    final t = today;
    Widget stat(String v, String l) => Expanded(child: Column(children: [Text(v, style: T.stat.copyWith(fontSize: 18.sp)), Text(l, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)]));
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppCard(
        radius: R.lg, onTap: () => context.go(RoutePaths.classes),
        child: Column(children: [
          Row(children: [
            Container(
              width: 44.r, height: 44.r, alignment: Alignment.center,
              decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.md)),
              child: Text('${c.grade}${c.section}', style: T.h3.copyWith(color: C.primary)),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text('Class ${c.grade} – Section ${c.section}', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  if (c.classTeacher) ...[SizedBox(width: 8.w), const Flexible(child: Pill('Class Incharge', tone: Tone.success))],
                ]),
                Text('${c.students} Students • ${c.subject}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              ]),
            ),
          ]),
          if (c.classTeacher) ...[
            SizedBox(height: 12.h),
            Row(children: [
              stat(t == null ? '—' : '${t.present + t.late}', t == null ? 'Not marked' : 'Present Today'),
              stat(t == null ? '—' : '${t.absent}', 'Absent'),
              stat('${c.attendance.round()}%', 'Term Avg'),
            ]),
          ],
        ]),
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions();
  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.how_to_reg_outlined, 'Attendance', RoutePaths.attendanceMark, Tone.brand),
      (Icons.edit_note_rounded, 'Enter\nMarks', RoutePaths.marksEnter, Tone.purple),
      (Icons.beach_access_outlined, 'Apply\nLeave', RoutePaths.leaveApply, Tone.warning),
      (Icons.campaign_outlined, 'Circulars', RoutePaths.circulars, Tone.success),
    ];
    return Row(children: [
      for (final i in items)
        Expanded(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 4.w),
            child: Semantics(
              button: true, label: i.$2.replaceAll('\n', ' '),
              child: AppCard(
                onTap: () => context.push(i.$3), radius: R.lg, padding: EdgeInsets.symmetric(vertical: 14.h, horizontal: 4.w),
                child: Column(children: [
                  IconTile(i.$1, tone: i.$4, size: 40), SizedBox(height: 8.h),
                  Text(i.$2, textAlign: TextAlign.center, style: T.smallStrong.copyWith(fontSize: 11.5.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
                ]),
              ),
            ),
          ),
        ),
    ]);
  }
}

class _ReminderCard extends StatelessWidget {
  const _ReminderCard(this.r);
  final Reminder r;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 10.h),
        child: AppCard(
          onTap: () => openRoute(context, r.route), radius: R.lg,
          child: Row(children: [
            const IconTile(Icons.event_outlined, tone: Tone.purple),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(r.title, style: T.h3.copyWith(fontSize: 14.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
                Text(r.place, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              ]),
            ),
            SizedBox(width: 8.w),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: 90.w),
              child: Text(r.time, style: T.smallStrong.copyWith(color: C.primary), textAlign: TextAlign.end, maxLines: 2, overflow: TextOverflow.ellipsis),
            ),
          ]),
        ),
      );
}
