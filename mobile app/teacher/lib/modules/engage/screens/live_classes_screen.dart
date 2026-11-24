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

/// "Today", "Tomorrow", else "Wednesday, 26 Nov".
String _dayLabel(String iso) {
  final d = fmtDay(iso);
  return d == 'Today' || d == 'Tomorrow' ? d : fmtDate(iso).replaceFirst(RegExp(r'^\w+,'), '$d,');
}

String _className(BuildContext context, LiveSession e) {
  final c = context.read<SchoolBloc>().state.classById(e.classId);
  return c == null ? e.audience : classLabel(c);
}

/// Live classes hub: the next session up front, then upcoming by day, drafts and past sessions.
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
  String tab = 'Upcoming';

  @override
  Widget build(BuildContext context) {
    final st = context.watch<LiveClassesBloc>().state;
    final now = DateTime.now();
    final up = [
      for (final e in st.upcoming)
        if (!e.isDraft && e.phase(now) != LivePhase.ended) e,
    ];
    final drafts = [
      for (final e in st.upcoming)
        if (e.isDraft) e,
    ];
    final past = [
      ...st.past,
      for (final e in st.upcoming)
        if (!e.isDraft && e.phase(now) == LivePhase.ended) e,
    ]..sort((a, b) => b.sortKey.compareTo(a.sortKey));
    final today = todayIso(), weekEnd = plusDays(7);
    final todayCount = up.where((e) => e.date == today).length;
    final weekCount = up.where((e) => e.date.compareTo(weekEnd) <= 0).length;

    final List<Widget> body = switch (tab) {
      'Drafts' => [
        if (drafts.isEmpty)
          const AppEmptyState(
            'No drafts',
            hint: 'Sessions saved with Save Draft wait here.',
            icon: Icons.edit_note_rounded,
          ),
        for (final e in drafts) _SessionTile(e),
      ],
      'Past' => [
        if (past.isEmpty) const AppEmptyState('No past sessions yet', icon: Icons.history_rounded),
        ..._byDay(past, (e) => _SessionTile(e, past: true)),
      ],
      _ => [
        if (up.isEmpty)
          const AppEmptyState(
            'No upcoming sessions',
            hint: 'Tap Schedule Live Class to create one.',
            icon: Icons.videocam_off_outlined,
          )
        else ...[
          _SectionLabel('Up next'),
          _NextCard(up.first),
          if (up.length > 1) ..._byDay(up.skip(1).toList(), (e) => _SessionTile(e)),
        ],
      ],
    };

    return DetailScaffold(
      title: 'Live Classes',
      bottom: AppButton(
        'Schedule Live Class',
        icon: Icons.add_rounded,
        onPressed: () => context.push(RoutePaths.liveClassSchedule),
      ),
      body: st.status != EngageStatus.loaded
          ? EngageStatusBody(
              status: st.status,
              error: st.error,
              onRetry: () => context.read<LiveClassesBloc>().add(const LiveClassesLoadRequested()),
            )
          : RefreshIndicator(
              onRefresh: () async => context.read<LiveClassesBloc>().add(const LiveClassesLoadRequested()),
              child: ListView(
                padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, S.page),
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _Stat(value: todayCount, label: 'Today', icon: Icons.today_rounded, tone: Tone.brand),
                      ),
                      SizedBox(width: 10.w),
                      Expanded(
                        child: _Stat(
                          value: weekCount,
                          label: 'Next 7 days',
                          icon: Icons.date_range_rounded,
                          tone: Tone.purple,
                        ),
                      ),
                      SizedBox(width: 10.w),
                      Expanded(
                        child: _Stat(
                          value: drafts.length,
                          label: 'Drafts',
                          icon: Icons.edit_note_rounded,
                          tone: Tone.warning,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 14.h),
                  AppSegmented(
                    track: true,
                    items: ['Upcoming', 'Drafts', 'Past'],
                    value: tab,
                    onChanged: (v) => setState(() => tab = v),
                  ),
                  SizedBox(height: 6.h),
                  ...body,
                  SizedBox(height: 8.h),
                ],
              ),
            ),
    );
  }

  /// Rows under a day heading each time the date changes.
  List<Widget> _byDay(List<LiveSession> rows, Widget Function(LiveSession) tile) {
    final out = <Widget>[];
    String? last;
    for (final e in rows) {
      if (e.date != last) {
        out.add(_SectionLabel(_dayLabel(e.date)));
        last = e.date;
      }
      out.add(tile(e));
    }
    return out;
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(2.w, 16.h, 2.w, 8.h),
    child: Text(
      text.toUpperCase(),
      style: T.capsMuted.copyWith(fontSize: 11.sp, letterSpacing: .6),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    ),
  );
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

