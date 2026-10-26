import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../design_system/design_system.dart';
import '../bloc/homework_bloc.dart';
import '../bloc/homework_events.dart';
import '../models/homework_grading.dart';
import '../models/homework_models.dart';
import '../models/tasks_format.dart';
import 'widgets/homework_widgets.dart';

/// Pushes the grade editor for [studentId], sharing the screen's [HomeworkBloc] (as legacy: a pushed page, not a route).
Future<void> openGradeEditor(BuildContext context, String studentId) {
  final bloc = context.read<HomeworkBloc>();
  return Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => BlocProvider.value(value: bloc, child: GradeEditorScreen(studentId: studentId))));
}

const _reasons = ['Recalculation / Remarking', 'Clerical Correction', 'Rubric Clarification', 'Late Submission / Review'];
const _tags = ['Excellent Analysis', 'Axis Slip', 'Thorough Proof', 'Needs Revision'];

/// Edit Grades (Figma 1153:18946): stepper per rubric criterion, feedback, audit rationale when re-grading.
class GradeEditorScreen extends StatefulWidget {
  const GradeEditorScreen({super.key, required this.studentId});
  final String studentId;
  @override
  State<GradeEditorScreen> createState() => _GradeEditorScreenState();
}

class _GradeEditorScreenState extends State<GradeEditorScreen> {
  final _feedback = TextEditingController();
  List<TextEditingController> _marks = const [];
  late final bool _wasGraded;
  String _reason = '';
  String? _error;
  bool _tried = false;

  @override
  void initState() {
    super.initState();
    final h = context.read<HomeworkBloc>().state.homework;
    final sub = h?.submissions[widget.studentId] ?? const Submission();
    _wasGraded = sub.status == SubmissionStatus.graded;
    if (h != null) {
      final max = h.maxMarks.toInt();
      final initial = _wasGraded ? criteriaOf(sub, max) : List.filled(criterionCaps(max).length, 0);
      _marks = [for (final v in initial) TextEditingController(text: '$v')];
    }
    _feedback.text = sub.feedback;
  }

  @override
  void dispose() {
    _feedback.dispose();
    for (final c in _marks) {
      c.dispose();
    }
    super.dispose();
  }

  List<int> get _values => [for (final c in _marks) int.tryParse(c.text) ?? 0];

