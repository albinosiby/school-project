import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/engage_notice.dart';
import '../bloc/live_classes_bloc.dart';
import '../bloc/live_classes_events.dart';
import '../bloc/live_classes_states.dart';
import '../models/live_class_models.dart';
import '../models/live_class_rules.dart';
import '../../school/bloc/school_bloc.dart';
import 'widgets/meet_actions.dart';
import 'widgets/engage_widgets.dart';

String _editPath(LiveSession e) => '${RoutePaths.liveClassSchedule}?id=${e.id}';
String _span(LiveSession e) => '${fmtTime(e.time)} – ${fmtTime(addMins(e.time, e.mins))}';

/// Live classes hub (Figma 1153:4722): live & upcoming, past recordings and the class schedule.
class LiveClassesScreen extends StatelessWidget {
  const LiveClassesScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<LiveClassesBloc>()..add(const LiveClassesLoadRequested()),
        child: const NoticeListener<LiveClassesBloc, LiveClassesState>(child: _LiveClassesView()),
      );
}

class _LiveClassesView extends StatefulWidget {
  const _LiveClassesView();
  @override
  State<_LiveClassesView> createState() => _LiveClassesViewState();
}

class _LiveClassesViewState extends State<_LiveClassesView> {
  int tab = 0;

  @override
  Widget build(BuildContext context) {
    final st = context.watch<LiveClassesBloc>().state;
    final up = st.upcoming, past = st.past;
    final tabs = ['Live & Upcoming (${up.length})', 'Past Recordings (${past.length})', 'Class Schedules'];
    final List<Widget> body = switch (tab) {
      0 => [
          if (up.isEmpty) const AppEmptyState('No upcoming sessions', hint: 'Tap Schedule Live Class to create one.', icon: Icons.videocam_off_outlined),
          if (up.isNotEmpty) _Hero(up.first),
          if (up.length > 1) ...[const _PipelineHeader(), for (final e in up.skip(1)) _PipelineCard(e)],
        ],
      1 => [
          if (past.isEmpty) const AppEmptyState('No recordings yet', icon: Icons.video_library_outlined),
          for (final e in past) _PastCard(e),
        ],
      _ => _schedule(up),
    };
    return DetailScaffold(
      title: 'Live Classes',
      bottom: AppButton('Schedule Live Class', icon: Icons.add_rounded, onPressed: () => context.push(RoutePaths.liveClassSchedule)),
      body: st.status != EngageStatus.loaded
          ? EngageStatusBody(status: st.status, error: st.error, onRetry: () => context.read<LiveClassesBloc>().add(const LiveClassesLoadRequested()))
          : ListView(padding: EdgeInsets.all(S.page), children: [
              Row(children: [
                const IconTile(Icons.cast_for_education_outlined),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('VIRTUAL CLASSROOM HUB', style: T.capsMuted.copyWith(fontSize: 10.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                    Text('Digital Sessions Manager', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ]),
                ),
              ]),
              SizedBox(height: 14.h),
              IdxChips(items: tabs, index: tab, onChanged: (i) => setState(() => tab = i)),
              SizedBox(height: 14.h),
              ...body,
              SizedBox(height: 8.h),
            ]),
    );
  }

  List<Widget> _schedule(List<LiveSession> rows) {
    if (rows.isEmpty) return [const AppEmptyState('Nothing scheduled', icon: Icons.event_busy_outlined)];
    final out = <Widget>[];
    String? last;
    for (final e in rows) {
      if (e.date != last) {
        out.add(SectionHeader('${fmtDay(e.date)} • ${fmtDate(e.date)}', caps: true));
        last = e.date;
      }
      out.add(Padding(
        padding: EdgeInsets.only(bottom: 10.h),
        child: AppCard(
          padding: EdgeInsets.all(12.w),
          onTap: () => context.push(_editPath(e)),
          child: Row(children: [
            IconTile(Icons.videocam_outlined, tone: e.isDraft ? Tone.warning : Tone.brand),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(e.title, style: T.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis),
                Text('${_span(e)} • ${e.audience}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              ]),
            ),
            if (e.isDraft) ...[SizedBox(width: 6.w), const Pill('Draft', tone: Tone.warning)],
          ]),
        ),
      ));
    }
    return out;
  }
}

