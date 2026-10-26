import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/exam_duties_bloc.dart';
import '../bloc/exam_duties_events.dart';
import '../bloc/exam_duties_states.dart';
import 'widgets/engage_widgets.dart';
import 'widgets/swap_request_sheet.dart';

/// Figma 5.8.2 View Exam Duty Details.
class ExamDutyDetailScreen extends StatelessWidget {
  const ExamDutyDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<ExamDutiesBloc>()..add(const ExamDutiesLoadRequested()),
        child: NoticeListener<ExamDutiesBloc, ExamDutiesState>(child: _DetailView(id)),
      );
}

class _DetailView extends StatelessWidget {
  const _DetailView(this.id);
  final String id;

  @override
  Widget build(BuildContext context) {
    final st = context.watch<ExamDutiesBloc>().state;
    final e = st.byId(id);
    if (e == null) {
      return DetailScaffold(title: 'Exam Duty Details', body: EngageStatusBody(status: st.status, error: st.error, notFound: 'Duty not found'));
    }
    final me = context.select((SchoolBloc b) => b.state.teacher);
    final steps = [
      (addMins(e.start, -30), 'Briefing', 'Collect sealed envelopes from ${e.control.replaceFirst('Control ', '')} & attendance rolls.'),
      (e.start, 'Commence', 'Distribute Set A/B papers upon bell & verify student admit cards.'),
      (addMins(e.start, 90), 'Mid-Term', 'Announce elapsed time & issue supplement answer sheets.'),
      (e.end, 'Conclusion', 'Collect all ${e.candidates} scripts, seal bundle with wax & hand over.'),
    ];
    return DetailScaffold(
      title: 'Exam Duty Details',
      bottom: Row(children: [
        Expanded(child: AppButton('Hall Seating', icon: Icons.grid_view_rounded, kind: BtnKind.outline, onPressed: () => context.push(RoutePaths.examHall(id)))),
        SizedBox(width: 10.w),
        Expanded(
          child: AppButton(
            e.swapRequested ? 'Cancel Swap' : 'Request Swap', kind: e.swapRequested ? BtnKind.soft : BtnKind.primary,
            onPressed: () => e.swapRequested ? context.read<ExamDutiesBloc>().add(SwapCancelled(id)) : showSwapRequestSheet(context, e),
          ),
        ),
      ]),
      body: ListView(padding: EdgeInsets.all(S.page), children: [
        AppCard(
          padding: EdgeInsets.all(16.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Container(width: 8.r, height: 8.r, decoration: BoxDecoration(color: e.completed ? C.slate : C.primary, shape: BoxShape.circle)),
                    SizedBox(width: 8.w),
                    Text(e.completed ? 'COMPLETED' : 'CONFIRMED SHIFT', style: T.caps.copyWith(color: e.completed ? C.slate : C.primary, fontSize: 12.sp)),
                  ]),
                  SizedBox(height: 6.h),
                  Text(e.subject, style: T.h1, maxLines: 3, overflow: TextOverflow.ellipsis),
                  Text(e.sub, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
                ]),
              ),
              Icon(Icons.assignment_outlined, color: C.primary, size: 26.r),
            ]),
            Divider(height: 24.h, color: C.border),
            Row(children: [
              Expanded(child: _Info(icon: Icons.calendar_today_outlined, label: 'Date & Time', value: '${parseIso(e.date) == null ? '' : fmtDate(e.date)} • ${fmtTime(e.start)}')),
              SizedBox(width: 10.w),
              Expanded(child: _Info(icon: Icons.meeting_room_outlined, label: 'Venue', value: e.shortHall)),
            ]),
            SizedBox(height: 10.h),
            Container(
              padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
              decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
              child: Row(children: [
                Icon(Icons.alarm_rounded, size: 18.r, color: C.danger), SizedBox(width: 8.w),
                Expanded(child: Text('Reporting: ${fmtTime(e.report)} sharp', style: T.bodyStrong.copyWith(color: C.danger, fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
                const Pill('30m prior', tone: Tone.neutral),
              ]),
            ),
          ]),
        ),
        SizedBox(height: 12.h),
        AppCard(
          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 12.h),
          child: Row(children: [
            Expanded(child: _Strip(icon: Icons.groups_outlined, text: '${e.candidates} Candidates')),
            Expanded(child: _Strip(icon: Icons.badge_outlined, text: '${e.solo ? 1 : 2} Invigilators')),
          ]),
        ),
        SectionHeader('Invigilation Team', action: e.solo ? '1 Active' : '2 Active'),
        AppCard(
          padding: EdgeInsets.all(12.w),
          child: Column(children: [
            Row(children: [
              Avatar(me?.name ?? '', size: 42), SizedBox(width: 12.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(child: Text(me?.name ?? '', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    SizedBox(width: 6.w),
                    const Pill('YOU', tone: Tone.brand),
                  ]),
                  Text('${e.role} • ${me?.subjects ?? ''}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ]),
              ),
              if (e.chief) const Pill('Duty Lead', tone: Tone.brand),
            ]),
            if (!e.solo) ...[
              Divider(height: 20.h, color: C.border),
              Row(children: [
                Avatar(e.partner, size: 42, tone: Tone.purple), SizedBox(width: 12.w),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(e.partner, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                    Text('Partner • Script Custodian', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ]),
                ),
                IconButton(tooltip: 'Call ${e.partner}', onPressed: () => showNotice(context, 'Calling ${e.partner}…'), icon: Icon(Icons.call_outlined, color: C.primary, size: 20.r)),
              ]),
            ],
          ]),
        ),
        if (e.swapRequested)
          Padding(
            padding: EdgeInsets.only(top: 10.h),
            child: Align(alignment: Alignment.centerLeft, child: Pill('Swap requested with ${e.swapWith}', tone: Tone.warning, icon: Icons.swap_horiz_rounded)),
          ),
        const SectionHeader('Shift Timeline', action: 'SOP Milestones'),
        AppCard(
          padding: EdgeInsets.fromLTRB(12.w, 14.h, 12.w, 4.h),
          child: Column(children: [
            for (var i = 0; i < steps.length; i++) _TimelineRow(time: fmtTime(steps[i].$1), tag: steps[i].$2, text: steps[i].$3, first: i == 0, last: i == steps.length - 1),
          ]),
        ),
        SizedBox(height: 8.h),
      ]),
    );
  }
}

