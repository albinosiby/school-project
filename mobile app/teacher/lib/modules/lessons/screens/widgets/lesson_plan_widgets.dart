import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../../home/models/timetable_models.dart' as bell;
import '../../models/lesson_plan_models.dart';

/// "Period 2 · 9:40" for a timetable slot id ("P2"), or '' when none.
String slotLabel(String slot) {
  if (slot.isEmpty) return '';
  final s = bell.slotOf(slot);
  final name = s.label ?? 'Period ${slot.replaceAll(RegExp(r'\D'), '')}';
  return s.start.isEmpty ? name : '$name · ${fmtTime(s.start)}';
}

/// "Today", "Tomorrow", "Tue 25 Nov", or "No date".
String sessionDay(String iso) {
  if (iso.isEmpty) return 'No date';
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  if (iso == todayIso()) return 'Today';
  if (iso == plusDays(1)) return 'Tomorrow';
  if (iso == plusDays(-1)) return 'Yesterday';
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${wd[d.weekday - 1]} ${d.day} ${mo[d.month - 1]}';
}

/// Review state as a small pill (nothing for plans that were never sent).
class ReviewPill extends StatelessWidget {
  const ReviewPill(this.review, {super.key});
  final LessonReview review;
  @override
  Widget build(BuildContext context) => switch (review.state) {
    ReviewState.submitted => const Pill('In review', tone: Tone.warning, icon: Icons.hourglass_top_rounded),
    ReviewState.approved => const Pill('Approved', tone: Tone.success, icon: Icons.verified_rounded),
    ReviewState.changes => const Pill('Changes asked', tone: Tone.danger, icon: Icons.edit_note_rounded),
    ReviewState.none => const SizedBox.shrink(),
  };
}

/// Progress bar with "3 of 5 taught".
class PlanProgress extends StatelessWidget {
  const PlanProgress(this.plan, {super.key});
  final LessonPlan plan;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(R.pill),
          child: LinearProgressIndicator(
            value: plan.progress,
            minHeight: 6.h,
            backgroundColor: C.border,
            color: plan.completed ? C.successDark : C.primary,
          ),
        ),
      ),
      SizedBox(width: 10.w),
      Text(
        plan.plannedCount == 0 ? 'No sessions' : '${plan.taughtCount} of ${plan.plannedCount} taught',
        style: T.small.copyWith(fontSize: 11.5.sp, fontWeight: FontWeight.w600),
      ),
    ],
  );
}

/// Circle for a session: tick when taught, number when planned (filled for today), dash when skipped.
class SessionDot extends StatelessWidget {
  const SessionDot(this.session, this.n, {super.key});
  final LessonSession session;
  final int n;
  @override
  Widget build(BuildContext context) {
    final today = session.open && session.date == todayIso();
    final (bg, fg, border) = switch (session.status) {
      SessionStatus.taught => (C.successDark, Colors.white, C.successDark),
      SessionStatus.skipped => (C.surface, C.muted, C.border),
      SessionStatus.planned =>
        today ? (C.primary, Colors.white, C.primary) : (C.bg, C.primary, C.primary.withValues(alpha: .4)),
    };
    return Container(
      width: 28.r,
      height: 28.r,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
        border: Border.all(color: border, width: 1.5),
      ),
      child: switch (session.status) {
        SessionStatus.taught => Icon(Icons.check_rounded, size: 16.r, color: fg),
        SessionStatus.skipped => Icon(Icons.remove_rounded, size: 16.r, color: fg),
        SessionStatus.planned => Text(
          '$n',
          style: T.smallStrong.copyWith(fontSize: 12.sp, color: fg),
        ),
      },
    );
  }
}

/// Asks how the session went; returns the note ('' allowed) or null when cancelled.
Future<String?> askTaughtNote(BuildContext context, LessonSession s) {
  final ctl = TextEditingController(text: s.note);
  return showAppSheet<String>(
    context,
    title: 'Mark as taught',
    subtitle: s.focus.isEmpty ? null : s.focus,
    builder: (ctx) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(
          label: 'How did it go? (optional)',
          controller: ctl,
          maxLines: 3,
          hint: 'e.g. Finished examples; carry the word problems to next session',
        ),
        SizedBox(height: 12.h),
        AppButton(
          'Mark as taught',
          icon: Icons.check_circle_outline_rounded,
          onPressed: () => Navigator.pop(ctx, ctl.text.trim()),
        ),
      ],
    ),
  );
}