class _PipelineHeader extends StatelessWidget {
  const _PipelineHeader();
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(2.w, 22.h, 2.w, 12.h),
        child: Row(children: [
          Expanded(child: Text('Scheduled Pipeline', style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis)),
          const Pill('Term 2 Active', tone: Tone.brand, dot: true),
        ]),
      );
}

Future<void> _copyLink(BuildContext context, LiveSession e) async {
  final link = e.link.isEmpty ? 'https://meet.google.com/edu-${e.id}' : (normalizeMeetLink(e.link) ?? e.link);
  await Clipboard.setData(ClipboardData(text: link));
  if (context.mounted) showNotice(context, 'Student link copied');
}

class _Hero extends StatelessWidget {
  const _Hero(this.e);
  final LiveSession e;
  @override
  Widget build(BuildContext context) {
    final joined = e.joined, total = e.total;
    final tag = e.isDraft ? 'DRAFT' : (e.tag.isEmpty ? '${fmtDay(e.date)} • ${fmtTime(e.time)}'.toUpperCase() : e.tag);
    return AppCard(
      padding: EdgeInsets.all(16.w), radius: R.xxl,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Align(alignment: Alignment.centerLeft, child: Pill(tag, tone: e.isDraft ? Tone.warning : Tone.brand, dot: true))),
          SizedBox(width: 8.w),
          Flexible(child: Pill(e.room, tone: Tone.neutral)),
        ]),
        SizedBox(height: 12.h),
        Text(e.title, style: T.h1, maxLines: 3, overflow: TextOverflow.ellipsis),
        SizedBox(height: 8.h),
        Row(children: [
          Icon(Icons.schedule_rounded, size: 16.r, color: C.primary), SizedBox(width: 6.w),
          Expanded(child: Text('${fmtDay(e.date)}, ${_span(e)} (${e.mins} mins)', style: T.body.copyWith(color: C.ink, fontSize: 13.sp), maxLines: 2, overflow: TextOverflow.ellipsis)),
        ]),
        SizedBox(height: 12.h),
        Container(
          padding: EdgeInsets.all(12.w),
          decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
          child: Row(children: [
            Icon(Icons.videocam_outlined, size: 16.r, color: C.slate), SizedBox(width: 6.w),
            Expanded(child: Text(e.medium, style: T.small.copyWith(color: C.ink), maxLines: 1, overflow: TextOverflow.ellipsis)),
            if (e.studentShare) ...[
              Icon(Icons.screen_share_outlined, size: 16.r, color: C.primary), SizedBox(width: 6.w),
              Text('Screen Share On', style: T.small.copyWith(color: C.primary)),
            ],
          ]),
        ),
        SizedBox(height: 14.h),
        Row(children: [
          const AvatarStack(names: ['Aarav S', 'Diya M', 'Kabir N'], size: 32),
          SizedBox(width: 6.w),
          if (total > 3) Text('+${(joined - 3).clamp(0, 999)}', style: T.small),
          const Spacer(),
          Flexible(
            flex: 4,
            child: Text.rich(
              TextSpan(children: [TextSpan(text: '$joined of $total', style: T.bodyStrong), TextSpan(text: ' Joined', style: T.small.copyWith(color: C.ink))]),
              maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.end,
            ),
          ),
        ]),
        SizedBox(height: 10.h),
        AppProgress(total == 0 ? 0 : joined / total),
        SizedBox(height: 14.h),
        if (isMeet(e)) ...[
          _MeetButtons(e),
          SizedBox(height: 10.h),
        ] else ...[
          AppButton('Start Class Now', icon: Icons.videocam_rounded, onPressed: () => context.push(RoutePaths.liveClassJoin(e.id))),
          SizedBox(height: 10.h),
        ],
        AppButton('Copy Student Link', icon: Icons.copy_rounded, kind: BtnKind.outline, onPressed: () => _copyLink(context, e)),
        SizedBox(height: 4.h),
        Center(child: TextButton(onPressed: () => context.push(_editPath(e)), child: const Text('Edit session'))),
      ]),
    );
  }
}

