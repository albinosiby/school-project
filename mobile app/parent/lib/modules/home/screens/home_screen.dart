import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../family/models/family_models.dart';
import '../../family/screens/widgets/parent_tab_header.dart';
import '../../live_classes/bloc/live_classes_bloc.dart';
import '../../live_classes/screens/widgets/live_class_card.dart';
import '../bloc/home_bloc.dart';
import '../models/home_models.dart';
import 'widgets/home_attendance_card.dart';
import 'widgets/home_bus_card.dart';
import 'widgets/home_child_card.dart';
import 'widgets/home_feed.dart';
import 'widgets/home_schedule.dart';

/// Figma "1. Home": child card with switcher, live bus, today's attendance, quick actions, today's
/// schedule, live class, homework, announcements and support, for the selected child.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) => BlocProvider<LiveClassesBloc>(
    create: (_) => getIt<LiveClassesBloc>(), // only used to record Join taps
    child: ColoredBox(
      color: C.surface,
      child: Column(
        children: [
          const ParentTabHeader(title: 'Home'),
          Expanded(
            child: ChildDataView<HomeBloc, HomeSummary>(
              create: () => getIt<HomeBloc>(),
              builder: (context, s, child) =>
                  _HomeBody(summary: s, child: child),
            ),
          ),
        ],
      ),
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
    final s = summary;
    final tasks = [...s.homeworkDue, ...s.homeworkInReview].take(3).toList();
    return AppTabBody(
      children: [
        HomeChildCard(child: child),
        if (s.bus != null) ...[
          SizedBox(height: 14.h),
          HomeBusCard(trip: s.bus!),
        ],
        SizedBox(height: 14.h),
        HomeAttendanceCard(summary: s),
        const HomeSectionTitle('Quick Actions'),
        Row(
          children: [
            for (final (i, a) in [
              (
                Icons.account_balance_wallet_outlined,
                'Pay Fees',
                () => context.go(RoutePaths.fees),
              ),
              (
                Icons.event_busy_outlined,
                'Apply\nLeave',
                () => context.push(RoutePaths.leaveApply),
              ),
              (
                Icons.forum_outlined,
                'Teacher\nChat',
                () => context.go(RoutePaths.messages),
              ),
              (
                Icons.workspace_premium_outlined,
                'Behaviour',
                () => context.push(RoutePaths.behaviour),
              ),
            ].indexed) ...[
              if (i > 0) SizedBox(width: 8.w),
              Expanded(
                child: AppQuickAction(icon: a.$1, label: a.$2, onTap: a.$3),
              ),
            ],
          ],
        ),
        HomeSectionTitle(
          "Today's Schedule",
          sub: DateFormat('EEEE, d MMMM').format(now),
          action: 'Timetable',
          onAction: () => context.go(RoutePaths.academicsSection('timetable')),
        ),
        HomeSchedule(periods: s.periods, isSchoolDay: s.isSchoolDay, now: now),
        if (s.nextLiveClass != null) ...[
          HomeSectionTitle(
            'Live Class',
            action: 'All',
            onAction: () => context.push(RoutePaths.liveClasses),
          ),
          LiveClassCard(
            item: s.nextLiveClass!,
            onJoin: () => joinLiveClass(context, s.nextLiveClass!),
          ),
        ],
        HomeSectionTitle(
          'Homework & Tasks',
          trailing: s.homeworkDue.isEmpty
              ? null
              : Pill('${s.homeworkDue.length} Pending', tone: Tone.warning),
          action: 'All Tasks',
          onAction: () => context.go(RoutePaths.academicsSection('homework')),
        ),
        if (tasks.isEmpty)
          AppElevatedCard(
            child: Center(
              child: AppEmptyState(
                'All caught up',
                hint: 'No homework due today or tomorrow.',
                icon: Icons.task_alt_rounded,
              ),
            ),
          )
        else
          for (final h in tasks) HomeTaskRow(homework: h, now: now),
        HomeSectionTitle(
          'Announcements & Events',
          action: 'PTM Schedule',
          onAction: () => context.push(RoutePaths.ptm),
        ),
        if (s.notices.isEmpty)
          AppElevatedCard(
            child: Center(
              child: AppEmptyState(
                'No announcements',
                icon: Icons.campaign_outlined,
              ),
            ),
          )
        else
          for (final (i, n) in s.notices.indexed)
            HomeNoticeCard(notice: n, hero: i == 0),
        SizedBox(height: 10.h),
        const HomeSupportCard(),
      ],
    );
  }
}
