import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../attendance/models/attendance_models.dart' show minimumAttendance, attendanceThresholdLabel;
import '../bloc/class_management_bloc.dart';
import '../bloc/class_management_events.dart';
import '../bloc/class_management_states.dart';
import '../models/class_management_models.dart';
import 'widgets/class_charts.dart';

/// One student in the class teacher's class: attendance in every subject, marks per subject and exam, and the
/// progress against the class average.
class ClassStudentScreen extends StatelessWidget {
  const ClassStudentScreen({super.key, required this.classId, required this.studentId});
  final String classId, studentId;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<ClassManagementBloc>()..add(ClassManagementLoadRequested(classId)),
    child: _View(classId: classId, studentId: studentId),
  );
}

class _View extends StatelessWidget {
  const _View({required this.classId, required this.studentId});
  final String classId, studentId;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<ClassManagementBloc>().state;
    final t = s.standingOf(studentId);
    if (s.status != ClassManagementStatus.loaded || t == null) {
      return DetailScaffold(
        title: 'Student progress',
        fallbackRoute: RoutePaths.classManage(classId),
        body: s.status == ClassManagementStatus.loaded ? const AppEmptyState('Student not found', icon: Icons.person_off_outlined) : const SchoolSkeletonList(),
      );
    }
    final st = t.student;
    final subjAtt = s.studentSubjectAttendance(st);
    final subjMarks = s.studentSubjectMarks(st.id);
    final subjects = [...s.subjects, for (final k in subjMarks.keys) if (!s.subjects.contains(k)) k];
    final progress = s.studentExamProgress(st.id);
    final digits = st.phone.replaceAll(RegExp(r'[^0-9+]'), '');
    return DetailScaffold(
      title: st.name,
      subtitle: 'Progress in class${st.roll > 0 ? ' • Roll ${st.roll}' : ''}',
      fallbackRoute: RoutePaths.classManage(classId),
      body: ListView(
        padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 40.h),
        children: [
          AppCard(
            radius: R.xxl,
            padding: EdgeInsets.all(16.r),
            child: Column(
              children: [
                Row(
                  children: [
                    Avatar(st.name, size: 60, image: st.photo.isEmpty ? null : st.photo),
                    SizedBox(width: 14.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(st.name, style: T.h2, maxLines: 2, overflow: TextOverflow.ellipsis),
                          Text([if (st.adm.isNotEmpty) 'Adm ${st.adm}', if (st.guardian.isNotEmpty) st.guardian].join(' • '), style: T.small),
                        ],
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 14.h),
                Row(
                  children: [
                    _Big('Attendance', '${t.attendance.toStringAsFixed(1)}%', low: t.attendance < minimumAttendance),
                    _Big('Marks average', t.marks == null ? '—' : '${t.marks!.toStringAsFixed(1)}%', low: t.marks != null && t.marks! < 40),
                    _Big('Absences', '${t.absences}', low: false),
                  ],
                ),
                SizedBox(height: 12.h),
                Row(
                  children: [
                    Expanded(
                      child: AppButton(
                        'Full profile',
                        small: true,
                        kind: BtnKind.soft,
                        icon: Icons.person_outline_rounded,
                        onPressed: () => context.push(RoutePaths.student(st.id)),
                      ),
                    ),
                    SizedBox(width: 8.w),
                    Expanded(
                      child: AppButton(
                        'Call parent',
                        small: true,
                        kind: BtnKind.outline,
                        icon: Icons.call_outlined,
                        onPressed: digits.isEmpty ? null : () => launchUrl(Uri(scheme: 'tel', path: digits)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          SizedBox(height: 12.h),
          if (progress.where((p) => p.avg != null).isNotEmpty)
            _Card(
              title: 'Progress across exams',
              sub: 'Average of all subjects — dashed line is the class',
              child: TrendLineChart(
                points: [for (final p in progress) (label: p.exam, value: p.avg)],
                compare: [for (final e in s.examAverages) (label: e.exam, value: e.avg)],
                threshold: 40,
                color: C.purple,
              ),
            ),
          _Card(
            title: 'Attendance by subject',
            sub: 'All ${subjects.length} subjects • periods attended out of periods marked • minimum $attendanceThresholdLabel%',
            child: HBarChart(
              items: [
                for (final sub in subjects)
                  () {
                    final a = subjAtt[sub] ?? (attended: 0, total: 0);
                    return (label: sub, value: a.total == 0 ? null : a.attended * 100 / a.total, caption: a.total == 0 ? '' : '${a.attended}/${a.total}');
                  }(),
              ],
              threshold: minimumAttendance,
              color: C.success,
              empty: 'No registers yet',
            ),
          ),
          Text('Subjects', style: T.h2),
          SizedBox(height: 8.h),
          if (subjects.isEmpty) Text('No attendance or marks recorded yet.', style: T.small),
          for (final sub in subjects)
            _SubjectCard(subject: sub, attendance: subjAtt[sub], marks: subjMarks[sub] ?? const [], classAvg: s.subjectMarks[sub], weekly: s.weeklyPeriods(sub)),
        ],
      ),
    );
  }
}

class _Big extends StatelessWidget {
  const _Big(this.label, this.value, {required this.low});
  final String label, value;
  final bool low;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(value, style: T.h2.copyWith(color: low ? C.danger : C.ink)),
        Text(label, style: T.small.copyWith(fontSize: 11.sp)),
      ],
    ),
  );
}

class _Card extends StatelessWidget {
  const _Card({required this.title, this.sub, required this.child});
  final String title;
  final String? sub;
  final Widget child;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 12.h),
    child: AppCard(
      radius: R.xl,
      padding: EdgeInsets.all(14.r),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: T.h3),
          if (sub != null) Text(sub!, style: T.small.copyWith(fontSize: 11.5.sp)),
          SizedBox(height: 12.h),
          child,
        ],
      ),
    ),
  );
}

