import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/engage_notice.dart';
import '../bloc/meetings_bloc.dart';
import '../bloc/meetings_events.dart';
import '../bloc/meetings_states.dart';
import '../models/meeting_models.dart';
import 'widgets/engage_widgets.dart';

String _whenTag(Meeting e) {
  if (e.completed) return 'COMPLETED';
  if (e.status == MeetingStatus.draft) return 'DRAFT';
  final d = parseIso(e.date);
  if (d == null) return 'UPCOMING';
  final n = DateTime.now();
  final diff = DateTime(d.year, d.month, d.day).difference(DateTime(n.year, n.month, n.day)).inDays;
  if (diff <= 0) return 'TODAY';
  return 'UPCOMING IN $diff DAY${diff == 1 ? '' : 'S'}';
}

/// Parent-teacher meetings list (Figma 1153:6046).
class MeetingsScreen extends StatelessWidget {
  const MeetingsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MeetingsBloc>()..add(const MeetingsLoadRequested()),
        child: const NoticeListener<MeetingsBloc, MeetingsState>(child: _MeetingsView()),
      );
}

class _MeetingsView extends StatefulWidget {
  const _MeetingsView();
  @override
  State<_MeetingsView> createState() => _MeetingsViewState();
}

class _MeetingsViewState extends State<_MeetingsView> {
  int tab = 0;
  @override
  Widget build(BuildContext context) {
    final s = context.watch<MeetingsBloc>().state;
    final all = s.all, up = s.upcoming, done = s.completed;
    final shown = [all, up, done][tab];
    return DetailScaffold(
      title: 'Parent Teacher Meetings',
      bottom: AppButton('Schedule Meeting', icon: Icons.add_rounded, onPressed: () => context.push(RoutePaths.meetingSchedule)),
      body: s.status != EngageStatus.loaded
          ? EngageStatusBody(status: s.status, error: s.error, onRetry: () => context.read<MeetingsBloc>().add(const MeetingsLoadRequested()))
          : ListView(padding: EdgeInsets.all(S.page), children: [
              IdxChips(items: ['All Meetings (${all.length})', 'Upcoming (${up.length})', 'Completed (${done.length})'], index: tab, onChanged: (i) => setState(() => tab = i)),
              SizedBox(height: 14.h),
              if (shown.isEmpty) const AppEmptyState('No meetings', hint: 'Schedule a parent meeting to get started.', icon: Icons.groups_outlined),
              for (final e in shown) _MeetingCard(e),
            ]),
    );
  }
}

