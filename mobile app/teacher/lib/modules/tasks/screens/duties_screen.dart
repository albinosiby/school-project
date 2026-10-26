import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/duties_bloc.dart';
import '../bloc/duties_events.dart';
import '../bloc/duties_states.dart';
import '../models/duty_models.dart';
import '../models/tasks_format.dart';
import 'widgets/duty_card.dart';

/// Duties & Reminders (Figma 1153:20523): week navigator, type filters, summary, duty cards and grading deadlines.
class DutiesScreen extends StatelessWidget {
  const DutiesScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(create: (_) => getIt<DutiesBloc>()..add(const DutiesLoadRequested()), child: const _DutiesView());
}

class _DutiesView extends StatefulWidget {
  const _DutiesView();
  @override
  State<_DutiesView> createState() => _DutiesViewState();
}

class _DutiesViewState extends State<_DutiesView> {
  String _filter = 'all';
  int _week = 0;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<DutiesBloc>().state;
    return DetailScaffold(
      title: 'Duties & Reminders',
      fallbackRoute: RoutePaths.tasks,
      actions: [
        IconButton(tooltip: 'Add reminder', onPressed: () => context.push(RoutePaths.taskAdd), icon: Icon(Icons.add_alarm_rounded, color: C.primary, size: 24.r)),
      ],
      body: switch (s.status) {
        DutiesStatus.loaded => _list(s),
        DutiesStatus.failure => AppErrorWidget(message: s.error ?? 'Could not load duties', onRetry: () => context.read<DutiesBloc>().add(const DutiesLoadRequested())),
        _ => const Center(child: CircularProgressIndicator()),
      },
    );
  }

  Widget _list(DutiesState s) {
    final start = dayOf(DateTime.now()).add(Duration(days: 7 * _week));
    final end = start.add(const Duration(days: 6));
    bool inWeek(DateTime? d) => d != null && !dayOf(d).isBefore(start) && !dayOf(d).isAfter(end);
    final duties = [for (final d in s.duties) if (inWeek(d.startAt)) d]..sort((a, b) => a.startAt!.compareTo(b.startAt!));

    final hws = s.gradingDeadlines;
    final showDeadlines = _week == 0;
    final deadlineCount = showDeadlines ? hws.length + 1 : 0;
    final exams = duties.where((d) => d.type == 'exam').length, meets = duties.where((d) => d.type == 'meeting').length;
    final labels = {
      'all': 'All (${duties.length + deadlineCount})', 'exam': 'Exam Duty ($exams)', 'meeting': 'Staff Meetings ($meets)', 'tasks': 'Tasks & Grading ($deadlineCount)',
    };
    final keys = labels.keys.toList();

    bool match(Duty d) => _filter == 'all' || d.type == _filter;
    final todayL = [for (final d in duties) if (_week == 0 && d.isToday) d];
    final upcoming = [for (final d in duties) if (!todayL.contains(d)) d];
    final todayShown = todayL.where(match).toList(), upShown = upcoming.where(match).toList();
    final showTasks = (_filter == 'all' || _filter == 'tasks') && showDeadlines;

    final doneToday = todayL.where((d) => d.isDone).length;
    final next = upcoming.where((d) => !d.isDone).length;
    final dues = [for (final h in hws) ?DateTime.tryParse(h.due)]..sort();
    final teacher = s.teacher;

    final kids = <Widget>[
      Row(children: [
        Flexible(child: Pill(teacher?.term ?? 'Term 2', tone: Tone.brand, dot: true)),
        SizedBox(width: 8.w),
        const Spacer(),
        Icon(Icons.cloud_done_outlined, size: 16.r, color: C.successDark), SizedBox(width: 4.w),
        Text('Auto-saved just now', style: T.small.copyWith(color: C.successDark)),
      ]),
      SizedBox(height: 12.h),
      AppCard(
        radius: R.lg, padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
        child: Row(children: [
          Padding(padding: EdgeInsets.all(6.w), child: IconTile(Icons.calendar_month_outlined, size: 32)),
          Expanded(
            child: Text('${_week == 0 ? 'This Week' : 'Week of ${fmtShort(start)}'}: ${fmtShort(start)} – ${fmtShort(end)}',
                style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
          IconButton(tooltip: 'Previous week', onPressed: () => setState(() => _week--), icon: Icon(Icons.chevron_left_rounded, size: 24.r)),
          IconButton(tooltip: 'Next week', onPressed: () => setState(() => _week++), icon: Icon(Icons.chevron_right_rounded, size: 24.r)),
        ]),
      ),
      SizedBox(height: 14.h),
      FilterChips(items: labels.values.toList(), value: labels[_filter]!, onChanged: (v) => setState(() => _filter = keys[labels.values.toList().indexOf(v)])),
      SizedBox(height: 14.h),
      AppCard(
        radius: R.lg, padding: EdgeInsets.symmetric(vertical: 14.h),
        child: IntrinsicHeight(
          child: Row(children: [
            _Sum('${todayL.length}', 'Today', '$doneToday Completed', C.ink),
            const VerticalDivider(width: 1, color: C.border),
            _Sum('$next', 'Next', 'This Week', C.primary),
            const VerticalDivider(width: 1, color: C.border),
            _Sum('${hws.length}', 'Due', dues.isEmpty ? 'Nothing pending' : '${fmtShort(dues.first)} Grading', C.danger),
          ]),
        ),
      ),
    ];

    if (todayShown.isNotEmpty) {
      kids.add(_Head("TODAY'S ASSIGNED DUTIES", '${todayShown.length} Items', accent: true));
      kids.addAll([for (final d in todayShown) DutyCard(d, key: ValueKey(d.id))]);
    }
    if (upShown.isNotEmpty) {
      kids.add(_Head(_week == 0 ? 'UPCOMING DUTIES & INVIGILATION' : 'DUTIES & INVIGILATION', '${fmtShort(start)} – ${fmtShort(end)}'));
      kids.addAll([for (final d in upShown) DutyCard(d, key: ValueKey(d.id))]);
    }
    if (showTasks) {
      kids.add(_Head('ACADEMIC DEADLINES & GRADING', '${hws.length} Pending'));
      for (final h in hws) {
        final st = s.statsOf(h);
        kids.add(HomeworkDeadlineCard(
          key: ValueKey(h.id), homework: h, classGrade: s.classGrade(h.classId), graded: st.graded, turnedIn: st.turnedIn, toGrade: st.toGrade, evaluatedPct: st.evaluatedPct,
        ));
      }
      kids.add(SyllabusLogCard(homeworkId: s.progressHomeworkId, submitted: s.syllabus.submitted, due: parseDt(s.syllabus.due)));
    }
    if (todayShown.isEmpty && upShown.isEmpty && !showTasks) {
      kids.add(const AppEmptyState('No duties here', hint: 'Nothing assigned for this filter and week.', icon: Icons.event_available_outlined));
    }
    kids.add(Padding(
      padding: EdgeInsets.only(top: 14.h),
      child: PanelCard(
        padding: EdgeInsets.all(14.w),
        child: Row(children: [
          Icon(Icons.info_outline_rounded, color: C.primary, size: 22.r), SizedBox(width: 10.w),
          Expanded(child: Text('Need a substitution? Duty swap requests must be submitted at least 24 hours prior to department coordinator.', style: T.small)),
        ]),
      ),
    ));

    return ListView(padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 32.h), children: kids);
  }
}

class _Sum extends StatelessWidget {
  const _Sum(this.value, this.label, this.sub, this.color);
  final String value, label, sub;
  final Color color;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 4.w),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            FittedBox(fit: BoxFit.scaleDown, child: Text('$value $label', style: T.h2.copyWith(color: color))),
            SizedBox(height: 2.h),
            Text(sub, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
          ]),
        ),
      );
}

class _Head extends StatelessWidget {
  const _Head(this.title, this.trailing, {this.accent = false});
  final String title, trailing;
  final bool accent;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(2.w, 22.h, 2.w, 12.h),
        child: Row(children: [
          Container(width: 10.r, height: 10.r, decoration: BoxDecoration(color: accent ? C.primary : C.muted, shape: BoxShape.circle)),
          SizedBox(width: 8.w),
          Expanded(child: Text(title, style: T.smallStrong.copyWith(letterSpacing: .6), maxLines: 1, overflow: TextOverflow.ellipsis)),
          Text(trailing, style: T.small.copyWith(color: accent ? C.primary : C.slate, fontWeight: FontWeight.w700)),
        ]),
      );
}
