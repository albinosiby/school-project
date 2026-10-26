import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/engage_notice.dart';
import '../bloc/exam_duties_bloc.dart';
import '../bloc/exam_duties_events.dart';
import '../bloc/exam_duties_states.dart';
import '../models/exam_duty_models.dart';
import 'widgets/engage_widgets.dart';
import 'widgets/swap_request_sheet.dart';

const _checklist = [
  'Collect sealed question paper packets by {t}',
  'Verify student photo IDs & admit cards before hall entry',
  'Ensure strict ban on mobile phones, smartwatches & notes',
  'Submit answer scripts count & signature sheet by {e}',
];

/// Figma 5.8 Exam Duties.
class ExamDutiesScreen extends StatelessWidget {
  const ExamDutiesScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<ExamDutiesBloc>()..add(const ExamDutiesLoadRequested()),
        child: const NoticeListener<ExamDutiesBloc, ExamDutiesState>(child: _ExamDutiesView()),
      );
}

class _ExamDutiesView extends StatefulWidget {
  const _ExamDutiesView();
  @override
  State<_ExamDutiesView> createState() => _ExamDutiesViewState();
}

class _ExamDutiesViewState extends State<_ExamDutiesView> {
  int tab = 0;

  @override
  Widget build(BuildContext context) {
    final st = context.watch<ExamDutiesBloc>().state;
    if (st.status != EngageStatus.loaded) {
      return DetailScaffold(title: 'Exam Duties', body: EngageStatusBody(status: st.status, error: st.error, onRetry: () => context.read<ExamDutiesBloc>().add(const ExamDutiesLoadRequested())));
    }
    final all = st.all, up = st.upcoming, done = st.completed, swaps = st.swaps;
    final tabs = ['All Duties (${all.length})', 'Upcoming (${up.length})', 'Completed (${done.length})', 'Swap Requests (${swaps.length})'];
    final shown = [all, up, done, swaps][tab];
    final next = st.next;
    final rest = up.skip(1).toList();
    return DetailScaffold(
      title: 'Exam Duties',
      body: ListView(padding: EdgeInsets.all(S.page), children: [
        if (next != null)
          AppCard(
            color: C.panel, border: C.panelBorder, radius: R.lg, padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
            child: Row(children: [
              Icon(Icons.alarm_on_rounded, color: C.primary, size: 22.r), SizedBox(width: 10.w),
              Expanded(
                child: Text.rich(
                  TextSpan(children: [
                    TextSpan(text: 'Next Duty: ', style: T.bodyStrong.copyWith(color: C.primary)),
                    TextSpan(text: '${fmtDay(next.date)}, ${fmtTime(next.report)}', style: T.body.copyWith(color: C.primary)),
                  ]),
                  maxLines: 2, overflow: TextOverflow.ellipsis,
                ),
              ),
              SizedBox(width: 8.w),
              Flexible(child: Pill(next.shortHall, tone: Tone.neutral)),
            ]),
          ),
        SizedBox(height: 12.h),
        IdxChips(items: tabs, index: tab, onChanged: (i) => setState(() => tab = i)),
        SizedBox(height: 14.h),
        if (tab == 0 || tab == 1) ...[
          if (next == null && shown.isEmpty) const AppEmptyState('No duties assigned', icon: Icons.assignment_late_outlined),
          if (next != null) _NextShift(next),
          if (next != null) _Protocol(next),
          if (rest.isNotEmpty) ...[
            SectionHeader('Upcoming Schedule', action: '${rest.length} remaining'),
            for (final e in rest) _DutyRow(e),
          ],
          if (tab == 0 && done.isNotEmpty) ...[
            const SectionHeader('Completed'),
            for (final e in done) _DutyRow(e),
          ],
        ] else ...[
          if (shown.isEmpty) AppEmptyState(tab == 2 ? 'No completed duties' : 'No swap requests', icon: Icons.swap_horiz_rounded),
          for (final e in shown) _DutyRow(e),
        ],
        SizedBox(height: 12.h),
        PanelCard(
          padding: EdgeInsets.all(14.w),
          child: Row(children: [
            const IconTile(Icons.support_agent_outlined), SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Exam Control Desk: Ext. 402', style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis),
                Text('Superintendent: Dr. A. Sharma', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              ]),
            ),
            SizedBox(width: 8.w),
            AppButton('Call', icon: Icons.call_outlined, small: true, expand: false, onPressed: () => showNotice(context, 'Calling Exam Control Desk (Ext. 402)…')),
          ]),
        ),
        SizedBox(height: 8.h),
      ]),
    );
  }
}

