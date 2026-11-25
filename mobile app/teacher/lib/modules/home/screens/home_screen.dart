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
import '../../attendance/models/attendance_models.dart' show AttCounts;
import '../models/home_models.dart';
import '../models/timetable_models.dart';
import '../../attendance/screens/widgets/circular_widgets.dart';
import 'widgets/home_checkin_card.dart';
import 'widgets/home_now_card.dart';
import 'widgets/teacher_tab_header.dart';

/// Home tab. Top to bottom: who and when, the teacher's own check-in, what is happening now, the four things a teacher does most, today's
/// periods, one list of everything that needs a reply or an action, the teacher's classes, then duties and reminders.
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
    final items = attentionItems(state, school.classes, now);
    final top = <Widget>[
      _GreetingBar(teacher: school.teacher, now: now),
      SizedBox(height: 14.h),
      const HomeCheckInCard(),
      SizedBox(height: 14.h),
      NowCard(now: now, today: today, classOf: (id) => id == null ? null : school.classById(id)),
      SizedBox(height: 16.h),
      const _QuickActions(),
      SectionHeader("Today's Schedule", icon: Icons.calendar_today_outlined, action: 'View Timetable', onAction: () => context.go(RoutePaths.timetable)),
      ScheduleStrip(now: now, today: today, onTap: () => context.go(RoutePaths.timetable)),
      if (state.latestCircular != null) ...[
        SectionHeader('Latest Circular', icon: Icons.campaign_outlined, action: 'View all', onAction: () => context.push(RoutePaths.circulars)),
        CircularTile(state.latestCircular!, highlight: true),
      ],
    ];
    final attention = <Widget>[
      SectionHeader('Needs your attention', icon: Icons.assignment_late_outlined, action: 'All tasks', onAction: () => context.push(RoutePaths.tasks)),
      if (state.status == HomeStatus.loaded && items.isEmpty)
        AppCard(
          radius: R.lg,
          child: Row(children: [
            const IconTile(Icons.check_circle_outline_rounded, tone: Tone.success),
            SizedBox(width: 12.w),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('All caught up', style: T.h3), Text('Nothing is waiting for you right now.', style: T.small),
            ])),
          ]),
        )
      else
        AppCard(
          radius: R.lg, padding: EdgeInsets.zero,
          child: Column(children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) Divider(height: 1, color: C.border),
              _AttentionRow(items[i]),
            ],
          ]),
        ),
    ];
    final classes = <Widget>[
      SectionHeader('My Classes', icon: Icons.groups_outlined, action: 'View all', onAction: () => context.go(RoutePaths.classes)),
      _ClassStrip(classes: school.classes, today: state.today, drafts: state.drafts),
    ];
    final reminders = <Widget>[
      if (state.reminders.isNotEmpty) ...[
        SectionHeader('Duties & Reminders', icon: Icons.event_outlined, action: 'View all', onAction: () => context.push(RoutePaths.duties)),
        for (final r in state.reminders.take(3)) _ReminderCard(r),
      ],
    ];
    return Column(children: [
        const TeacherTabHeader(title: 'Edvio Teacher', eyebrow: 'EDUADMIN', bell: true),
        Expanded(
          child: AppTabBody(
            onRefresh: _refresh,
            // phones: one column; wide screens: today on the left, the work lists on the right
            narrow: [...top, ...attention, ...classes, ...reminders],
            side: [...attention, ...classes, ...reminders],
            children: top,
          ),
        ),
      ]);
  }
}

/// One row of the "Needs your attention" list.
class AttentionItem {
  const AttentionItem({required this.id, required this.icon, required this.tone, required this.title, required this.sub, required this.route, this.taskId});
  final String id, title, sub, route;
  final IconData icon;
  final Tone tone;
  /// Set for pending action tasks (`hm_pending`), which can be ticked off from the list.
  final String? taskId;
}

/// Substitutions waiting for a reply, class-teacher classes not yet marked once the school day has started, then the
/// pending action tasks. Pure, so it is unit-testable.
List<AttentionItem> attentionItems(HomeState state, List<SchoolClass> classes, SchoolNow now) {
  final items = <AttentionItem>[];
  for (final s in state.subs.where((s) => s.status == SubStatus.pending)) {
    final when = s.day == now.day ? 'Today' : (s.day > now.day ? kDayShort[s.day - 1] : 'Earlier this week');
    items.add(AttentionItem(
      id: 'sub_${s.id}', icon: Icons.swap_horiz_rounded, tone: Tone.warning, title: 'Substitution: ${s.classLabel} ${s.subject}',
      sub: '$when • Period ${s.slot.replaceFirst('P', '')} ${t12(slotOf(s.slot).start)} • Accept or decline', route: RoutePaths.substitution(s.id),
    ));
  }
  final started = kSlots.isNotEmpty && now.minute >= kSlots.first.startMin && schoolWorkingDays.contains(now.day);
  if (started) {
    for (final c in classes.where((c) => c.classTeacher && !state.today.containsKey(c.id))) {
      final draft = state.drafts.contains(c.id);
      items.add(AttentionItem(
        id: 'att_${c.id}', icon: Icons.how_to_reg_outlined, tone: draft ? Tone.warning : Tone.danger,
        title: '${draft ? 'Finish attendance' : 'Mark attendance'} • Class ${c.grade}-${c.section}',
        sub: draft ? 'Draft saved • Submit to finish' : '${c.students} students • Not marked today', route: RoutePaths.markAttendance(classId: c.id),
      ));
    }
  }
  for (final p in state.open) {
    final tone = Tone.values.asNameMap()[p.tone] ?? Tone.brand;
    items.add(AttentionItem(id: 'task_${p.id}', icon: Icons.task_alt_rounded, tone: tone, title: p.title, sub: [p.tag, p.due].where((s) => s.isNotEmpty).join(' • '), route: p.route, taskId: p.id));
  }
  return items;
}

