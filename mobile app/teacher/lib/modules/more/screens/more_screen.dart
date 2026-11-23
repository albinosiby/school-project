import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../auth/screens/widgets/sign_out_tile.dart';
import '../../home/screens/widgets/teacher_tab_header.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/more_bloc.dart';
import '../bloc/more_events.dart';
import 'widgets/more_module_card.dart';

/// Figma 1153:1319 "5. More": every secondary tool as a grid of tiles grouped by area, with live counts.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MoreBloc>()..add(const MoreLoadRequested()),
        child: const _MoreView(),
      );
}

class _Section {
  const _Section(this.title, this.icon, this.tone, this.modules);
  final String title;
  final IconData icon;
  final Tone tone;
  final List<MoreModule> modules;
}

class _MoreView extends StatefulWidget {
  const _MoreView();
  @override
  State<_MoreView> createState() => _MoreViewState();
}

class _MoreViewState extends State<_MoreView> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final me = school.teacher;
    final s = context.watch<MoreBloc>().state.summary;
    void push(String r) => context.push(r);
    String? count(int n, String word, {String? zero}) => n > 0 ? '$n $word' : zero;

    final sections = <_Section>[
      _Section('Teaching', Icons.menu_book_rounded, Tone.brand, [
        MoreModule('Lesson Plans', 'Plan and track lessons', Icons.menu_book_rounded, () => push(RoutePaths.lessonPlans),
            badge: count(s.activePlans, 'active'), badgeTone: Tone.brand),
        MoreModule('Online Tests', 'Quizzes and term exams', Icons.quiz_outlined, () => push(RoutePaths.tests),
            badge: count(s.upcomingTests, 'upcoming'), badgeTone: Tone.brand),
        MoreModule('Live Classes', 'Virtual classrooms', Icons.videocam_outlined, () => push(RoutePaths.liveClasses),
            badge: s.nextLive.isEmpty ? null : s.nextLive, badgeTone: Tone.success),
        MoreModule('Enter Marks', 'Record exam and test marks', Icons.edit_note_rounded, () => push(RoutePaths.marksEnter)),
        MoreModule('Assignments', 'Homework and grading', Icons.assignment_outlined, () => context.go(RoutePaths.tasks),
            badge: count(s.openTasks, 'open'), badgeTone: Tone.warning),
      ]),
      _Section('Communication', Icons.forum_outlined, Tone.purple, [
        MoreModule('Messages', 'Parents, staff and groups', Icons.chat_bubble_outline_rounded, () => push(RoutePaths.messages),
            badge: count(s.unreadMessages, 'unread'), badgeTone: Tone.danger),
        MoreModule('Circulars', 'School notices', Icons.campaign_outlined, () => push(RoutePaths.circulars)),
      ]),
      _Section('Staff services', Icons.badge_outlined, Tone.success, [
        MoreModule('Leave Management', 'Balance, history and requests', Icons.event_available_outlined, () => push(RoutePaths.leaveManagement),
            badge: s.leaveBadge.isEmpty ? null : s.leaveBadge, badgeTone: Tone.success),
        MoreModule('Student Certificates', 'Awards you issue to students', Icons.workspace_premium_outlined, () => push(RoutePaths.certificates),
            badge: count(s.pendingCertificates, 'to sign'), badgeTone: Tone.warning),
      ]),
      _Section('Coordination', Icons.groups_2_outlined, Tone.warning, [
        MoreModule('Parent–Teacher Meetings', 'Slots and appointments', Icons.groups_2_outlined, () => push(RoutePaths.meetings),
            badge: s.meetingBadge.isEmpty ? null : s.meetingBadge, badgeTone: Tone.brand),
        MoreModule('Exam Duties', 'Invigilation and halls', Icons.fact_check_outlined, () => push(RoutePaths.examDuties),
            badge: s.dutyBadge.isEmpty ? null : s.dutyBadge, badgeTone: Tone.brand),
      ]),
    ];
    final q = _q.trim().toLowerCase();
    bool hit(MoreModule m) => q.isEmpty || '${m.title} ${m.sub}'.toLowerCase().contains(q);
    final visible = [
      for (final sec in sections)
        if (sec.modules.any(hit)) _Section(sec.title, sec.icon, sec.tone, sec.modules.where(hit).toList()),
    ];

    return Column(children: [
      TeacherTabHeader(title: 'More', subtitle: '${me?.name ?? 'Teacher'} • ${me?.designation ?? ''}', icon: Icons.grid_view_rounded, avatar: true),
      Expanded(
        child: AppTabBody(
          children: [
            AppSearchField(hint: 'Search tools…', onChanged: (v) => setState(() => _q = v)),
            if (visible.isEmpty)
              AppEmptyState('No matching tools', hint: 'Try a different search term.', icon: Icons.search_off_rounded)
            else
              for (final sec in visible) ...[
                Padding(
                  padding: EdgeInsets.fromLTRB(2.w, 20.h, 2.w, 10.h),
                  child: Row(children: [
                    Icon(sec.icon, size: 16.r, color: toneColors(sec.tone).fg),
                    SizedBox(width: 6.w),
                    Expanded(child: Text(sec.title, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  ]),
                ),
                MoreTileGrid(sec.modules, tone: sec.tone),
              ],
            const SignOutTile(),
          ],
        ),
      ),
    ]);
  }
}