class _NextShift extends StatelessWidget {
  const _NextShift(this.e);
  final ExamDuty e;
  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.xl), border: Border.all(color: C.border)),
        clipBehavior: Clip.antiAlias,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            color: C.primary,
            padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 8.h),
            child: Row(children: [
              Container(width: 8.r, height: 8.r, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle)),
              SizedBox(width: 8.w),
              Expanded(
                child: Text('NEXT SHIFT • ${fmtDay(e.date).toUpperCase()}', maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: T.smallStrong.copyWith(color: Colors.white, letterSpacing: .5)),
              ),
              SizedBox(width: 8.w),
              Flexible(
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                  decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.sm)),
                  child: Text(e.control, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small.copyWith(color: C.primary, fontWeight: FontWeight.w700, fontSize: 11.sp)),
                ),
              ),
            ]),
          ),
          Padding(
            padding: EdgeInsets.all(14.w),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text('Session Code: ${e.code}', style: T.small.copyWith(color: C.primary), maxLines: 1, overflow: TextOverflow.ellipsis)),
                Pill('${e.candidates} Candidates', tone: Tone.neutral, icon: Icons.groups_outlined),
              ]),
              SizedBox(height: 8.h),
              Text(e.subject, style: T.h1, maxLines: 3, overflow: TextOverflow.ellipsis),
              Text(e.sub, style: T.body.copyWith(fontSize: 13.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
              SizedBox(height: 6.h),
              Row(children: [
                Icon(Icons.schedule_rounded, size: 16.r, color: C.primary), SizedBox(width: 6.w),
                Expanded(child: Text('${fmtDate(e.date, year: true)} • ${fmtTime(e.start)} – ${fmtTime(e.end)}', style: T.small.copyWith(color: C.ink), maxLines: 2, overflow: TextOverflow.ellipsis)),
              ]),
              SizedBox(height: 12.h),
              Container(
                padding: EdgeInsets.all(12.w),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const IconTile(Icons.meeting_room_outlined, size: 34), SizedBox(width: 10.w),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(e.hall, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
                        Text(e.venue, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
                      ]),
                    ),
                  ]),
                  Divider(height: 18.h, color: C.border),
                  Row(children: [
                    Icon(Icons.login_rounded, size: 16.r, color: C.slate), SizedBox(width: 6.w),
                    Expanded(
                      child: Text.rich(
                        TextSpan(children: [
                          TextSpan(text: 'Report at ', style: T.small),
                          TextSpan(text: fmtTime(e.report), style: T.smallStrong),
                          TextSpan(text: ' at ${e.control}', style: T.small),
                        ]),
                        maxLines: 2, overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ]),
                ]),
              ),
              SizedBox(height: 10.h),
              Container(
                padding: EdgeInsets.fromLTRB(12.w, 8.h, 4.w, 8.h),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
                child: Row(children: [
                  Avatar(e.solo ? 'Self' : e.partner, size: 40), SizedBox(width: 10.w),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(e.partner, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                      Text(e.partnerRole, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ]),
                  ),
                  if (!e.solo)
                    IconButton(
                      tooltip: 'Call ${e.partner}',
                      onPressed: () => showNotice(context, 'Calling ${e.partner}…'),
                      icon: Icon(Icons.call_outlined, color: C.primary, size: 20.r),
                    ),
                ]),
              ),
              SizedBox(height: 12.h),
              AppButton('View Hall Seating', icon: Icons.grid_view_rounded, onPressed: () => context.push(RoutePaths.examHall(e.id))),
              SizedBox(height: 8.h),
              Row(children: [
                Expanded(
                  child: AppButton(
                    e.swapRequested ? 'Swap Requested' : 'Request Swap', icon: Icons.swap_horiz_rounded, kind: BtnKind.outline,
                    onPressed: e.swapRequested ? () => showNotice(context, 'Swap request pending with ${e.swapWith}') : () => showSwapRequestSheet(context, e),
                  ),
                ),
                SizedBox(width: 10.w),
                Expanded(child: AppButton('Details', kind: BtnKind.soft, onPressed: () => context.push(RoutePaths.examDuty(e.id)))),
              ]),
            ]),
          ),
        ]),
      );
}