/// Join (enabled from 10 minutes before the start until the end) and Share for a Google Meet session.
class _MeetButtons extends StatelessWidget {
  const _MeetButtons(this.e, {this.small = false});
  final LiveSession e;
  final bool small;
  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final open = e.canJoin(now);
    final cls = context.watch<SchoolBloc>().state.classById(e.classId);
    final className = cls == null ? e.classId : classLabel(cls);
    final join = AppButton(open ? 'Join Google Meet' : e.statusLabel(now), icon: open ? Icons.videocam_rounded : Icons.schedule_rounded, small: small, expand: !small, onPressed: open ? () => joinMeet(context, e) : null);
    final share = AppButton('Share to WhatsApp', icon: Icons.share_rounded, kind: BtnKind.outline, small: small, expand: !small, onPressed: () => shareToWhatsApp(context, e, className: className));
    if (small) return Wrap(spacing: 8.w, runSpacing: 8.h, children: [join, share]);
    return Column(children: [join, SizedBox(height: 10.h), share, SizedBox(height: 10.h), JoinedCount(e.joined)]);
  }
}

class _PipelineCard extends StatelessWidget {
  const _PipelineCard(this.e);
  final LiveSession e;
  @override
  Widget build(BuildContext context) {
    final mat = e.material;
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        padding: EdgeInsets.all(14.w), radius: R.xl,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Flexible(child: Pill('${fmtDay(e.date)} • ${fmtTime(e.time)}', tone: Tone.brand, icon: Icons.event_outlined)),
            if (e.isDraft) ...[SizedBox(width: 6.w), const Pill('Draft', tone: Tone.warning)],
            const Spacer(),
            Text('${e.mins} mins', style: T.small),
          ]),
          SizedBox(height: 10.h),
          Text(e.title, style: T.h2, maxLines: 2, overflow: TextOverflow.ellipsis),
          SizedBox(height: 4.h),
          Text(e.audience, style: T.body.copyWith(fontSize: 13.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
          if (e.cohost.isNotEmpty) ...[
            SizedBox(height: 8.h),
            Row(children: [
              const Pill('AM', tone: Tone.purple), SizedBox(width: 8.w),
              Expanded(child: Text('Co-host: ${e.cohost}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
            ]),
          ],
          if (mat != null) ...[SizedBox(height: 10.h), AppFileChip(name: mat.name, size: mat.size)],
          if (isMeet(e) && !e.isDraft) ...[SizedBox(height: 10.h), _MeetButtons(e, small: true), SizedBox(height: 8.h), JoinedCount(e.joined)],
          SizedBox(height: 12.h),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            TextButton(
              style: TextButton.styleFrom(minimumSize: Size(44.w, 44.h)),
              onPressed: () async {
                final ok = await confirmAction(context, title: 'Cancel session?', message: 'This removes "${e.title}" from your schedule.', confirm: 'Cancel session', danger: true);
                if (ok && context.mounted) context.read<LiveClassesBloc>().add(LiveSessionDeleted(e.id, message: 'Session cancelled'));
              },
              child: Text('Cancel', style: T.bodyStrong.copyWith(color: C.danger, fontSize: 13.sp)),
            ),
            SizedBox(width: 8.w),
            AppButton('Edit Session', kind: BtnKind.soft, small: true, expand: false, onPressed: () => context.push(_editPath(e))),
          ]),
        ]),
      ),
    );
  }
}

class _PastCard extends StatelessWidget {
  const _PastCard(this.e);
  final LiveSession e;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 12.h),
        child: AppCard(
          padding: EdgeInsets.all(14.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Pill(fmtDate(e.date, year: true), tone: Tone.neutral, icon: Icons.event_outlined)),
              const Spacer(),
              Text('${e.mins} mins', style: T.small),
            ]),
            SizedBox(height: 8.h),
            Text(e.title, style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis),
            Text('${e.audience} • ${e.joined} attended', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
            SizedBox(height: 10.h),
            Row(children: [
              Expanded(
                child: AppButton(e.record ? 'Play Recording' : 'No recording', icon: Icons.play_circle_outline_rounded, kind: BtnKind.soft, small: true,
                    onPressed: e.record ? () => showNotice(context, 'Playing recording (simulated)') : null),
              ),
              SizedBox(width: 10.w),
              AppButton('Delete', kind: BtnKind.ghost, small: true, expand: false, onPressed: () async {
                final ok = await confirmAction(context, title: 'Delete recording?', message: 'This cannot be undone.', confirm: 'Delete', danger: true);
                if (ok && context.mounted) context.read<LiveClassesBloc>().add(LiveSessionDeleted(e.id, message: 'Recording deleted'));
              }),
            ]),
          ]),
        ),
      );
}
