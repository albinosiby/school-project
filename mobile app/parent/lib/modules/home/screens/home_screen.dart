import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../attendance/models/attendance_models.dart';
import '../../family/bloc/family_bloc.dart';
import '../../family/models/family_models.dart';
import '../../family/screens/widgets/parent_tab_header.dart';
import '../../homework/models/homework_models.dart';
import '../../live_classes/bloc/live_classes_bloc.dart';
import '../../live_classes/screens/widgets/live_class_card.dart';
import '../../notices/models/notice_models.dart';
import '../../timetable/models/timetable_models.dart';
import '../bloc/home_bloc.dart';
import '../models/home_models.dart';

String greeting([DateTime? now]) {
  final h = (now ?? DateTime.now()).hour;
  return h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening');
}

/// "Today": greeting, attendance, homework due, live class, timetable and notices for the selected child.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) => BlocProvider<LiveClassesBloc>(
    create: (_) => getIt<LiveClassesBloc>(), // only used to record Join taps
    child: Column(
      children: [
        const ParentTabHeader(title: 'Today'),
        Expanded(
          child: ChildDataView<HomeBloc, HomeSummary>(
            create: () => getIt<HomeBloc>(),
            emptyTitle: 'Nothing for today',
            builder: (context, s, child) => _HomeBody(summary: s, child: child),
          ),
        ),
      ],
    ),
  );
}

class _HomeBody extends StatelessWidget {
  const _HomeBody({required this.summary, required this.child});
  final HomeSummary summary;
  final Child child;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final guardian =
        context.watch<FamilyBloc>().state.guardian?.name ?? 'there';
    final parts = guardian.split(' ');
    final surname = parts.length > 1
        ? '${parts.first.endsWith('.') ? '${parts.first} ' : ''}${parts.last}'
        : guardian;
    return AppTabBody(
      children: [
        PanelCard(
          padding: EdgeInsets.all(16.w),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(fmtDate(now, year: true).toUpperCase(), style: T.caps),
              SizedBox(height: 4.h),
              Text('${greeting(now)}, $surname', style: T.h1),
              SizedBox(height: 4.h),
              Text(
                "Here is today for ${child.firstName} - Grade ${child.className}",
                style: T.body,
              ),
            ],
          ),
        ),
        SizedBox(height: 12.h),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _AttendanceTile(summary: summary)),
            SizedBox(width: 12.w),
            Expanded(
              child: StatTile(
                label: 'Homework due',
                value: '${summary.homeworkDue.length}',
                icon: Icons.assignment_outlined,
                tone: summary.homeworkDue.isEmpty ? Tone.success : Tone.warning,
                onTap: () => context.go(RoutePaths.learnSection('homework')),
              ),
            ),
          ],
        ),
        if (summary.nextLiveClass != null) ...[
          const SectionHeader('Live class', icon: Icons.videocam_rounded),
          LiveClassCard(
            item: summary.nextLiveClass!,
            onJoin: () => joinLiveClass(context, summary.nextLiveClass!),
          ),
        ],
        SectionHeader(
          "Today's timetable",
          icon: Icons.calendar_today_rounded,
          action: 'Week',
          onAction: () => context.go(RoutePaths.learnSection('timetable')),
        ),
        if (!summary.isSchoolDay)
          AppCard(
            child: Center(
              child: AppEmptyState(
                'No school today',
                hint: 'Enjoy the day off.',
                icon: Icons.weekend_outlined,
              ),
            ),
          )
        else if (summary.periods.isEmpty)
          AppCard(
            child: Center(
              child: AppEmptyState(
                'No periods scheduled',
                icon: Icons.event_busy_outlined,
              ),
            ),
          )
        else
          AppCard(
            padding: EdgeInsets.symmetric(vertical: 6.h),
            child: Column(
              children: [
                for (final p in summary.periods)
                  _PeriodRow(period: p, now: now),
              ],
            ),
          ),
        SectionHeader(
          'Homework due',
          icon: Icons.assignment_outlined,
          action: 'All',
          onAction: () => context.go(RoutePaths.learnSection('homework')),
        ),
        if (summary.homeworkDue.isEmpty)
          AppCard(
            child: Center(
              child: AppEmptyState(
                'All caught up',
                hint: 'No homework due today or tomorrow.',
                icon: Icons.task_alt_rounded,
              ),
            ),
          )
        else
          for (final h in summary.homeworkDue)
            _HomeworkRow(homework: h, now: now),
        SectionHeader(
          'Notices',
          icon: Icons.campaign_outlined,
          action: 'Inbox',
          onAction: () => context.go(RoutePaths.inboxSection('notices')),
        ),
        if (summary.notices.isEmpty)
          AppCard(
            child: Center(
              child: AppEmptyState('No notices', icon: Icons.campaign_outlined),
            ),
          )
        else
          for (final n in summary.notices) _NoticeRow(notice: n),
      ],
    );
  }
}

