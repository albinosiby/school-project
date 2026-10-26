import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/homework_bloc.dart';
import '../bloc/homework_events.dart';
import '../bloc/homework_states.dart';
import '../models/homework_grading.dart';
import '../models/homework_models.dart';
import '../models/tasks_format.dart';
import 'grade_editor_screen.dart';
import 'widgets/homework_widgets.dart';

const _tabs = ['Rubric Criteria', 'Graded List'];

/// Open Homework (Figma 1153:18639, rubric tab) and Graded List (1153:19414, `graded: true`).
class HomeworkScreen extends StatelessWidget {
  const HomeworkScreen({super.key, required this.id, this.graded = false});
  final String id;
  final bool graded;
  @override
  Widget build(BuildContext context) =>
      BlocProvider(create: (_) => getIt<HomeworkBloc>()..add(HomeworkLoadRequested(id)), child: _HomeworkView(graded: graded));
}

class _HomeworkView extends StatefulWidget {
  const _HomeworkView({required this.graded});
  final bool graded;
  @override
  State<_HomeworkView> createState() => _HomeworkViewState();
}

class _HomeworkViewState extends State<_HomeworkView> {
  late int _tab = widget.graded ? 1 : 0;
  String _filter = 'all', _query = '';
  bool _byMarks = false;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<HomeworkBloc>().state;
    if (s.status != HomeworkStatus.loaded) {
      return DetailScaffold(
        title: 'Homework', fallbackRoute: RoutePaths.tasks,
        body: switch (s.status) {
          HomeworkStatus.notFound => const Center(child: AppEmptyState('Homework not found', hint: 'It may have been deleted.', icon: Icons.assignment_late_outlined)),
          HomeworkStatus.failure => AppErrorWidget(message: s.error ?? 'Could not load homework', onRetry: () => context.read<HomeworkBloc>().add(HomeworkLoadRequested(s.id))),
          _ => const Center(child: CircularProgressIndicator()),
        },
      );
    }
    final h = s.homework!;
    final st = s.stats;
    final max = st.max;
    final due = DateTime.tryParse(h.due);
    final next = st.next;

