import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../models/homework_grading.dart';
import '../../models/homework_models.dart';
import '../../models/tasks_format.dart';

const _levelTones = [Tone.success, Tone.brand, Tone.neutral, Tone.danger];
const _levelIcons = [Icons.verified_outlined, Icons.check_circle_outline_rounded, Icons.more_horiz_rounded, Icons.error_outline_rounded];

/// Small filled circle with a code / number (rubric "C1", criterion "1").
class CodeBadge extends StatelessWidget {
  const CodeBadge(this.text, {super.key, this.size = 36, this.solid = true});
  final String text;
  final double size;
  final bool solid;
  @override
  Widget build(BuildContext context) => Container(
        width: size.r, height: size.r, alignment: Alignment.center,
        decoration: BoxDecoration(color: solid ? C.primary : C.primarySoft, shape: BoxShape.circle),
        child: Text(text, style: T.smallStrong.copyWith(color: solid ? Colors.white : C.primary)),
      );
}

/// One rubric criterion with its four level boxes (Figma "Open Homework").
class RubricCard extends StatelessWidget {
  const RubricCard({super.key, required this.index, required this.cap, this.avg});
  final int index, cap;
  final double? avg;

  @override
  Widget build(BuildContext context) {
    final c = kRubric[index];
    final r = levelRanges(cap);
    return Padding(
      padding: EdgeInsets.only(bottom: 14.h),
      child: AppCard(
        radius: R.xl,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            CodeBadge(c.code),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(c.name, style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis),
                Text('${c.blurb} • Max $cap pts', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
              ]),
            ),
            SizedBox(width: 6.w),
            Pill(avg == null ? 'Avg —' : 'Avg ${avg!.toStringAsFixed(1)}', tone: Tone.brand),
          ]),
          SizedBox(height: 12.h),
          LayoutBuilder(builder: (_, box) {
            final w = (box.maxWidth - 10.w) / 2;
            return Wrap(spacing: 10.w, runSpacing: 10.h, children: [
              for (var l = 0; l < 4; l++)
                Container(
                  width: w, constraints: BoxConstraints(minHeight: 112.h), padding: EdgeInsets.all(10.w),
                  decoration: BoxDecoration(
                    color: l == 0 ? C.successSoft.withValues(alpha: .4) : l == 3 ? C.dangerSoft.withValues(alpha: .5) : l == 1 ? C.panel : C.bg,
                    border: Border.all(color: toneColors(_levelTones[l]).fg.withValues(alpha: .25)), borderRadius: BorderRadius.circular(R.md),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Icon(_levelIcons[l], size: 16.r, color: toneColors(_levelTones[l]).fg), SizedBox(width: 4.w),
                      Expanded(child: Text(kLevelNames[l], style: T.smallStrong.copyWith(color: toneColors(_levelTones[l]).fg), maxLines: 1, overflow: TextOverflow.ellipsis)),
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                        decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.pill)),
                        child: Text(r[l].$1 == r[l].$2 ? '${r[l].$1}' : '${r[l].$1}–${r[l].$2}', style: T.smallStrong),
                      ),
                    ]),
                    SizedBox(height: 6.h),
                    Text(c.levels[l], style: T.small),
                  ]),
                ),
            ]);
          }),
        ]),
      ),
    );
  }
}

/// A student in the graded list: marks, per-criterion breakdown and feedback, or grade / mark-submitted actions.
class StudentGradeCard extends StatelessWidget {
  const StudentGradeCard({super.key, required this.row, required this.max, required this.remedial, required this.onGrade, required this.onMarkSubmitted});
  final StudentRow row;
  final int max;
  final bool remedial;
  final VoidCallback onGrade, onMarkSubmitted;