class _GreetingBar extends StatelessWidget {
  const _GreetingBar({required this.teacher, required this.now});
  final Teacher? teacher;
  final SchoolNow now;

  String _greeting() {
    final h = now.at.hour;
    return h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening');
  }

  @override
  Widget build(BuildContext context) {
    final t = teacher;
    final shortName = (t?.name ?? 'Teacher').split(' ').take(2).join(' ');
    final date = '${kDayLong[now.at.weekday - 1]}, ${dayMonth(now.at)} • ${termWeekLabel(now.at)}';
    return Semantics(
      button: true, label: 'Profile',
      child: InkWell(
        onTap: () => context.push(RoutePaths.profile), borderRadius: BorderRadius.circular(R.lg),
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 4.h, horizontal: 2.w),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${_greeting()}, $shortName', style: T.h1, maxLines: 1, overflow: TextOverflow.ellipsis),
                SizedBox(height: 2.h),
                Text(date, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                if ((t?.title ?? '').isNotEmpty) Text(t!.title, style: T.small.copyWith(color: C.primary), maxLines: 1, overflow: TextOverflow.ellipsis),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _AttentionRow extends StatelessWidget {
  const _AttentionRow(this.item);
  final AttentionItem item;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: () => openRoute(context, item.route),
        child: Padding(
          padding: EdgeInsets.fromLTRB(14.w, 12.h, 6.w, 12.h),
          child: Row(children: [
            IconTile(item.icon, tone: item.tone, size: 36),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(item.title, style: T.h3.copyWith(fontSize: 14.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
                SizedBox(height: 2.h),
                Text(item.sub, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
              ]),
            ),
            if (item.taskId != null)
              IconButton(
                tooltip: 'Mark done', icon: Icon(Icons.check_circle_outline_rounded, color: C.success, size: 24.r),
                onPressed: () {
                  context.read<HomeBloc>().add(HomeTaskCompleted(item.taskId!));
                  AppDialogs.showSnackBar(context, message: 'Task marked as done');
                },
              )
            else
              Icon(Icons.chevron_right_rounded, color: C.muted, size: 24.r),
          ]),
        ),
      );
}

/// Horizontal cards: one per class, with today's attendance state for the classes the teacher is in charge of.
class _ClassStrip extends StatelessWidget {
  const _ClassStrip({required this.classes, required this.today, required this.drafts});
  final List<SchoolClass> classes;
  final Map<String, AttCounts> today;
  final Set<String> drafts;
  @override
  Widget build(BuildContext context) {
    if (classes.isEmpty) return const AppCard(child: AppEmptyState('No classes assigned yet', hint: 'Your classes appear here once the office assigns them.'));
    return SizedBox(
      height: 124.h,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.only(right: 4.w),
        itemCount: classes.length,
        separatorBuilder: (_, _) => SizedBox(width: 10.w),
        itemBuilder: (_, i) {
          final c = classes[i];
          final t = today[c.id];
          final marked = t != null;
          return SizedBox(
            width: 168.w,
            child: AppCard(
              radius: R.lg, padding: EdgeInsets.all(12.r), onTap: () => context.go(RoutePaths.classes),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Row(children: [
                  Container(
                    width: 36.r, height: 36.r, alignment: Alignment.center,
                    decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.md)),
                    child: Text('${c.grade}${c.section}', style: T.smallStrong.copyWith(color: C.primary)),
                  ),
                  SizedBox(width: 8.w),
                  Expanded(child: Text(c.subject, style: T.smallStrong, maxLines: 2, overflow: TextOverflow.ellipsis)),
                ]),
                Text('${c.students} students', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                if (c.classTeacher)
                  Pill(marked ? '${t.present + t.late}/${c.students} present' : drafts.contains(c.id) ? 'Draft saved • submit' : 'Not marked today', tone: marked ? Tone.success : drafts.contains(c.id) ? Tone.warning : Tone.danger)
                else
                  const Pill('Subject teacher', tone: Tone.neutral),
              ]),
            ),
          );
        },
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
