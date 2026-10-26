import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../bloc/duties_bloc.dart';
import '../../bloc/duties_events.dart';
import '../../models/duty_models.dart';
import '../../models/homework_models.dart';
import '../../models/tasks_format.dart';
import 'duty_sheets.dart';

void toggleDutyDone(BuildContext context, Duty d) {
  context.read<DutiesBloc>().add(DutyDoneToggled(d.id));
  AppDialogs.showSnackBar(context, message: d.isDone ? 'Duty reopened' : 'Duty marked as completed');
}

/// One duty on the Duties & Reminders list (meeting / exam / sports / gate). Done duties collapse to a slim row.
class DutyCard extends StatelessWidget {
  const DutyCard(this.d, {super.key});
  final Duty d;

  @override
  Widget build(BuildContext context) {
    final swap = context.select<DutiesBloc, SwapRequest?>((b) => b.state.pendingSwap(d.id));
    final a = d.startAt;
    void open() => context.push(RoutePaths.duty(d.id));

    final menu = PopupMenuButton<String>(
      tooltip: 'More actions', icon: Icon(Icons.more_horiz_rounded, color: C.slate, size: 22.r),
      onSelected: (v) {
        if (v == 'done') toggleDutyDone(context, d);
        if (v == 'open') open();
      },
      itemBuilder: (_) => [
        const PopupMenuItem(value: 'open', child: Text('View details')),
        PopupMenuItem(value: 'done', child: Text(d.isDone ? 'Mark as pending' : 'Mark as completed')),
      ],
    );

    if (d.isDone) {
      return Padding(
        padding: EdgeInsets.only(bottom: 12.h),
        child: AppCard(
          radius: R.lg, color: C.surface, onTap: open, padding: EdgeInsets.fromLTRB(14.w, 10.h, 4.w, 10.h),
          child: Row(children: [
            const IconTile(Icons.check_rounded, tone: Tone.success),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(d.title, style: T.h3.copyWith(decoration: TextDecoration.lineThrough, color: C.slate), maxLines: 2, overflow: TextOverflow.ellipsis),
                Text('${d.timeRange} • ${d.venue}', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
              ]),
            ),
            SizedBox(width: 8.w),
            const Pill('Done', tone: Tone.success),
            menu,
          ]),
        ),
      );
    }

    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        radius: R.xl, onTap: open, padding: EdgeInsets.fromLTRB(16.w, 10.h, 8.w, 14.h),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Wrap(spacing: 8.w, runSpacing: 4.h, crossAxisAlignment: WrapCrossAlignment.center, children: [
                Pill(d.typeLabel.toUpperCase(), tone: Tone.brand),
                if (d.type == 'meeting' && d.isToday)
                  Text('• ${d.untilLabel}', style: T.small.copyWith(color: C.warningDark, fontWeight: FontWeight.w700))
                else if (a != null && !d.isToday)
                  Pill(relDay(a), tone: daysFromToday(a) == 1 ? Tone.danger : Tone.neutral),
              ]),
            ),
            menu,
          ]),
          Padding(
            padding: EdgeInsets.only(right: 8.w),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(d.title, style: T.h1.copyWith(fontSize: 19.sp), maxLines: 3, overflow: TextOverflow.ellipsis),
              SizedBox(height: 10.h),
              Container(
                width: double.infinity, padding: EdgeInsets.all(10.w),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Wrap(spacing: 10.w, runSpacing: 4.h, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.schedule_rounded, size: 16.r, color: C.primary), SizedBox(width: 6.w),
                      Text(d.isToday || a == null ? d.timeRange : '${relDay(a)}, ${d.timeRange}', style: T.smallStrong),
                    ]),
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.apartment_rounded, size: 16.r, color: C.slate), SizedBox(width: 4.w),
                      Flexible(child: Text(d.venue, style: T.small, overflow: TextOverflow.ellipsis)),
                    ]),
                  ]),
                  if (d.role != null) ...[
                    SizedBox(height: 6.h),
                    Text.rich(TextSpan(style: T.small, children: [const TextSpan(text: 'Role: '), TextSpan(text: d.role, style: T.smallStrong)]),
                        maxLines: 2, overflow: TextOverflow.ellipsis),
                  ],
                  if (d.lead != null) Padding(padding: EdgeInsets.only(top: 4.h), child: Text('Lead: ${d.lead}', style: T.small)),
                  if (d.pick != null) Padding(padding: EdgeInsets.only(top: 4.h), child: Text(d.pick!, style: T.small.copyWith(color: C.warningDark))),
                ]),
              ),
              SizedBox(height: 12.h),
              if (d.type == 'meeting')
                Row(children: [
                  Flexible(
                    child: AppButton(d.joinedAt == null ? 'Join Stream' : 'Rejoin Stream', icon: Icons.videocam_outlined, small: true, expand: false, onPressed: () {
                      context.read<DutiesBloc>().add(DutyStreamJoined(d.id));
                      AppDialogs.showSnackBar(context, message: 'Joining stream… (simulated)');
                    }),
                  ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: () => showAgendaSheet(context, d), icon: Icon(Icons.description_outlined, size: 18.r, color: C.slate),
                    label: Text('Agenda Details', style: T.bodyStrong.copyWith(fontSize: 13.sp, color: C.slate)),
                  ),
                ])
              else if (swap != null)
                Row(children: [
                  const Pill('Swap request pending', tone: Tone.warning, icon: Icons.hourglass_top_rounded),
                  SizedBox(width: 8.w),
                  Expanded(child: Text('with ${swap.swapWith}', style: T.small, textAlign: TextAlign.end, maxLines: 1, overflow: TextOverflow.ellipsis)),
                ])
              else if (d.type == 'exam' || d.type == 'sports')
                Row(children: [
                  Flexible(child: AppButton('Request Swap', icon: Icons.swap_horiz_rounded, kind: BtnKind.outline, small: true, expand: false, onPressed: () => showSwapSheet(context, d))),
                  const Spacer(),
                  TextButton(onPressed: open, child: Text('Details', style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.sp))),
                ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// Homework still being graded (Figma "ACADEMIC DEADLINES & GRADING").
class HomeworkDeadlineCard extends StatelessWidget {
  const HomeworkDeadlineCard({super.key, required this.homework, required this.classGrade, required this.graded, required this.turnedIn, required this.toGrade, required this.evaluatedPct});
  final Homework homework;
  final String classGrade;
  final int graded, turnedIn, toGrade, evaluatedPct;

  @override
  Widget build(BuildContext context) {
    final due = DateTime.tryParse(homework.due);
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        radius: R.xl,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('$classGrade • ${homework.subject}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
            if (due != null) Pill('Due ${fmtShort(due)}', tone: Tone.danger),
          ]),
          SizedBox(height: 6.h),
          Text(homework.title, style: T.h2, maxLines: 2, overflow: TextOverflow.ellipsis),
          SizedBox(height: 12.h),
          Row(children: [
            Text('$graded/$turnedIn', style: T.h2.copyWith(color: C.primary)), SizedBox(width: 10.w),
            Expanded(child: AppProgress(turnedIn == 0 ? 0 : graded / turnedIn)),
          ]),
          SizedBox(height: 6.h),
          Row(children: [
            Expanded(child: Text('$evaluatedPct% evaluated', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
            Flexible(child: Text('$toGrade submissions pending', style: T.small.copyWith(color: C.warningDark), maxLines: 1, overflow: TextOverflow.ellipsis)),
          ]),
          SizedBox(height: 12.h),
          AppButton('Open Assignments', icon: Icons.assignment_outlined, onPressed: () => context.push(RoutePaths.homework(homework.id))),
        ]),
      ),
    );
  }
}

/// Link to the syllabus progress log with its submission state.
class SyllabusLogCard extends StatelessWidget {
  const SyllabusLogCard({super.key, required this.homeworkId, required this.submitted, this.due});
  final String homeworkId;
  final bool submitted;
  final DateTime? due;
  @override
  Widget build(BuildContext context) => AppCard(
        radius: R.xl, onTap: () => context.push(RoutePaths.homeworkProgress(homeworkId)),
        child: Row(children: [
          const IconTile(Icons.insights_rounded, tone: Tone.purple),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Monthly Syllabus Progress Log', style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis),
              Text(submitted ? 'Submitted to VP • awaiting approval' : 'Submit to VP by ${due == null ? '—' : '${fmtShort(due!)}, ${fmtClock(due!)}'}', style: T.small),
            ]),
          ),
          Icon(Icons.chevron_right_rounded, color: C.slate, size: 24.r),
        ]),
      );
}