  @override
  Widget build(BuildContext context) {
    final r = row;
    final graded = r.status == SubmissionStatus.graded;
    final pct = pctOf(r.marks, max);
    final at = parseDt(r.sub.gradedAt);
    final fb = r.sub.feedback;
    final crit = graded ? criteriaOf(r.sub, max) : const <int>[];
    final caps = criterionCaps(max);
    final sub = switch (r.status) {
      SubmissionStatus.graded => remedial ? 'Needs Attention • Remedial' : 'Evaluated ${at == null ? '' : agoLabel(at)}',
      SubmissionStatus.submitted => 'Submitted • awaiting grading',
      SubmissionStatus.pending => 'Not submitted yet',
    };
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        radius: R.lg, onTap: r.status == SubmissionStatus.pending ? null : onGrade,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: EdgeInsets.only(bottom: 6.h),
              child: Stack(clipBehavior: Clip.none, children: [
                Avatar(r.name, size: 48),
                Positioned(
                  bottom: -6.h, left: 6.w,
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 5.w, vertical: 1.h),
                    decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.sm), border: Border.all(color: C.border)),
                    child: Text('#${r.roll.toString().padLeft(2, '0')}', style: T.small.copyWith(fontSize: 10.sp, fontWeight: FontWeight.w700, color: C.ink)),
                  ),
                ),
              ]),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(r.name, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(sub, style: T.small.copyWith(color: remedial ? C.danger : C.slate), maxLines: 2, overflow: TextOverflow.ellipsis),
              ]),
            ),
            SizedBox(width: 6.w),
            if (graded)
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text.rich(TextSpan(children: [TextSpan(text: '${r.marks}', style: T.stat.copyWith(fontSize: 22.sp)), TextSpan(text: '/$max', style: T.small)])),
                SizedBox(height: 4.h),
                Pill('$pct% • ${bandOf(pct)}', tone: remedial ? Tone.danger : pct >= 90 ? Tone.success : Tone.brand),
              ])
            else
              Pill(r.status == SubmissionStatus.submitted ? 'To grade' : 'Missing', tone: r.status == SubmissionStatus.submitted ? Tone.warning : Tone.neutral),
          ]),
          if (graded) ...[
            SizedBox(height: 14.h),
            Container(
              padding: EdgeInsets.all(10.w), decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                for (var i = 0; i < kRubric.length; i++)
                  Expanded(
                    child: Column(children: [
                      Text('${kRubric[i].code}: ${kRubric[i].name.split(' ').first}'.toUpperCase(), textAlign: TextAlign.center,
                          style: T.small.copyWith(fontSize: 9.5.sp, fontWeight: FontWeight.w700), maxLines: 2, overflow: TextOverflow.ellipsis),
                      SizedBox(height: 2.h),
                      Text.rich(TextSpan(children: [TextSpan(text: '${crit[i]}', style: T.smallStrong.copyWith(fontSize: 14.sp)), TextSpan(text: '/${caps[i]}', style: T.small)])),
                    ]),
                  ),
              ]),
            ),
            SizedBox(height: 6.h),
            Row(children: [
              Icon(Icons.chat_bubble_outline_rounded, size: 16.r, color: C.primary), SizedBox(width: 8.w),
              Expanded(
                child: Text(fb.isEmpty ? 'Standard Rubric Complete' : '“$fb”',
                    style: T.body.copyWith(fontStyle: fb.isEmpty ? FontStyle.normal : FontStyle.italic, color: C.ink), maxLines: 2, overflow: TextOverflow.ellipsis),
              ),
              IconButton(tooltip: 'Edit grades for ${r.name}', onPressed: onGrade, icon: Icon(Icons.edit_note_rounded, color: C.slate, size: 24.r)),
            ]),
          ] else ...[
            SizedBox(height: 12.h),
            if (r.status == SubmissionStatus.submitted)
              AppButton('Grade Now', icon: Icons.rate_review_outlined, small: true, onPressed: onGrade)
            else
              AppButton('Mark as Submitted', icon: Icons.inbox_outlined, kind: BtnKind.outline, small: true, onPressed: onMarkSubmitted),
          ],
        ]),
      ),
    );
  }
}
