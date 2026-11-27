import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../home/screens/widgets/teacher_tab_header.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/bloc/school_states.dart';
import '../../school/models/school_models.dart';
import '../bloc/class_hub_bloc.dart';
import '../bloc/class_hub_events.dart';
import '../bloc/class_hub_states.dart';

/// Classes tab: the class the teacher is in charge of (full management) on top, then every class she teaches a
/// subject in (teaching tools).
class ClassesScreen extends StatelessWidget {
  const ClassesScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      BlocProvider(create: (_) => getIt<ClassHubBloc>()..add(const ClassHubLoadRequested()), child: const _ClassesView());
}

/// Subject teaching page of a class (students, today's register, homework, marks) — no class-teacher tools, also for
/// the teacher's own class.
String classPage(String classId) => '${RoutePaths.students}?classId=$classId&view=subject';

/// Whether the teacher teaches a subject in [c] (any class she is not class teacher of counts as taught).
bool teachesSubjectIn(SchoolClass c) => !c.classTeacher || c.subjectNames.isNotEmpty || c.subject.isNotEmpty;

class _ClassesView extends StatelessWidget {
  const _ClassesView();

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final hub = context.watch<ClassHubBloc>().state;
    final mine = school.classes.where((c) => c.classTeacher).toList();
    // two independent sections: managing her own class, and teaching subjects (her own class included when she
    // teaches a subject there)
    final teaching = school.classes.where(teachesSubjectIn).toList();
    return Column(
      children: [
        TeacherTabHeader(title: 'Classes', subtitle: school.teacher?.name),
        Expanded(
          child: AppTabBody(
            children: [
              if (school.status == SchoolStatus.loading && school.classes.isEmpty)
                Padding(padding: EdgeInsets.all(24.r), child: const SchoolSkeletonList())
              else if (school.classes.isEmpty)
                const AppEmptyState('No classes yet', hint: 'Classes appear here once the office assigns you a class or a subject.', icon: Icons.class_outlined)
              else ...[
                for (final c in mine) ...[_MyClassCard(cls: c, roster: school.studentsOf(c.id), hub: hub), SizedBox(height: 18.h)],
                if (teaching.isNotEmpty) ...[
                  _Label(mine.isEmpty ? 'Your classes' : 'Subjects you teach', count: teaching.length),
                  for (final c in teaching) _TeachCard(cls: c, roster: school.studentsOf(c.id), hub: hub),
                ],
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text, {required this.count});
  final String text;
  final int count;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 10.h, left: 2.w),
    child: Row(
      children: [
        Text(text.toUpperCase(), style: T.capsMuted.copyWith(fontSize: 11.sp, letterSpacing: .6)),
        SizedBox(width: 6.w),
        Text('$count', style: T.capsMuted.copyWith(fontSize: 11.sp, color: C.primary)),
      ],
    ),
  );
}

/// The class teacher's class: today's register, attendance, leave requests and every class-level action.
class _MyClassCard extends StatelessWidget {
  const _MyClassCard({required this.cls, required this.roster, required this.hub});
  final SchoolClass cls;
  final List<Student> roster;
  final ClassHubState hub;

  @override
  Widget build(BuildContext context) {
    final today = hub.todayOf(cls.id);
    final leaves = hub.pendingLeaves(roster);
    final size = roster.isEmpty ? cls.students : roster.length;
    final present = today == null ? null : today.counts.present + today.counts.late;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        key: ValueKey('my-class-${cls.id}'),
        borderRadius: BorderRadius.circular(R.xxl),
        onTap: () => context.push(RoutePaths.classManage(cls.id)),
        child: Ink(
          padding: EdgeInsets.all(16.r),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [C.primary, C.primaryDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(R.xxl),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: .18), borderRadius: BorderRadius.circular(R.pill)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.workspace_premium_rounded, size: 13.r, color: Colors.white),
                        SizedBox(width: 4.w),
                        Text('CLASS TEACHER', style: T.smallStrong.copyWith(color: Colors.white, fontSize: 10.sp, letterSpacing: .6)),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Icon(Icons.chevron_right_rounded, color: Colors.white, size: 22.r),
                ],
              ),
              SizedBox(height: 10.h),
              Text('Class ${cls.label}', style: T.title.copyWith(color: Colors.white)),
              SizedBox(height: 2.h),
              Text(
                [
                  '$size students',
                  if (cls.room.isNotEmpty) cls.room,
                ].join(' • '),
                style: T.small.copyWith(color: Colors.white.withValues(alpha: .85)),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              SizedBox(height: 14.h),
              Row(
                children: [
                  _HeroStat(
                    label: 'Today',
                    value: present == null ? 'Not marked' : '$present/${today!.total}',
                    warn: present == null,
                  ),
                  _HeroStat(label: 'Attendance', value: cls.attendance > 0 ? '${cls.attendance.toStringAsFixed(1)}%' : '—'),
                  _HeroStat(label: 'Leave requests', value: '${leaves.length}', warn: leaves.isNotEmpty),
                ],
              ),
              SizedBox(height: 14.h),
              _CardButton(
                key: const ValueKey('card-manage'),
                icon: Icons.dashboard_customize_rounded,
                label: 'Manage class',
                onTap: () => context.push(RoutePaths.classManage(cls.id)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.label, required this.value, this.warn = false});
  final String label, value;
  final bool warn;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      margin: EdgeInsets.only(right: 6.w),
      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 8.h),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: .14), borderRadius: BorderRadius.circular(R.md)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: T.small.copyWith(color: Colors.white70, fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
          SizedBox(height: 2.h),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value, style: T.bodyStrong.copyWith(color: warn ? const Color(0xFFFFD6A5) : Colors.white, fontSize: 15.sp)),
          ),
        ],
      ),
    ),
  );
}

