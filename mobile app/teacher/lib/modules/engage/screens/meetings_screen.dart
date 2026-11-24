import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/link_launcher.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/engage_notice.dart';
import '../bloc/meetings_bloc.dart';
import '../bloc/meetings_events.dart';
import '../bloc/meetings_states.dart';
import '../models/meeting_models.dart';
import 'meeting_schedule_screen.dart' show isInPerson;
import 'widgets/engage_widgets.dart';
import 'widgets/meet_actions.dart' show showLinkFallback;

const _months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
String _span(Meeting e) => '${fmtTime(e.time)} – ${fmtTime(addMins(e.time, e.mins))}';

/// "Today", "Tomorrow", "In 3 days", else empty.
String _soon(Meeting e) {
  final d = parseIso(e.date);
  if (d == null) return '';
  final n = DateTime.now();
  final diff = DateTime(d.year, d.month, d.day).difference(DateTime(n.year, n.month, n.day)).inDays;
  if (diff < 0) return 'Overdue';
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Tomorrow';
  return diff <= 14 ? 'In $diff days' : '';
}

/// Parent-teacher meetings: upcoming, drafts and completed, each a card with the agenda and how parents attend.
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
  String tab = 'Upcoming';
  @override
  Widget build(BuildContext context) {
    final s = context.watch<MeetingsBloc>().state;
    final up = [
      for (final e in s.upcoming)
        if (e.status == MeetingStatus.upcoming) e,
    ];
    final drafts = [
      for (final e in s.upcoming)
        if (e.status == MeetingStatus.draft) e,
    ];
    final done = s.completed;
    final weekEnd = plusDays(7);
    final shown = switch (tab) {
      'Drafts' => drafts,
      'Completed' => done,
      _ => up,
    };
    return DetailScaffold(
      title: 'Parent Teacher Meetings',
      bottom: AppButton(
        'Schedule Meeting',
        icon: Icons.add_rounded,
        onPressed: () => context.push(RoutePaths.meetingSchedule),
      ),
      body: s.status != EngageStatus.loaded
          ? EngageStatusBody(
              status: s.status,
              error: s.error,
              onRetry: () => context.read<MeetingsBloc>().add(const MeetingsLoadRequested()),
            )
          : ListView(
              padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, S.page),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _Stat(
                        value: up.length,
                        label: 'Upcoming',
                        icon: Icons.event_available_rounded,
                        tone: Tone.brand,
                      ),
                    ),
                    SizedBox(width: 10.w),
                    Expanded(
                      child: _Stat(
                        value: up.where((e) => e.date.compareTo(weekEnd) <= 0).length,
                        label: 'This week',
                        icon: Icons.date_range_rounded,
                        tone: Tone.purple,
                      ),
                    ),
                    SizedBox(width: 10.w),
                    Expanded(
                      child: _Stat(
                        value: done.length,
                        label: 'Completed',
                        icon: Icons.task_alt_rounded,
                        tone: Tone.success,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 14.h),
                AppSegmented(
                  track: true,
                  items: const ['Upcoming', 'Drafts', 'Completed'],
                  value: tab,
                  onChanged: (v) => setState(() => tab = v),
                ),
                SizedBox(height: 14.h),
                if (shown.isEmpty)
                  AppEmptyState(
                    tab == 'Drafts'
                        ? 'No drafts'
                        : (tab == 'Completed' ? 'No completed meetings' : 'No upcoming meetings'),
                    hint: tab == 'Upcoming' ? 'Tap Schedule Meeting to invite parents.' : null,
                    icon: Icons.groups_outlined,
                  ),
                for (final e in shown) _MeetingCard(e),
              ],
            ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label, required this.icon, required this.tone});
  final int value;
  final String label;
  final IconData icon;
  final Tone tone;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 10.h),
      decoration: BoxDecoration(
        color: C.bg,
        borderRadius: BorderRadius.circular(R.lg),
        border: Border.all(color: C.border),
      ),
      child: Row(
        children: [
          Container(
            width: 30.r,
            height: 30.r,
            decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(R.sm)),
            child: Icon(icon, size: 16.r, color: c.fg),
          ),
          SizedBox(width: 8.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$value', style: T.h3.copyWith(height: 1.1)),
                Text(
                  label,
                  style: T.small.copyWith(fontSize: 10.5.sp),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MeetingCard extends StatefulWidget {
  const _MeetingCard(this.e);
  final Meeting e;
  @override
  State<_MeetingCard> createState() => _MeetingCardState();
}

class _MeetingCardState extends State<_MeetingCard> {
  bool expanded = false;

  Future<void> _join() async {
    final link = widget.e.link;
    final ok = link.isNotEmpty && await launchExternal(Uri.parse(link));
    if (!ok && mounted) await showLinkFallback(context, link);
  }

  Future<void> _menu(String v) async {
    final e = widget.e;
    final bloc = context.read<MeetingsBloc>();
    switch (v) {
      case 'edit':
        context.push('${RoutePaths.meetingSchedule}?id=${e.id}');
      case 'copy':
        await Clipboard.setData(ClipboardData(text: e.link));
        if (mounted) showNotice(context, 'Meet link copied');
      case 'done':
        bloc.add(MeetingCompleted(e.id));
      case 'delete':
        final upcoming = e.status == MeetingStatus.upcoming;
        final ok = await confirmAction(
          context,
          title: upcoming ? 'Cancel meeting?' : 'Delete meeting?',
          message: upcoming ? 'Parents are told that "${e.title}" is cancelled.' : 'This removes "${e.title}".',
          confirm: upcoming ? 'Cancel meeting' : 'Delete',
          danger: true,
        );
        if (ok) bloc.add(MeetingDeleted(e.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final e = widget.e;
    final inPerson = isInPerson(e);
    final done = e.completed, draft = e.status == MeetingStatus.draft;
    final d = parseIso(e.date);
    final tone = done ? Tone.neutral : (draft ? Tone.warning : Tone.brand);
    final c = toneColors(tone);
    final cls = context.watch<SchoolBloc>().state.classById(e.classId);
    final soon = done || draft ? '' : _soon(e);
    final shown = expanded ? e.agenda : e.agenda.take(3).toList();
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        padding: EdgeInsets.fromLTRB(14.w, 14.h, 4.w, 14.h),
        radius: R.xl,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 50.r,
                  padding: EdgeInsets.symmetric(vertical: 7.h),
                  decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(R.md)),
                  child: Column(
                    children: [
                      Text(d == null ? '' : '${d.day}', style: T.h2.copyWith(color: c.fg, height: 1.1)),
                      Text(
                        d == null ? '' : _months[d.month - 1],
                        style: T.small.copyWith(color: c.fg, fontSize: 10.sp, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(e.title, style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis),
                      SizedBox(height: 2.h),
                      Text(
                        [
                          cls == null ? e.audience : '${classLabel(cls)} parents',
                          if (e.category.isNotEmpty) e.category,
                        ].join(' • '),
                        style: T.small,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  tooltip: 'Meeting options',
                  icon: Icon(Icons.more_vert_rounded, color: C.slate, size: 20.r),
                  onSelected: _menu,
                  itemBuilder: (_) => [
                    if (!done) const PopupMenuItem(value: 'edit', child: Text('Edit meeting')),
                    if (!done && !inPerson && e.link.isNotEmpty)
                      const PopupMenuItem(value: 'copy', child: Text('Copy Meet link')),
                    if (!done && !draft) const PopupMenuItem(value: 'done', child: Text('Mark as completed')),
                    PopupMenuItem(
                      value: 'delete',
                      child: Text(
                        e.status == MeetingStatus.upcoming ? 'Cancel meeting' : 'Delete meeting',
                        style: TextStyle(color: C.danger),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            Padding(
              padding: EdgeInsets.only(right: 10.w),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(height: 12.h),
                  Wrap(
                    spacing: 6.w,
                    runSpacing: 6.h,
                    children: [
                      if (draft) const Pill('Draft', tone: Tone.warning),
                      if (done) const Pill('Completed', tone: Tone.neutral, icon: Icons.check_rounded),
                      if (soon.isNotEmpty) Pill(soon, tone: soon == 'Overdue' ? Tone.danger : Tone.success, dot: true),
                      Pill(
                        inPerson ? 'In person' : 'Online',
                        tone: inPerson ? Tone.purple : Tone.brand,
                        icon: inPerson ? Icons.apartment_rounded : Icons.videocam_outlined,
                      ),
                    ],
                  ),
                  SizedBox(height: 10.h),
                  _Info(Icons.schedule_rounded, '${fmtDate(e.date, year: true)} • ${_span(e)}'),
                  _Info(
                    inPerson ? Icons.place_outlined : Icons.link_rounded,
                    inPerson
                        ? (e.venue.isEmpty ? 'Venue not set' : e.venue)
                        : (e.link.isEmpty ? 'No Meet link' : e.link.replaceFirst('https://', '')),
                  ),
                  if (e.agenda.isNotEmpty) ...[
                    SizedBox(height: 10.h),
                    Container(
                      width: double.infinity,
                      padding: EdgeInsets.fromLTRB(12.w, 10.h, 12.w, 4.h),
                      decoration: BoxDecoration(
                        color: C.surface,
                        borderRadius: BorderRadius.circular(R.md),
                        border: Border.all(color: C.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'AGENDA • ${e.agenda.length} ${e.agenda.length == 1 ? 'POINT' : 'POINTS'}',
                            style: T.capsMuted.copyWith(fontSize: 10.sp),
                          ),
                          SizedBox(height: 8.h),
                          for (var i = 0; i < shown.length; i++)
                            Padding(
                              padding: EdgeInsets.only(bottom: 6.h),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${i + 1}.', style: T.smallStrong.copyWith(color: C.primary)),
                                  SizedBox(width: 6.w),
                                  Expanded(
                                    child: Text(
                                      shown[i].title,
                                      style: T.body.copyWith(color: C.ink, fontSize: 13.sp),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          if (e.agenda.length > 3)
                            TextButton(
                              style: TextButton.styleFrom(
                                padding: EdgeInsets.zero,
                                minimumSize: Size(44.w, 32.h),
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              onPressed: () => setState(() => expanded = !expanded),
                              child: Text(expanded ? 'Show less' : 'Show all ${e.agenda.length} points'),
                            ),
                        ],
                      ),
                    ),
                  ],
                  if (done && e.summary.isNotEmpty) ...[SizedBox(height: 10.h), Text(e.summary, style: T.small)],
                  if (!done && !draft && !inPerson && e.link.isNotEmpty) ...[
                    SizedBox(height: 12.h),
                    AppButton('Join Google Meet', icon: Icons.videocam_rounded, onPressed: _join),
                  ],
                  if (draft) ...[
                    SizedBox(height: 12.h),
                    AppButton(
                      'Finish & Send Invitation',
                      icon: Icons.edit_rounded,
                      kind: BtnKind.soft,
                      onPressed: () => context.push('${RoutePaths.meetingSchedule}?id=${e.id}'),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Info extends StatelessWidget {
  const _Info(this.icon, this.text);
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 4.h),
    child: Row(
      children: [
        Icon(icon, size: 15.r, color: C.primary),
        SizedBox(width: 8.w),
        Expanded(
          child: Text(
            text,
            style: T.body.copyWith(color: C.ink, fontSize: 13.sp),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    ),
  );
}