  void _save(int max) {
    final caps = criterionCaps(max);
    final v = _values;
    final total = v.fold<int>(0, (a, b) => a + b);
    String? err;
    for (var i = 0; i < v.length; i++) {
      if (v[i] > caps[i]) err = '${kRubric[i].name} can be at most ${caps[i]}';
    }
    if (err == null && (total < 0 || total > max)) err = 'Total must be between 0 and $max';
    if (err == null && _wasGraded && _reason.isEmpty) err = 'Select a reason for the score adjustment';
    setState(() {
      _tried = true;
      _error = err;
    });
    if (err != null) return;
    context.read<HomeworkBloc>().add(HomeworkGradeSaved(studentId: widget.studentId, criteria: v, feedback: _feedback.text.trim(), rationale: _wasGraded ? _reason : null));
    final messenger = ScaffoldMessenger.of(context);
    Navigator.pop(context);
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text('Grades saved: $total / $max', style: T.bodyStrong.copyWith(color: Colors.white)), backgroundColor: C.ink));
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<HomeworkBloc>().state;
    final h = s.homework;
    if (h == null || _marks.isEmpty) {
      return const DetailScaffold(title: 'Edit Grades', body: Center(child: AppEmptyState('Homework not found', icon: Icons.assignment_late_outlined)));
    }
    final max = h.maxMarks.toInt();
    final caps = criterionCaps(max);
    final total = _values.fold<int>(0, (a, b) => a + b);
    final pct = pctOf(total, max);
    final st = s.stats;
    final avg = st.avg;
    final student = s.student(widget.studentId);
    final roll = student?.roll ?? 0;
    final name = student?.name ?? widget.studentId;
    final lastAt = parseDt(h.submissions[widget.studentId]?.gradedAt);

    return DetailScaffold(
      title: _wasGraded ? 'Edit Grades' : 'Grade Student',
      subtitle: h.title,
      bottom: Row(children: [
        Expanded(child: AppButton('Cancel', kind: BtnKind.outline, onPressed: () => Navigator.pop(context))),
        SizedBox(width: 12.w),
        Expanded(flex: 2, child: AppButton(_wasGraded ? 'Save & Update' : 'Save Grades', onPressed: () => _save(max))),
      ]),
      body: ListView(padding: EdgeInsets.fromLTRB(S.page, S.page, S.page, 32.h), children: [
        AppCard(
          radius: R.lg,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Avatar(name, size: 52), SizedBox(width: 12.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('#${roll.toString().padLeft(2, '0')} $name', style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text('${s.classGrade} • ${h.subject}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ]),
              ),
              SizedBox(width: 6.w),
              Flexible(child: Pill('$pct% • ${bandOf(pct)}', tone: pct < 50 ? Tone.danger : Tone.brand, dot: true)),
            ]),
            SizedBox(height: 12.h),
            Container(
              padding: EdgeInsets.all(12.w), decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
              child: Row(children: [
                Expanded(
                  child: Text.rich(TextSpan(style: T.small, children: [
                    const TextSpan(text: 'Class Avg: '),
                    TextSpan(text: st.graded == 0 ? '—' : '${avg.toStringAsFixed(1)} / $max', style: T.smallStrong),
                    if (st.graded > 0)
                      TextSpan(
                        text: '  (${total - avg >= 0 ? '+' : ''}${(total - avg).toStringAsFixed(1)})',
                        style: T.smallStrong.copyWith(color: total >= avg ? C.successDark : C.danger),
                      ),
                  ])),
                ),
                Text.rich(TextSpan(children: [TextSpan(text: '$total', style: T.stat.copyWith(color: C.primary, fontSize: 26.sp)), TextSpan(text: ' / $max', style: T.small)])),
              ]),
            ),
            SizedBox(height: 10.h),
            Row(children: [
              Icon(Icons.schedule_rounded, size: 15.r, color: C.slate), SizedBox(width: 6.w),
              Expanded(child: Text(lastAt == null ? 'Not graded yet' : 'Last marked: ${relDay(lastAt)}, ${fmtClock(lastAt)}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
              Flexible(child: Pill(s.teacher?.name ?? 'Teacher', tone: Tone.neutral)),
            ]),
          ]),
        ),
        SectionHeader('Rubric Criteria Breakdown', icon: Icons.fact_check_outlined, action: '${caps.length} Criteria'),
        for (var i = 0; i < caps.length; i++)
          _CriterionCard(index: i, cap: caps[i], max: max, controller: _marks[i], onChanged: () => setState(() => _error = null)),
        SectionHeader('Teacher Qualitative Feedback', action: '${_feedback.text.length} chars'),
        Wrap(spacing: 8.w, runSpacing: 8.h, children: [
          for (final t in _tags)
            ActionChip(
              label: Text('+ $t', style: T.smallStrong.copyWith(color: C.primary)),
              backgroundColor: C.primarySoft, side: const BorderSide(color: C.panelBorder),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.pill)),
              onPressed: () => setState(() {
                final cur = _feedback.text.trim();
                _feedback.text = cur.isEmpty ? t : '$cur. $t';
              }),
            ),
        ]),
        SizedBox(height: 10.h),
        TextField(
          controller: _feedback, maxLines: 4, maxLength: 300, onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(hintText: 'Write feedback for the student…', counterText: ''),
        ),
        if (_wasGraded) ...[
          SectionHeader('Audit Trail & Edit Rationale', action: 'Required'),
          Text('Institutional grading compliance requires stating the purpose of manual score adjustment.', style: T.small),
          SizedBox(height: 10.h),
          AppChoiceChips(items: _reasons, value: _reason, onChanged: (r) => setState(() {
                _reason = r;
                _error = null;
              })),
        ],
        if (_tried && _error != null) Padding(padding: EdgeInsets.only(top: 12.h), child: Text(_error!, style: T.bodyStrong.copyWith(color: C.danger))),
      ]),
    );
  }
}

class _CriterionCard extends StatelessWidget {
  const _CriterionCard({required this.index, required this.cap, required this.max, required this.controller, required this.onChanged});
  final int index, cap, max;
  final TextEditingController controller;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final value = (int.tryParse(controller.text) ?? 0).clamp(0, cap);
    final lvl = levelIndex(value, cap);
    final r = levelRanges(cap)[lvl];
    final c = kRubric[index];
    final over = (int.tryParse(controller.text) ?? 0) > cap;
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        radius: R.lg,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            CodeBadge('${index + 1}', size: 24, solid: false),
            SizedBox(width: 8.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(c.name, style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis),
                Text('Weight: $cap Pts (${max == 0 ? 0 : (cap * 100 / max).round()}%)', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              ]),
            ),
            SizedBox(width: 6.w),
            AppNumberStepper(controller: controller, max: cap, label: c.name, error: over, onChanged: (_) => onChanged()),
          ]),
          SizedBox(height: 10.h),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 8.h), decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.sm)),
            child: Row(children: [
              Icon(Icons.verified_outlined, size: 16.r, color: lvl == 3 ? C.danger : C.primary), SizedBox(width: 6.w),
              Expanded(child: Text(kLevelNames[lvl], style: T.smallStrong.copyWith(color: lvl == 3 ? C.danger : C.primary), maxLines: 1, overflow: TextOverflow.ellipsis)),
              Text('Range ${r.$1 == r.$2 ? r.$1 : '${r.$1}–${r.$2}'} pts', style: T.small),
            ]),
          ),
          SizedBox(height: 8.h),
          Text(c.levels[lvl], style: T.body.copyWith(color: C.ink)),
        ]),
      ),
    );
  }
}