/// One subject: attendance, the student's average against the class, and every exam mark.
class _SubjectCard extends StatelessWidget {
  const _SubjectCard({required this.subject, required this.attendance, required this.marks, required this.classAvg, this.weekly = 0});
  final String subject;
  final int weekly;
  final ({int attended, int total})? attendance;
  final List<ClassMark> marks;
  final double? classAvg;
  @override
  Widget build(BuildContext context) {
    final scored = [for (final m in marks) ?m.pct];
    final avg = scored.isEmpty ? null : scored.reduce((a, b) => a + b) / scored.length;
    final att = attendance == null || attendance!.total == 0 ? null : attendance!.attended * 100 / attendance!.total;
    final trend = scored.length < 2 ? null : scored.last - scored[scored.length - 2];
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppCard(
        key: ValueKey('subject-$subject'),
        radius: R.xl,
        padding: EdgeInsets.all(14.r),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(subject, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                      if (weekly > 0) Text('$weekly periods a week', style: T.small.copyWith(fontSize: 11.sp)),
                    ],
                  ),
                ),
                if (trend != null)
                  Pill(
                    '${trend >= 0 ? '+' : '−'}${trend.abs().toStringAsFixed(0)} pts',
                    tone: trend >= 0 ? Tone.success : Tone.danger,
                    icon: trend >= 0 ? Icons.trending_up_rounded : Icons.trending_down_rounded,
                  ),
              ],
            ),
            SizedBox(height: 10.h),
            Row(
              children: [
                _Metric(
                  'Attendance',
                  att == null ? '—' : '${att.round()}%',
                  sub: attendance == null || attendance!.total == 0 ? 'no registers yet' : '${attendance!.attended}/${attendance!.total} periods',
                  low: att != null && att < minimumAttendance,
                ),
                _Metric('Average', avg == null ? '—' : '${avg.round()}%', sub: classAvg == null ? 'no marks yet' : 'class ${classAvg!.round()}%', low: avg != null && avg < 40),
                _Metric('Exams', '${marks.length}', sub: marks.where((m) => m.absent).isEmpty ? '' : '${marks.where((m) => m.absent).length} missed', low: false),
              ],
            ),
            if (marks.isNotEmpty) ...[
              SizedBox(height: 10.h),
              Divider(height: 1, color: C.border),
              for (final m in marks)
                Padding(
                  padding: EdgeInsets.only(top: 8.h),
                  child: Row(
                    children: [
                      Expanded(child: Text(m.exam, style: T.body.copyWith(color: C.ink), maxLines: 1, overflow: TextOverflow.ellipsis)),
                      if (m.pct != null)
                        SizedBox(
                          width: 70.w,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(R.pill),
                            child: LinearProgressIndicator(
                              value: (m.pct! / 100).clamp(0, 1),
                              minHeight: 6.h,
                              backgroundColor: C.surface,
                              color: m.pct! < 40 ? C.danger : C.primary,
                            ),
                          ),
                        ),
                      SizedBox(width: 10.w),
                      SizedBox(
                        width: 64.w,
                        child: Text(
                          m.absent ? m.status : (m.score != null && m.max > 0 ? '${m.score}/${m.max}' : (m.grade.isEmpty ? '—' : m.grade)),
                          textAlign: TextAlign.right,
                          style: T.bodyStrong.copyWith(fontSize: 13.sp, color: m.absent ? C.danger : C.ink),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value, {required this.sub, required this.low});
  final String label, value, sub;
  final bool low;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: T.small.copyWith(fontSize: 11.sp)),
        Text(value, style: T.h3.copyWith(color: low ? C.danger : C.ink)),
        if (sub.isNotEmpty) Text(sub, style: T.small.copyWith(fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
      ],
    ),
  );
}
