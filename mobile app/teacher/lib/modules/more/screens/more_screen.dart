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

/// Figma 1153:1319 "5. More" — hub of every secondary tool with today's teaching pulse.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MoreBloc>()..add(const MoreLoadRequested()),
        child: const _MoreView(),
      );
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
    final sections = <(String, List<MoreModule>)>[
      ('Academic & Teaching Management', [
        MoreModule('Lesson Plans', 'Class 10-B Math & Class 8-C Physics', Icons.menu_book_rounded, () => push(RoutePaths.lessonPlans),
            badge: '${s.activePlans} Active • ${s.draftPlans} Draft Pending'),
        MoreModule('Online Tests', 'Term Mid-Exams & Chapter Quizzes', Icons.quiz_outlined, () => push(RoutePaths.tests), badge: '${s.upcomingTests} Upcoming'),
        MoreModule('Live Classes', 'Virtual classrooms & doubt sessions', Icons.videocam_outlined, () => push(RoutePaths.liveClasses),
            note: s.nextLive.isEmpty ? 'No sessions scheduled' : s.nextLive, cta: 'Join Class'),
        MoreModule('Enter Marks', 'Term Mid-Exams & Chapter Quizzes', Icons.edit_note_rounded, () => push(RoutePaths.marksEnter), badge: 'Marks entry'),
        MoreModule('Assignments', 'Homework, grading & progress', Icons.assignment_outlined, () => context.go(RoutePaths.tasks), badge: 'Tasks tab'),
      ]),
      ('Communication & Messages', [
        MoreModule('Messages', 'Parents, staff & class groups', Icons.chat_bubble_outline_rounded, () => push(RoutePaths.messages),
            badge: s.unreadMessages > 0 ? '${s.unreadMessages} Unread' : 'Inbox'),
        MoreModule('Circulars', 'School notices & announcements', Icons.campaign_outlined, () => push(RoutePaths.circulars), badge: 'Notices'),
      ]),
      ('Staff Services & Administration', [
        MoreModule('Leave Management', 'Balance overview, history & requests', Icons.event_available_outlined, () => push(RoutePaths.leaveManagement),
            badge: s.leaveBadge),
        MoreModule('Certificates', 'Student character, transfer & bona fide', Icons.workspace_premium_outlined, () => push(RoutePaths.certificates),
            badge: '${s.pendingCertificates} Pending verification'),
      ]),
      ('Coordination & Meetings', [
        MoreModule('Parent–Teacher Meetings', 'Slot schedules, appointments & notes', Icons.groups_2_outlined, () => push(RoutePaths.meetings),
            badge: s.meetingBadge),
        MoreModule('Exam Duties', 'Invigilation schedules & hall allocations', Icons.fact_check_outlined, () => push(RoutePaths.examDuties),
            badge: s.dutyBadge),
      ]),
    ];
    final q = _q.trim().toLowerCase();
    bool hit(MoreModule m) => q.isEmpty || '${m.title} ${m.sub}'.toLowerCase().contains(q);
    final visible = [for (final (t, l) in sections) (t, l.where(hit).toList())].where((e) => e.$2.isNotEmpty).toList();

    return Column(children: [
      TeacherTabHeader(title: 'More', subtitle: '${me?.name ?? 'Teacher'} • ${me?.designation ?? ''}', icon: Icons.grid_view_rounded),
      Expanded(
        child: Builder(builder: (context) {
          final head = <Widget>[
          AppSearchField(hint: 'Search services, requests, or tools...', onChanged: (v) => setState(() => _q = v)),
          SizedBox(height: 16.h),
          PanelCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('TEACHER DASHBOARD', style: T.caps.copyWith(fontSize: 10.5.sp)),
                    SizedBox(height: 4.h),
                    FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text("Today's Teaching Pulse", style: T.h2, maxLines: 1)),
                  ]),
                ),
                SizedBox(width: 8.w),
                Flexible(child: Pill('${me?.term.isNotEmpty == true ? me!.term : 'Term 2'} Active', dot: true, tone: Tone.success)),
              ]),
              SizedBox(height: 14.h),
              Row(children: [
                Expanded(child: PulseTile(icon: Icons.access_time_rounded, label: 'TODAY', value: '${s.todayClasses} Classes', sub: s.nextClass, onTap: () => context.go(RoutePaths.timetable))),
                SizedBox(width: 8.w),
                Expanded(child: PulseTile(icon: Icons.task_alt_rounded, label: 'TASKS', value: '${s.openTasks} Pending', sub: 'Submissions', onTap: () => context.go(RoutePaths.tasks))),
                SizedBox(width: 8.w),
                Expanded(child: PulseTile(icon: Icons.forum_outlined, label: 'INBOX', value: '${s.unreadMessages} Unread', sub: 'Parent notes', onTap: () => push(RoutePaths.messages))),
              ]),
            ]),
          ),
          ];
          List<Widget> section(String title, List<MoreModule> mods) => [
                Padding(
                  padding: EdgeInsets.fromLTRB(4.w, 22.h, 4.w, 12.h),
                  child: Row(children: [
                    Expanded(child: Text(title.toUpperCase(), style: T.capsMuted, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    Text('${mods.length} Module${mods.length == 1 ? '' : 's'}', style: T.small),
                  ]),
                ),
                for (final m in mods) Padding(padding: EdgeInsets.only(bottom: 12.h), child: MoreModuleCard(m)),
              ];
          final empty = <Widget>[if (visible.isEmpty) AppEmptyState('No matching tools', hint: 'Try a different search term.', icon: Icons.search_off_rounded)];
          // wide screens: each module section goes to the shorter column (the search + pulse panel count as 3 modules)
          final left = <Widget>[...head, ...empty], right = <Widget>[];
          var leftLoad = 3, rightLoad = 0;
          for (final (t, m) in visible) {
            if (rightLoad < leftLoad) {
              right.addAll(section(t, m));
              rightLoad += m.length + 1;
            } else {
              left.addAll(section(t, m));
              leftLoad += m.length + 1;
            }
          }
          return AppTabBody(
            narrow: [...head, ...empty, for (final (t, m) in visible) ...section(t, m), const SignOutTile()],
            side: [...right, const SignOutTile()],
            children: left,
          );
        }),
      ),
    ]);
  }
}