Future<void> _copyLink(BuildContext context, LiveSession e) async {
  final link = e.link.isEmpty ? 'https://meet.google.com/edu-${e.id}' : (normalizeMeetLink(e.link) ?? e.link);
  await Clipboard.setData(ClipboardData(text: link));
  if (context.mounted) showNotice(context, 'Student link copied');
}

Future<void> _cancel(BuildContext context, LiveSession e, {bool past = false}) async {
  final ok = await confirmAction(
    context,
    title: past ? 'Delete session?' : 'Cancel session?',
    message: past ? 'This removes "${e.title}" from your history.' : 'This removes "${e.title}" from your schedule.',
    confirm: past ? 'Delete' : 'Cancel session',
    danger: true,
  );
  if (ok && context.mounted) {
    context.read<LiveClassesBloc>().add(
      LiveSessionDeleted(e.id, message: past ? 'Session deleted' : 'Session cancelled'),
    );
  }
}

/// Edit / copy link / share / cancel menu shared by the cards.
class _Menu extends StatelessWidget {
  const _Menu(this.e, {this.past = false, this.light = false});
  final LiveSession e;
  final bool past, light;
  @override
  Widget build(BuildContext context) => PopupMenuButton<String>(
    tooltip: 'More',
    icon: Icon(Icons.more_vert_rounded, color: light ? Colors.white : C.slate, size: 20.r),
    onSelected: (v) => switch (v) {
      'edit' => context.push(_editPath(e)),
      'copy' => _copyLink(context, e),
      'share' => shareToWhatsApp(context, e, className: _className(context, e)),
      _ => _cancel(context, e, past: past),
    },
    itemBuilder: (_) => [
      if (!past) const PopupMenuItem(value: 'edit', child: Text('Edit session')),
      if (!past && !e.isDraft) const PopupMenuItem(value: 'copy', child: Text('Copy student link')),
      if (!past && !e.isDraft && isMeet(e)) const PopupMenuItem(value: 'share', child: Text('Share on WhatsApp')),
      PopupMenuItem(
        value: 'cancel',
        child: Text(
          past ? 'Delete' : (e.isDraft ? 'Discard draft' : 'Cancel session'),
          style: TextStyle(color: C.danger),
        ),
      ),
    ],
  );
}