    return DetailScaffold(
      title: _tab == 1 ? 'Homework Grading' : 'Homework',
      subtitle: '${s.classLabel} • ${h.subject}',
      fallbackRoute: RoutePaths.tasks,
      actions: [
        PopupMenuButton<String>(
          tooltip: 'Homework options', icon: Icon(Icons.more_vert_rounded, color: C.ink, size: 24.r),
          onSelected: (v) {
            if (v == 'toggle') {
              context.read<HomeworkBloc>().add(const HomeworkStatusToggled());
              AppDialogs.showSnackBar(context, message: s.closed ? 'Homework reopened' : 'Homework closed');
            }
            if (v == 'progress') context.push(RoutePaths.homeworkProgress(h.id));
          },
          itemBuilder: (_) => [
            PopupMenuItem(value: 'toggle', child: Text(s.closed ? 'Reopen homework' : 'Close homework')),
            const PopupMenuItem(value: 'progress', child: Text('Syllabus progress log')),
          ],
        ),
      ],
      body: ListView(padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 32.h), children: [
        PanelCard(
          padding: EdgeInsets.all(16.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Wrap(spacing: 8.w, runSpacing: 6.h, crossAxisAlignment: WrapCrossAlignment.center, children: [
                  if (s.classGrade.isNotEmpty) Pill(s.classGrade, tone: Tone.purple, icon: Icons.school_outlined),
                  Text('$max Max Pts', style: T.smallStrong),
                  Text('${s.teacher?.term ?? 'Term 2'}${due == null ? '' : ' • Due ${fmtShort(due)}'}', style: T.small),
                  if (s.closed) const Pill('Closed', tone: Tone.neutral),
                ]),
              ),
              SizedBox(width: 8.w),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
                child: Column(children: [
                  Text('Cohort Avg', style: T.small),
                  Text.rich(TextSpan(children: [
                    TextSpan(text: st.graded == 0 ? '—' : st.avg.toStringAsFixed(1), style: T.stat.copyWith(color: C.primary, fontSize: 24.sp)),
                    TextSpan(text: '/$max', style: T.small),
                  ])),
                ]),
              ),
            ]),
            SizedBox(height: 12.h),
            Text(h.title, style: T.title),
            SizedBox(height: 4.h),
            Text('${h.description}${h.subject.isEmpty ? '' : ' • ${h.subject}'}', style: T.body),
            SizedBox(height: 14.h),
            AppCard(
              radius: R.lg, padding: EdgeInsets.all(12.w),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(Icons.fact_check_outlined, size: 18.r, color: C.primary), SizedBox(width: 6.w),
                  Expanded(child: Text('${st.graded}/${st.turnedIn} Evaluated (${st.evaluatedPct}%)', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  Pill('${st.toGrade} PENDING', tone: st.toGrade == 0 ? Tone.success : Tone.danger),
                ]),
                SizedBox(height: 10.h),
                AppProgress(st.turnedIn == 0 ? 0 : st.graded / st.turnedIn),
                SizedBox(height: 4.h),
                Row(children: [
                  Icon(Icons.inbox_outlined, size: 14.r, color: C.slate), SizedBox(width: 4.w),
                  Expanded(child: Text('${st.turnedIn}/${st.total} submitted', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  if (next != null)
                    Flexible(
                      flex: 2,
                      child: TextButton(
                        onPressed: () => openGradeEditor(context, next.id),
                        style: TextButton.styleFrom(minimumSize: Size(0, 44.h), padding: EdgeInsets.zero),
                        child: Text('Next: Roll #${next.roll} ${next.name.split(' ').first} →',
                            style: T.smallStrong.copyWith(color: C.primary), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                    ),
                ]),
              ]),
            ),
            SizedBox(height: 14.h),
            AppSegmented(
              items: ['${_tabs[0]} (${kRubric.length})', '${_tabs[1]} (${st.graded})'], track: true,
              value: _tab == 0 ? '${_tabs[0]} (${kRubric.length})' : '${_tabs[1]} (${st.graded})',
              onChanged: (v) => setState(() => _tab = v.startsWith(_tabs[0]) ? 0 : 1),
            ),
          ]),
        ),
        SizedBox(height: 14.h),
        if (_tab == 0) ..._rubricCards(st) else ..._gradedList(context, st),
      ]),
    );
  }

  List<Widget> _rubricCards(HomeworkStats st) {
    final caps = criterionCaps(st.max);
    final avgs = st.criterionAvgs();
    return [for (var i = 0; i < kRubric.length; i++) RubricCard(index: i, cap: caps[i], avg: st.graded == 0 ? null : avgs[i])];
  }

  List<Widget> _gradedList(BuildContext context, HomeworkStats st) {
    final labels = {
      'all': 'All (${st.total})', 'graded': 'Graded (${st.graded})', 'pending': 'To Grade (${st.toGrade})',
      'missing': 'Not Submitted (${st.notSubmitted})', 'remedial': 'Needs Remedial (${st.remedial})',
    };
    final keys = labels.keys.toList();
    final q = _query.trim().toLowerCase();
    final rows = st.rows.where((r) {
      final okFilter = switch (_filter) {
        'graded' => r.status == SubmissionStatus.graded,
        'pending' => r.status == SubmissionStatus.submitted,
        'missing' => r.status == SubmissionStatus.pending,
        'remedial' => st.isRemedial(r),
        _ => true,
      };
      return okFilter && (q.isEmpty || r.name.toLowerCase().contains(q) || '${r.roll}' == q || '#${r.roll}' == q);
    }).toList();
    if (_byMarks) rows.sort((a, b) => b.marks.compareTo(a.marks));
    final bloc = context.read<HomeworkBloc>();
    return [
      AppSearchField(hint: 'Search student by name or roll number...', onChanged: (v) => setState(() => _query = v)),
      SizedBox(height: 12.h),
      FilterChips(items: labels.values.toList(), value: labels[_filter]!, onChanged: (v) => setState(() => _filter = keys[labels.values.toList().indexOf(v)])),
      SizedBox(height: 10.h),
      Row(children: [
        Expanded(
          child: Text('SHOWING ${rows.length} ${_filter == 'all' ? 'STUDENTS' : labels[_filter]!.split(' (').first.toUpperCase()}',
              style: T.capsMuted, maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
        TextButton.icon(
          onPressed: () => setState(() => _byMarks = !_byMarks), icon: Icon(Icons.swap_vert_rounded, size: 18.r),
          label: Text('Sort: ${_byMarks ? 'Marks' : 'Roll No'}', style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.sp)),
        ),
      ]),
      if (rows.isEmpty) const AppEmptyState('No students found', hint: 'Try another filter or search.', icon: Icons.search_off_rounded),
      for (final r in rows)
        StudentGradeCard(
          key: ValueKey(r.id), row: r, max: st.max, remedial: st.isRemedial(r),
          onGrade: () => openGradeEditor(context, r.id),
          onMarkSubmitted: () {
            bloc.add(HomeworkSubmissionMarked(r.id));
            AppDialogs.showSnackBar(context, message: '${r.name} marked as submitted');
          },
        ),
    ];
  }
}