class _Info extends StatelessWidget {
  const _Info({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label, value;
  @override
  Widget build(BuildContext context) => Row(children: [
        Container(
          width: 36.r, height: 36.r,
          decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.sm)),
          child: Icon(icon, size: 18.r, color: C.primary),
        ),
        SizedBox(width: 8.w),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(value, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
          ]),
        ),
      ]);
}

class _Strip extends StatelessWidget {
  const _Strip({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(icon, size: 18.r, color: C.primary), SizedBox(width: 6.w),
        Flexible(child: Text(text, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
      ]);
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.time, required this.tag, required this.text, required this.first, required this.last});
  final String time, tag, text;
  final bool first, last;
  @override
  Widget build(BuildContext context) => IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SizedBox(
            width: 16.w,
            child: Column(children: [
              SizedBox(height: 4.h),
              Container(width: 10.r, height: 10.r, decoration: BoxDecoration(color: first ? C.primary : C.slate, shape: BoxShape.circle)),
              if (!last) Expanded(child: Container(width: 1.5, color: C.border)),
            ]),
          ),
          SizedBox(width: 10.w),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: 14.h),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(time, style: T.bodyStrong.copyWith(color: first ? C.primary : C.ink, fontSize: 13.sp))),
                  Pill(tag, tone: Tone.neutral),
                ]),
                SizedBox(height: 2.h),
                Text(text, style: T.small.copyWith(color: C.ink)),
              ]),
            ),
          ),
        ]),
      );
}