/// The next session: big gradient card with the countdown, Join and Share.
class _NextCard extends StatelessWidget {
  const _NextCard(this.e);
  final LiveSession e;
  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final open = e.canJoin(now);
    final live = e.phase(now) == LivePhase.open && !now.isBefore(e.start ?? now);
    final white70 = Colors.white.withValues(alpha: .78);
    Widget meta(IconData icon, String text) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14.r, color: white70),
        SizedBox(width: 5.w),
        Flexible(
          child: Text(
            text,
            style: T.small.copyWith(color: Colors.white, fontSize: 12.sp),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
    return Container(
      decoration: BoxDecoration(
        color: C.bg,
        borderRadius: BorderRadius.circular(R.xl),
        border: Border.all(color: C.border),
        boxShadow: [BoxShadow(color: C.primary.withValues(alpha: .12), blurRadius: 18, offset: const Offset(0, 6))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: EdgeInsets.fromLTRB(16.w, 12.h, 4.w, 16.h),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [C.primary, C.primaryDark],
              ),
              borderRadius: BorderRadius.vertical(top: Radius.circular(R.xl)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
                      decoration: BoxDecoration(
                        color: live ? C.danger : Colors.white.withValues(alpha: .18),
                        borderRadius: BorderRadius.circular(R.pill),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6.r,
                            height: 6.r,
                            decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                          ),
                          SizedBox(width: 6.w),
                          Text(
                            e.statusLabel(now),
                            style: T.smallStrong.copyWith(color: Colors.white, fontSize: 11.5.sp),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    _Menu(e, light: true),
                  ],
                ),
                SizedBox(height: 10.h),
                Padding(
                  padding: EdgeInsets.only(right: 12.w),
                  child: Text(
                    e.title,
                    style: T.h2.copyWith(color: Colors.white),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                SizedBox(height: 4.h),
                Text(
                  [if (e.subject.isNotEmpty) e.subject, _className(context, e)].join(' • '),
                  style: T.small.copyWith(color: white70, fontSize: 12.5.sp),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: 12.h),
                Wrap(
                  spacing: 14.w,
                  runSpacing: 6.h,
                  children: [
                    meta(Icons.event_rounded, _dayLabel(e.date)),
                    meta(Icons.schedule_rounded, '${_span(e)} • ${e.mins} min'),
                    meta(Icons.videocam_outlined, e.medium),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.all(14.w),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (e.category.isNotEmpty || e.materials.isNotEmpty) ...[
                  Wrap(
                    spacing: 6.w,
                    runSpacing: 6.h,
                    children: [
                      if (e.category.isNotEmpty) Pill(e.category, tone: Tone.neutral),
                      if (e.notify)
                        const Pill('Parents notified', tone: Tone.success, icon: Icons.notifications_active_outlined),
                    ],
                  ),
                  SizedBox(height: 10.h),
                ],
                for (final m in e.materials) ...[
                  AppFileChip(
                    name: m.name,
                    size: m.size,
                    onTap: m.url.startsWith('http') ? () => openFileRef(context, m) : null,
                  ),
                  SizedBox(height: 8.h),
                ],
                if (isMeet(e)) ...[
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: AppButton(
                          open ? 'Join Google Meet' : e.statusLabel(now),
                          icon: open ? Icons.videocam_rounded : Icons.schedule_rounded,
                          onPressed: open ? () => joinMeet(context, e) : null,
                        ),
                      ),
                      SizedBox(width: 10.w),
                      Expanded(
                        flex: 2,
                        child: AppButton(
                          'Share to WhatsApp',
                          icon: Icons.share_rounded,
                          kind: BtnKind.outline,
                          onPressed: () => shareToWhatsApp(context, e, className: _className(context, e)),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 10.h),
                  JoinedCount(e.joined),
                ] else ...[
                  AppButton(
                    'Start Class Now',
                    icon: Icons.videocam_rounded,
                    onPressed: () => context.push(RoutePaths.liveClassJoin(e.id)),
                  ),
                  SizedBox(height: 8.h),
                  AppButton(
                    'Copy Student Link',
                    icon: Icons.copy_rounded,
                    kind: BtnKind.outline,
                    onPressed: () => _copyLink(context, e),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact row: date block, title, subject • class, time and notes; Join appears when the room is open.
class _SessionTile extends StatelessWidget {
  const _SessionTile(this.e, {this.past = false});
  final LiveSession e;
  final bool past;
  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final d = parseIso(e.date);
    final open = !past && e.canJoin(now);
    final tone = e.isDraft ? Tone.warning : (past ? Tone.neutral : Tone.brand);
    final c = toneColors(tone);
    final status = e.isDraft
        ? const Pill('Draft', tone: Tone.warning)
        : past
        ? Pill('${e.joined} joined', tone: Tone.neutral, icon: Icons.how_to_reg_outlined)
        : Pill(e.statusLabel(now), tone: open ? Tone.success : Tone.brand);
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppCard(
        padding: EdgeInsets.fromLTRB(12.w, 12.h, 2.w, 12.h),
        onTap: past ? null : () => context.push(_editPath(e)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 48.r,
                  padding: EdgeInsets.symmetric(vertical: 6.h),
                  decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(R.md)),
                  child: Column(
                    children: [
                      Text(d == null ? '' : '${d.day}', style: T.h3.copyWith(color: c.fg, height: 1.1)),
                      Text(
                        d == null
                            ? ''
                            : const [
                                'JAN',
                                'FEB',
                                'MAR',
                                'APR',
                                'MAY',
                                'JUN',
                                'JUL',
                                'AUG',
                                'SEP',
                                'OCT',
                                'NOV',
                                'DEC',
                              ][d.month - 1],
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
                      Text(e.title, style: T.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis),
                      SizedBox(height: 2.h),
                      Text(
                        [if (e.subject.isNotEmpty) e.subject, _className(context, e)].join(' • '),
                        style: T.small,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      SizedBox(height: 6.h),
                      Row(
                        children: [
                          Icon(Icons.schedule_rounded, size: 13.r, color: C.slate),
                          SizedBox(width: 4.w),
                          Flexible(
                            child: Text(
                              _span(e),
                              style: T.small.copyWith(color: C.ink, fontSize: 11.5.sp),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (e.materials.isNotEmpty) ...[
                            SizedBox(width: 10.w),
                            Icon(Icons.attach_file_rounded, size: 13.r, color: C.slate),
                            SizedBox(width: 2.w),
                            Text('${e.materials.length}', style: T.small.copyWith(fontSize: 11.5.sp)),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                _Menu(e, past: past),
              ],
            ),
            Padding(
              padding: EdgeInsets.only(left: 60.w, top: 8.h, right: 10.w),
              child: Row(
                children: [
                  Flexible(child: status),
                  const Spacer(),
                  if (open)
                    AppButton(
                      'Join',
                      icon: Icons.videocam_rounded,
                      small: true,
                      expand: false,
                      onPressed: () => isMeet(e) ? joinMeet(context, e) : context.push(RoutePaths.liveClassJoin(e.id)),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