class _Protocol extends StatelessWidget {
  const _Protocol(this.e);
  final ExamDuty e;
  @override
  Widget build(BuildContext context) {
    final checked = e.checked.toSet();
    return Padding(
      padding: EdgeInsets.only(top: 12.h),
      child: AppCard(
        padding: EdgeInsets.all(14.w),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const IconTile(Icons.checklist_rounded, size: 34), SizedBox(width: 10.w),
            Expanded(child: Text('Invigilator Protocol Checklist', style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis)),
            const Pill('Mandatory', tone: Tone.brand),
          ]),
          SizedBox(height: 6.h),
          for (var i = 0; i < _checklist.length; i++)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero, dense: true, controlAffinity: ListTileControlAffinity.leading, value: checked.contains(i),
              onChanged: (v) => context.read<ExamDutiesBloc>().add(ChecklistItemToggled(e.id, i, checked: v == true)),
              title: Text(
                _checklist[i].replaceAll('{t}', fmtTime(addMins(e.start, -20))).replaceAll('{e}', fmtTime(addMins(e.end, 20))),
                style: T.body.copyWith(color: C.ink, fontSize: 13.sp, decoration: checked.contains(i) ? TextDecoration.lineThrough : null),
              ),
            ),
          SizedBox(height: 6.h),
          AppButton('Download Invigilation Handbook (PDF)', icon: Icons.download_outlined, kind: BtnKind.outline,
              onPressed: () => showNotice(context, 'Invigilation handbook downloaded (simulated)')),
        ]),
      ),
    );
  }
}

class _DutyRow extends StatelessWidget {
  const _DutyRow(this.e);
  final ExamDuty e;
  @override
  Widget build(BuildContext context) {
    final (label, tone) = e.completed
        ? ('Completed', Tone.neutral)
        : e.swapRequested
            ? ('Swap requested', Tone.warning)
            : e.chief
                ? ('Chief Invigilator', Tone.purple)
                : ('Confirmed', Tone.success);
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppCard(
        padding: EdgeInsets.all(14.w), onTap: () => context.push(RoutePaths.examDuty(e.id)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Flexible(child: Text(fmtDate(e.date), style: T.bodyStrong.copyWith(color: C.primary), maxLines: 1, overflow: TextOverflow.ellipsis)),
            SizedBox(width: 8.w),
            Pill(label, tone: tone),
            const Spacer(),
            Icon(Icons.chevron_right_rounded, color: C.muted, size: 20.r),
          ]),
          SizedBox(height: 6.h),
          Text(e.subject, style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis),
          Text('${e.cls} • ${e.hall} • ${fmtTime(e.start)} – ${fmtTime(e.end)}', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
          Text(e.solo ? 'Role: Self (Lead Chief Invigilator)' : 'Co-Invigilator: ${e.partner}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
      ),
    );
  }
}