class _MeetingCard extends StatelessWidget {
  const _MeetingCard(this.e);
  final Meeting e;
  @override
  Widget build(BuildContext context) {
    final agenda = e.agenda;
    final pct = e.total == 0 ? 0 : (e.rsvp * 100 / e.total).round();
    final done = e.completed;
    final tag = _whenTag(e);
    const names = ['Rajesh S', 'Meena K', 'Anil V', 'Neha K'];
    const tones = [Tone.brand, Tone.purple, Tone.success, Tone.warning];
    return Padding(
      padding: EdgeInsets.only(bottom: 14.h),
      child: AppCard(
        padding: EdgeInsets.all(16.w), radius: R.xxl,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Wrap(spacing: 6.w, runSpacing: 6.h, children: [
                Pill(tag, tone: done ? Tone.neutral : (tag == 'DRAFT' ? Tone.warning : Tone.success), dot: !done),
                if (e.audience.isNotEmpty) Pill(e.audience, tone: Tone.brand),
                if (e.format.isNotEmpty) Pill(e.format, tone: Tone.neutral),
              ]),
            ),
            PopupMenuButton<String>(
              tooltip: 'Meeting options',
              icon: Icon(Icons.more_vert_rounded, color: C.slate, size: 22.r),
              onSelected: (v) async {
                if (v == 'edit') context.push('${RoutePaths.meetingSchedule}?id=${e.id}');
                if (v == 'delete') {
                  final bloc = context.read<MeetingsBloc>();
                  final ok = await confirmAction(context, title: 'Delete meeting?', message: 'Parents will no longer see "${e.title}".', confirm: 'Delete', danger: true);
                  if (ok) bloc.add(MeetingDeleted(e.id));
                }
              },
              itemBuilder: (_) => [
                if (!done) const PopupMenuItem(value: 'edit', child: Text('Edit meeting')),
                const PopupMenuItem(value: 'delete', child: Text('Delete meeting')),
              ],
            ),
          ]),
          SizedBox(height: 10.h),
          Text(e.title, style: T.h1.copyWith(fontSize: 19.sp), maxLines: 3, overflow: TextOverflow.ellipsis),
          SizedBox(height: 10.h),
          Row(children: [
            Icon(Icons.event_outlined, size: 16.r, color: C.primary), SizedBox(width: 8.w),
            Expanded(
              child: Text('${fmtDate(e.date, year: true)} • ${fmtTime(e.time)} – ${fmtTime(addMins(e.time, e.mins))}',
                  style: T.bodyStrong.copyWith(fontWeight: FontWeight.w500, fontSize: 13.5.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
            ),
          ]),
          SizedBox(height: 6.h),
          Row(children: [
            Icon(Icons.place_outlined, size: 16.r, color: C.primary), SizedBox(width: 8.w),
            Expanded(child: Text(e.venue, style: T.body.copyWith(fontSize: 13.5.sp), maxLines: 2, overflow: TextOverflow.ellipsis)),
          ]),
          SizedBox(height: 12.h),
          Container(
            width: double.infinity, padding: EdgeInsets.all(14.w),
            decoration: BoxDecoration(color: C.panel, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.panelBorder)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text('AGENDA HIGHLIGHTS • ${e.mins} MINS', style: T.caps.copyWith(fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
                Text('${agenda.length} Key Topics', style: T.small),
              ]),
              SizedBox(height: 8.h),
              if (agenda.isEmpty) Text('No agenda added yet', style: T.small),
              for (var i = 0; i < agenda.length; i++)
                Padding(
                  padding: EdgeInsets.only(bottom: 6.h),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      width: 20.r, height: 20.r, alignment: Alignment.center,
                      decoration: const BoxDecoration(color: C.bg, shape: BoxShape.circle),
                      child: Text('${i + 1}', style: T.small.copyWith(color: C.primary, fontWeight: FontWeight.w800, fontSize: 10.5.sp)),
                    ),
                    SizedBox(width: 8.w),
                    Expanded(child: Text(agenda[i].title, style: T.body.copyWith(color: C.ink, fontSize: 13.sp))),
                  ]),
                ),
            ]),
          ),
          SizedBox(height: 14.h),
          Row(children: [
            Expanded(
              child: Text.rich(
                TextSpan(children: [
                  TextSpan(text: '$pct% RSVP Confirmed', style: T.bodyStrong.copyWith(fontWeight: FontWeight.w500, fontSize: 13.sp)),
                  TextSpan(text: ' (${e.rsvp} of ${e.total} In)', style: T.small),
                ]),
                maxLines: 1, overflow: TextOverflow.ellipsis,
              ),
            ),
            if (pct >= 50)
              Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.check_rounded, size: 14.r, color: C.successDark),
                Text(' Quorum Met', style: T.small.copyWith(color: C.successDark, fontWeight: FontWeight.w700)),
              ]),
          ]),
          SizedBox(height: 8.h),
          AppProgress(e.total == 0 ? 0 : e.rsvp / e.total),
          SizedBox(height: 12.h),
          Row(children: [
            AvatarStack(names: names.take(4).toList(), tones: tones, size: 36),
            SizedBox(width: 6.w),
            Text('+${(e.rsvp - 4).clamp(0, 999)}', style: T.small),
            const Spacer(),
            Flexible(
              flex: 3,
              child: Text.rich(
                TextSpan(children: [TextSpan(text: 'Target: ', style: T.small), TextSpan(text: '${e.target}%', style: T.smallStrong)]),
                maxLines: 1, overflow: TextOverflow.ellipsis,
              ),
            ),
          ]),
          if (e.file != null) ...[SizedBox(height: 12.h), AppFileChip(name: e.file!.name, size: e.file!.size)],
          SizedBox(height: 14.h),
          if (done) ...[
            if (e.summary.isNotEmpty) Padding(padding: EdgeInsets.only(bottom: 10.h), child: Text(e.summary, style: T.body)),
            AppButton('Meeting Completed', icon: Icons.check_circle_outline, kind: BtnKind.soft, onPressed: () => showNotice(context, 'Meeting summary saved')),
          ] else
            AppButton('Start / Join Meet', icon: Icons.videocam_rounded, onPressed: () => context.push(RoutePaths.meetingJoin(e.id))),
        ]),
      ),
    );
  }
}
