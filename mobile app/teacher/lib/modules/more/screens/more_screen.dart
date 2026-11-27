import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../home/screens/widgets/teacher_tab_header.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/more_bloc.dart';
import '../bloc/more_events.dart';
import 'widgets/more_module_card.dart';

/// Figma 1153:1319 "5. More": the teacher's profile strip, then every secondary tool as grouped rows
/// with a colour per tool and live counts.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MoreBloc>()..add(const MoreLoadRequested()),
        child: const _MoreView(),
      );
}

class _MoreView extends StatelessWidget {
  const _MoreView();

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final me = school.teacher;
    final s = context.watch<MoreBloc>().state.summary;
    void push(String r) => context.push(r);
    String? count(int n, String word) => n > 0 ? '$n $word' : null;
    String? text(String v) => v.isEmpty ? null : v;

    final groups = <(String, List<MoreModule>)>[
      ('Teaching', [
        MoreModule('Lesson Plans', 'Plan and track lessons', Icons.menu_book_rounded, () => push(RoutePaths.lessonPlans),
            tone: Tone.brand, badge: count(s.activePlans, 'active'), badgeTone: Tone.brand),
        MoreModule('Online Tests', 'Quizzes and term exams', Icons.quiz_outlined, () => push(RoutePaths.tests),
            tone: Tone.purple, badge: count(s.upcomingTests, 'upcoming'), badgeTone: Tone.purple),
        MoreModule('Live Classes', 'Virtual classrooms', Icons.videocam_outlined, () => push(RoutePaths.liveClasses),
            tone: Tone.danger, badge: text(s.nextLive), badgeTone: Tone.success),
        MoreModule('Enter Marks', 'Record exam and test marks', Icons.edit_note_rounded, () => push(RoutePaths.marksEnter), tone: Tone.warning),
        MoreModule('Assignments', 'Set, schedule and review assignments', Icons.assignment_outlined, () => push(RoutePaths.assignments),
            tone: Tone.success, badge: count(s.openTasks, 'open'), badgeTone: Tone.warning),
      ]),
      ('Communication', [
        MoreModule('Circulars', 'School notices and announcements', Icons.campaign_outlined, () => push(RoutePaths.circulars), tone: Tone.warning),
        MoreModule('Parent–Teacher Meetings', 'Slots and appointments', Icons.groups_2_outlined, () => push(RoutePaths.meetings),
            tone: Tone.brand, badge: text(s.meetingBadge), badgeTone: Tone.brand),
      ]),
      ('Staff services', [
        MoreModule('Leave Management', 'Balance, history and requests', Icons.event_available_outlined, () => push(RoutePaths.leaveManagement),
            tone: Tone.success, badge: text(s.leaveBadge), badgeTone: Tone.success),
        MoreModule('Exam Duties', 'Invigilation and halls', Icons.fact_check_outlined, () => push(RoutePaths.examDuties),
            tone: Tone.purple, badge: text(s.dutyBadge), badgeTone: Tone.brand),
      ]),
    ];

    return Column(children: [
      const TeacherTabHeader(title: 'More', subtitle: 'Tools and services', icon: Icons.grid_view_rounded),
      Expanded(
        child: AppTabBody(
          children: [
            _ProfileStrip(name: me?.name ?? 'Teacher', line: [if ((me?.designation ?? '').isNotEmpty) me!.designation, if ((me?.empId ?? '').isNotEmpty) me!.empId].join(' • '), photo: me?.photo ?? ''),
            for (final (title, modules) in groups) MoreGroup(title: title, modules: modules),
            SizedBox(height: 16.h),
            Center(child: Text(me?.school ?? '', style: T.small.copyWith(color: C.muted), textAlign: TextAlign.center)),
          ],
        ),
      ),
    ]);
  }
}

/// Who is signed in, with a shortcut to the Profile page.
class _ProfileStrip extends StatelessWidget {
  const _ProfileStrip({required this.name, required this.line, required this.photo});
  final String name, line, photo;
  @override
  Widget build(BuildContext context) => PanelCard(
        padding: EdgeInsets.all(14.r),
        onTap: () => context.push(RoutePaths.profile),
        child: Row(children: [
          Avatar(name, size: 52, online: true, image: photo.isEmpty ? null : photo),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
              if (line.isNotEmpty) ...[SizedBox(height: 2.h), Text(line, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)],
              SizedBox(height: 6.h),
              Text('View profile & settings', style: T.smallStrong.copyWith(color: C.primary)),
            ]),
          ),
          Icon(Icons.chevron_right_rounded, color: C.primary, size: 24.r),
        ]),
      );
}