/// A white button on the class teacher card, with an optional red count.
class _CardButton extends StatelessWidget {
  const _CardButton({super.key, required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(R.md),
    child: InkWell(
      borderRadius: BorderRadius.circular(R.md),
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 11.h),
        child: Row(
          children: [
            Icon(icon, size: 18.r, color: C.primary),
            SizedBox(width: 6.w),
            Expanded(child: Text(label, style: T.smallStrong.copyWith(fontSize: 13.sp, color: C.primary), maxLines: 1, overflow: TextOverflow.ellipsis)),
            Icon(Icons.arrow_forward_rounded, size: 18.r, color: C.primary),
          ],
        ),
      ),
    ),
  );
}

/// A class the teacher teaches a subject in: subject, size, attendance, open homework and teaching shortcuts.
class _TeachCard extends StatelessWidget {
  const _TeachCard({required this.cls, required this.roster, required this.hub});
  final SchoolClass cls;
  final List<Student> roster;
  final ClassHubState hub;

  @override
  Widget build(BuildContext context) {
    final subjects = cls.subjectNames.isNotEmpty ? cls.subjectNames : [if (cls.subject.isNotEmpty) cls.subject];
    final hw = hub.openHomework(cls.id);
    final size = roster.isEmpty ? cls.students : roster.length;
    final code = subjects.isEmpty ? '—' : _code(subjects.first);
    return AppCard(
      key: ValueKey('teach-class-${cls.id}'),
      margin: EdgeInsets.only(bottom: 12.h),
      radius: R.xl,
      padding: EdgeInsets.all(14.r),
      onTap: () => context.push(classPage(cls.id)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 46.r,
                height: 46.r,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.lg)),
                child: Text(code, style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.sp)),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Class ${cls.label}', style: T.h3),
                    Text(
                      subjects.isEmpty ? 'Exam duty' : subjects.join(' • '),
                      style: T.small.copyWith(color: C.primary, fontWeight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: C.muted, size: 22.r),
            ],
          ),
          SizedBox(height: 12.h),
          Row(
            children: [
              _Fact(Icons.groups_outlined, '$size students'),
              if (cls.attendance > 0) _Fact(Icons.how_to_reg_outlined, '${cls.attendance.toStringAsFixed(0)}% attendance'),
              if (cls.room.isNotEmpty) _Fact(Icons.meeting_room_outlined, cls.room),
            ],
          ),
          if (hw.isNotEmpty) ...[
            SizedBox(height: 10.h),
            Container(
              padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 8.h),
              decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
              child: Row(
                children: [
                  Icon(Icons.assignment_outlined, size: 16.r, color: C.slate),
                  SizedBox(width: 6.w),
                  Expanded(
                    child: Text(
                      '${hw.first.title} • ${hw.first.turnedIn}/${hw.first.submissions.length} turned in',
                      style: T.small.copyWith(fontSize: 12.sp),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (hw.length > 1) Text('+${hw.length - 1}', style: T.smallStrong.copyWith(color: C.primary)),
                ],
              ),
            ),
          ],
          SizedBox(height: 12.h),
          Row(
            children: [
              _Tool('Attendance', Icons.how_to_reg_outlined, () => context.push(RoutePaths.markAttendance(classId: cls.id))),
              _Tool('Homework', Icons.assignment_add, () => context.push('${RoutePaths.homeworkNew}?classId=${cls.id}')),
              _Tool('Marks', Icons.grading_rounded, () => context.push('${RoutePaths.marks}?class=${cls.id}')),
              _Tool('Resources', Icons.folder_open_rounded, () => context.push('${RoutePaths.resources}?classId=${cls.id}')),
            ],
          ),
        ],
      ),
    );
  }

  static String _code(String subject) {
    final w = subject.split(RegExp(r'[\s&]+')).where((e) => e.isNotEmpty).toList();
    if (w.length > 1) return w.take(2).map((e) => e[0]).join().toUpperCase();
    return subject.substring(0, subject.length < 3 ? subject.length : 3).toUpperCase();
  }
}

class _Fact extends StatelessWidget {
  const _Fact(this.icon, this.text);
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Flexible(
    child: Padding(
      padding: EdgeInsets.only(right: 12.w),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14.r, color: C.slate),
          SizedBox(width: 4.w),
          Flexible(child: Text(text, style: T.small.copyWith(fontSize: 12.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
        ],
      ),
    ),
  );
}

class _Tool extends StatelessWidget {
  const _Tool(this.label, this.icon, this.onTap);
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Padding(
      padding: EdgeInsets.symmetric(horizontal: 3.w),
      child: Material(
        color: C.panel,
        borderRadius: BorderRadius.circular(R.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(R.md),
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 8.h),
            child: Column(
              children: [
                Icon(icon, size: 18.r, color: C.primary),
                SizedBox(height: 3.h),
                Text(label, style: T.smallStrong.copyWith(fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
