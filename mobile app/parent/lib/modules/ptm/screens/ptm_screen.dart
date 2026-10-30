import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/link_launcher.dart';
import '../../family/models/family_models.dart';
import '../../family/screens/widgets/child_switcher.dart';
import '../../student/models/student_models.dart';
import '../../teachers/screens/widgets/contact_actions.dart';
import '../bloc/ptm_action_bloc.dart';
import '../bloc/ptm_bloc.dart';
import '../models/ptm_models.dart';
import 'widgets/ptm_booking_sheet.dart';

/// Figma 5.5 "Parent Teacher Meeting": upcoming / past meetings, book a slot, reschedule, cancel, join.
/// [teacherId] (from the Teachers list) opens the booking sheet with that teacher selected.
class PtmScreen extends StatefulWidget {
  const PtmScreen({super.key, this.teacherId});
  final String? teacherId;

  @override
  State<PtmScreen> createState() => _PtmScreenState();
}

class _PtmScreenState extends State<PtmScreen> {
  late String? _pendingTeacher = widget.teacherId;

  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<PtmActionBloc>(),
    child: BlocListener<PtmActionBloc, PtmActionState>(
      listenWhen: (a, b) =>
          a.status != b.status &&
          (b.status == PtmActionStatus.success ||
              (b.status == PtmActionStatus.failure && b.error != null)),
      listener: (context, s) {
        if (s.status == PtmActionStatus.failure) {
          AppDialogs.showSnackBar(context, message: s.error!, isError: true);
          return;
        }
        final m = s.meeting;
        final when = m == null
            ? ''
            : ' for ${fmtDate(m.start)}, ${fmtClock(m.start)}';
        final msg = switch (s.action) {
          PtmAction.book => 'Meeting booked with ${m?.teacherName}$when',
          PtmAction.reschedule => 'Meeting moved$when',
          PtmAction.cancel => 'Meeting cancelled',
          _ => null,
        };
        if (msg != null) AppDialogs.showSnackBar(context, message: msg);
      },
      child: DetailScaffold(
        title: 'Meetings',
        subtitle: 'Parent-teacher meetings',
        fallbackRoute: RoutePaths.more,
        actions: const [HubHeaderActions()],
        body: ColoredBox(
          color: C.surface,
          child: Column(
            children: [
              const ChildSwitcher(),
              Expanded(
                child: ChildDataView<PtmBloc, PtmData>(
                  create: () => getIt<PtmBloc>(),
                  refreshable: false,
                  builder: (context, data, child) => _PtmBody(
                    data: data,
                    child: child,
                    openFor: _pendingTeacher,
                    onOpened: () => _pendingTeacher = null,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _PtmBody extends StatefulWidget {
  const _PtmBody({
    required this.data,
    required this.child,
    this.openFor,
    required this.onOpened,
  });
  final PtmData data;
  final Child child;
  final String? openFor;
  final VoidCallback onOpened;

  @override
  State<_PtmBody> createState() => _PtmBodyState();
}

class _PtmBodyState extends State<_PtmBody> {
  static const _all = 'All', _upcoming = 'Upcoming', _past = 'Past';
  String _tab = _all;

  @override
  void initState() {
    super.initState();
    final t = widget.openFor;
    if (t != null) {
      widget.onOpened();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _book(teacherId: t);
      });
    }
  }

  void _book({String? teacherId}) => showPtmBookingSheet(
    context,
    data: widget.data,
    childId: widget.child.id,
    teacherId: teacherId,
  );

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final up = widget.data.upcoming(now);
    final past = widget.data.past(now);
    final showUp = _tab != _past;
    final showPast = _tab != _upcoming;
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async {
              context.read<PtmBloc>().add(const RefreshChildData());
              await Future<void>.delayed(const Duration(milliseconds: 400));
            },
            child: ListView(
              padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 24.h),
              children: [
                AppSolidChips(
                  items: const [_all, _upcoming, _past],
                  value: _tab,
                  labelOf: (t) => switch (t) {
                    _all => 'All Meetings (${up.length + past.length})',
                    _upcoming => 'Upcoming (${up.length})',
                    _ => 'Past Meetings (${past.length})',
                  },
                  onChanged: (t) => setState(() => _tab = t),
                ),
                if (showUp) ...[
                  _SectionTitle(
                    'Upcoming Meetings',
                    count: up.length,
                    trailing: up.isEmpty
                        ? null
                        : 'Next: ${DateFormat('MMM d').format(up.first.start)}',
                    solid: true,
                  ),
                  if (up.isEmpty)
                    AppSurfaceCard(
                      child: AppEmptyState(
                        'No upcoming meetings',
                        hint:
                            'Book a slot with any of ${widget.child.firstName}\'s teachers.',
                        icon: Icons.event_busy_outlined,
                      ),
                    )
                  else
                    for (final m in up)
                      _UpcomingCard(
                        meeting: m,
                        data: widget.data,
                        child: widget.child,
                      ),
                ],
                if (showPast) ...[
                  _SectionTitle(
                    'Past Meetings',
                    count: past.length,
                    trailing: 'AY ${academicYearOf(now)}',
                  ),
                  if (past.isEmpty)
                    const AppSurfaceCard(
                      child: AppEmptyState(
                        'No past meetings',
                        icon: Icons.history_rounded,
                      ),
                    )
                  else
                    for (final m in past) _PastCard(meeting: m),
                ],
              ],
            ),
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: EdgeInsets.fromLTRB(16.w, 10.h, 16.w, 12.h),
            decoration: const BoxDecoration(
              color: C.bg,
              border: Border(top: BorderSide(color: C.border)),
            ),
            child: AppButton(
              'Book a Meeting',
              icon: Icons.add_rounded,
              onPressed: _book,
            ),
          ),
        ),
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(
    this.title, {
    required this.count,
    this.trailing,
    this.solid = false,
  });
  final String title;
  final int count;
  final String? trailing;
  final bool solid;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(2.w, 18.h, 2.w, 10.h),
    child: Row(
      children: [
        Flexible(
          child: Text(
            title,
            style: T.h2.copyWith(color: C.onSurface),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        SizedBox(width: 8.w),
        Container(
          width: 22.r,
          height: 22.r,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: solid ? C.primary : C.surfaceLow,
            shape: BoxShape.circle,
          ),
          child: Text(
            '$count',
            style: T.smallStrong.copyWith(
              fontSize: 11.sp,
              color: solid ? Colors.white : C.onSurfaceVariant,
            ),
          ),
        ),
        const Spacer(),
        if (trailing != null)
          Text(trailing!, style: T.small.copyWith(color: C.onSurfaceVariant)),
      ],
    ),
  );
}

class _UpcomingCard extends StatelessWidget {
  const _UpcomingCard({
    required this.meeting,
    required this.data,
    required this.child,
  });
  final Meeting meeting;
  final PtmData data;
  final Child child;

  Future<void> _join(BuildContext context) async {
    final m = meeting;
    if (!m.canJoinAt(DateTime.now())) {
      AppDialogs.showSnackBar(
        context,
        message:
            'Join opens 10 minutes before the start (${fmtDate(m.start)}, ${fmtClock(m.start)}).',
      );
      return;
    }
    context.read<PtmActionBloc>().add(
      JoinPtm(childId: child.id, meetingId: m.id),
    );
    final opened = await getIt<LinkLauncher>().open(m.link!);
    if (opened || !context.mounted) return;
    _copy(context, failed: true);
  }

  void _copy(BuildContext context, {bool failed = false}) {
    Clipboard.setData(ClipboardData(text: meeting.link!));
    AppDialogs.showSnackBar(
      context,
      message: failed
          ? 'Could not open Google Meet. Link copied: ${meeting.link}'
          : 'Meeting link copied',
    );
  }

  Future<void> _cancel(BuildContext context) async {
    final ok = await AppDialogs.showConfirmDialog(
      context,
      title: 'Cancel this meeting?',
      message:
          '${meeting.teacherName} will be told that you cannot attend on ${fmtDate(meeting.start)}.',
      confirm: 'Cancel meeting',
      danger: true,
    );
    if (!ok || !context.mounted) return;
    context.read<PtmActionBloc>().add(
      CancelPtm(childId: child.id, meetingId: meeting.id),
    );
  }

  @override
  Widget build(BuildContext context) {
    final m = meeting;
    final teacher = data.teacher(m.teacherId);
    return AppSurfaceCard(
      margin: EdgeInsets.only(bottom: 12.h),
      padding: EdgeInsets.all(12.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
            decoration: BoxDecoration(
              color: C.surfaceLow,
              borderRadius: BorderRadius.circular(R.pill),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 7.r,
                  height: 7.r,
                  decoration: const BoxDecoration(
                    color: C.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                SizedBox(width: 6.w),
                Text(
                  DateFormat('EEEE, MMM d • h:mm a').format(m.start),
                  style: T.small.copyWith(color: C.onSurface),
                ),
              ],
            ),
          ),
          SizedBox(height: 10.h),
          Text(m.title, style: T.bodyStrong.copyWith(color: C.onSurface)),
          SizedBox(height: 2.h),
          Text(m.agenda, style: T.small.copyWith(color: C.onSurfaceVariant)),
          SizedBox(height: 10.h),
          Container(
            padding: EdgeInsets.all(10.w),
            decoration: BoxDecoration(
              color: C.surfaceLow,
              borderRadius: BorderRadius.circular(R.md),
            ),
            child: Row(
              children: [
                Avatar(m.teacherName, size: 40),
                SizedBox(width: 10.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              m.teacherName,
                              style: T.bodyStrong.copyWith(color: C.onSurface),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          SizedBox(width: 4.w),
                          Icon(
                            Icons.verified_rounded,
                            size: 16.r,
                            color: C.primary,
                          ),
                        ],
                      ),
                      Text(
                        '${m.teacherRole} • ${m.mode.label}, ${m.location}',
                        style: T.small.copyWith(color: C.onSurfaceVariant),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (teacher != null)
                  IconButton(
                    tooltip: 'Message ${teacher.name}',
                    onPressed: () => context.push(
                      RoutePaths.chatWith(
                        teacher.threadId,
                        teacher: teacher.name,
                        role: teacher.role,
                      ),
                    ),
                    icon: Icon(
                      Icons.chat_outlined,
                      size: 20.r,
                      color: C.onSurfaceVariant,
                    ),
                  ),
              ],
            ),
          ),
          SizedBox(height: 10.h),
          if (m.mode == MeetingMode.virtual && m.link != null) ...[
            AppButton(
              'Join Meeting',
              icon: Icons.videocam_outlined,
              onPressed: () => _join(context),
            ),
            SizedBox(height: 8.h),
            AppButton(
              'Copy Meeting Link',
              icon: Icons.copy_rounded,
              kind: BtnKind.outline,
              onPressed: () => _copy(context),
            ),
          ] else
            AppInfoTile(
              icon: Icons.place_outlined,
              iconColor: C.primary,
              label: 'VENUE',
              value: m.mode == MeetingMode.virtual
                  ? '${m.location} • the Join button appears 10 minutes before'
                  : '${m.location} • please report 5 minutes early',
            ),
          SizedBox(height: 4.h),
          Row(
            children: [
              Expanded(
                child: TextButton.icon(
                  onPressed: () => showPtmBookingSheet(
                    context,
                    data: data,
                    childId: child.id,
                    meeting: m,
                  ),
                  icon: Icon(Icons.update_rounded, size: 18.r),
                  label: const Text('Reschedule'),
                ),
              ),
              Expanded(
                child: TextButton.icon(
                  style: TextButton.styleFrom(foregroundColor: C.danger),
                  onPressed: () => _cancel(context),
                  icon: Icon(Icons.event_busy_rounded, size: 18.r),
                  label: const Text('Cancel'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PastCard extends StatelessWidget {
  const _PastCard({required this.meeting});
  final Meeting meeting;

  void _minutes(BuildContext context) {
    final m = meeting;
    final file =
        '${m.title.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_')}_Minutes.pdf';
    showAppSheet<void>(
      context,
      title: 'Meeting Minutes',
      subtitle: '${m.title} • ${fmtDate(m.start, year: true)}',
      builder: (ctx) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(m.minutes!, style: T.body.copyWith(color: C.ink)),
          SizedBox(height: 12.h),
          AppFileChip(
            name: file,
            size: '186 KB',
            sub: 'Signed by ${m.teacherName}',
          ),
          SizedBox(height: 16.h),
          AppButton(
            'Download PDF',
            icon: Icons.download_rounded,
            onPressed: () {
              Navigator.pop(ctx);
              AppDialogs.showSnackBar(
                context,
                message: '$file saved to Downloads (simulated)',
              );
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final m = meeting;
    final status = m.statusAt(DateTime.now());
    final tone = switch (status) {
      MeetingStatus.attended => Tone.brand,
      MeetingStatus.cancelled => Tone.danger,
      MeetingStatus.missed => Tone.warning,
      MeetingStatus.scheduled => Tone.neutral,
    };
    return AppSurfaceCard(
      margin: EdgeInsets.only(bottom: 10.h),
      padding: EdgeInsets.all(12.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  m.title,
                  style: T.bodyStrong.copyWith(color: C.onSurface),
                ),
              ),
              SizedBox(width: 8.w),
              Pill(
                status.label,
                tone: tone,
                icon: status == MeetingStatus.attended
                    ? Icons.check_circle_rounded
                    : null,
              ),
            ],
          ),
          SizedBox(height: 2.h),
          Text(
            '${DateFormat('d MMM yyyy').format(m.start)} • ${m.teacherName}',
            style: T.small.copyWith(color: C.onSurfaceVariant),
          ),
          Divider(height: 16.h, color: C.border),
          Row(
            children: [
              Expanded(
                child: Text(
                  '${m.mode.label} • ${m.location}',
                  style: T.small.copyWith(color: C.onSurfaceVariant),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (m.minutes != null)
                TextButton.icon(
                  onPressed: () => _minutes(context),
                  icon: Icon(Icons.description_outlined, size: 16.r),
                  label: Text(
                    'View Minutes (PDF)',
                    style: T.smallStrong.copyWith(color: C.primary),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