class _AttendanceTile extends StatelessWidget {
  const _AttendanceTile({required this.summary});
  final HomeSummary summary;

  @override
  Widget build(BuildContext context) {
    final r = summary.attendanceToday;
    final (value, tone) = !summary.isSchoolDay
        ? ('No school', Tone.neutral)
        : r == null
        ? ('Not marked', Tone.neutral)
        : switch (r.status) {
            AttendanceStatus.present => ('Present', Tone.success),
            AttendanceStatus.late => ('Late', Tone.warning),
            AttendanceStatus.halfDay => ('Half day', Tone.purple),
            AttendanceStatus.absent => ('Absent', Tone.danger),
            AttendanceStatus.leave => ('On leave', Tone.brand),
            AttendanceStatus.holiday => ('Holiday', Tone.neutral),
          };
    return StatTile(
      label: 'Attendance today',
      value: value,
      icon: Icons.how_to_reg_outlined,
      tone: tone,
      onTap: () => context.go(RoutePaths.attendance),
    );
  }
}

class _PeriodRow extends StatelessWidget {
  const _PeriodRow({required this.period, required this.now});
  final Period period;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final current = period.isNow(now);
    final over = period.isOver(now);
    return Container(
      color: current ? C.primarySoft : Colors.transparent,
      padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 10.h),
      child: Row(
        children: [
          SizedBox(
            width: 74.w,
            child: Text(
              fmtMinute(period.startMinute),
              style: T.smallStrong.copyWith(color: over ? C.muted : C.slate),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  period.subject,
                  style: T.bodyStrong.copyWith(color: over ? C.muted : C.ink),
                ),
                Text(
                  '${period.teacher} - ${period.room}',
                  style: T.small,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (current) const Pill('Now', tone: Tone.brand, dot: true),
        ],
      ),
    );
  }
}

class _HomeworkRow extends StatelessWidget {
  const _HomeworkRow({required this.homework, required this.now});
  final Homework homework;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final status = homework.statusAt(now);
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppCard(
        padding: EdgeInsets.all(12.w),
        onTap: () => context.push(RoutePaths.homework(homework.id)),
        child: Row(
          children: [
            IconTile(
              Icons.assignment_outlined,
              tone: status == HomeworkStatus.overdue
                  ? Tone.danger
                  : Tone.warning,
              size: 38,
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    homework.title,
                    style: T.bodyStrong,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${homework.subject} - due ${fmtDay(homework.due, now: now)}',
                    style: T.small,
                  ),
                ],
              ),
            ),
            if (status == HomeworkStatus.overdue)
              const Pill('Overdue', tone: Tone.danger),
          ],
        ),
      ),
    );
  }
}

class _NoticeRow extends StatelessWidget {
  const _NoticeRow({required this.notice});
  final Notice notice;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 10.h),
    child: AppCard(
      padding: EdgeInsets.all(12.w),
      onTap: () => context.go(RoutePaths.inboxSection('notices')),
      child: Row(
        children: [
          IconTile(
            Icons.campaign_outlined,
            tone: notice.category == NoticeCategory.urgent
                ? Tone.danger
                : Tone.brand,
            size: 38,
          ),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  notice.title,
                  style: T.bodyStrong,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                Text('${notice.from} - ${fmtDay(notice.date)}', style: T.small),
              ],
            ),
          ),
          if (notice.needsAction) const Pill('Action', tone: Tone.warning),
        ],
      ),
    ),
  );
}
