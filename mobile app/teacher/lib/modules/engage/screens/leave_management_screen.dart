import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/engage_notice.dart';
import '../bloc/leave_bloc.dart';
import '../bloc/leave_events.dart';
import '../bloc/leave_states.dart';
import '../models/leave_models.dart';
import 'widgets/engage_widgets.dart';

/// "My Leaves | Student leaves" switch shared by both leave screens.
class LeaveSegment extends StatelessWidget {
  const LeaveSegment({super.key, required this.index, required this.pending});
  final int index, pending;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 14.h),
        child: AppIconSegmented(
          labels: const ['My Leaves', 'Student leaves'], icons: const [Icons.badge_outlined, Icons.school_outlined], index: index, badges: {1: pending},
          onChanged: (i) {
            if (i != index) context.pushReplacement(i == 0 ? RoutePaths.leaveManagement : RoutePaths.studentLeaves);
          },
        ),
      );
}

String _range(MyLeave e) {
  final f = parseIso(e.from), t = parseIso(e.to);
  if (f == null) return '';
  final df = DateFormat('d MMM yyyy');
  if (e.timeText.isNotEmpty) return '${df.format(f)} • ${e.timeText}';
  if (t == null || e.from == e.to) return df.format(f);
  return '${df.format(f)} to ${df.format(t)}';
}

String _daysText(double d) => d == 0.5 ? 'Half Day' : '${d.toInt()} Day${d == 1 ? '' : 's'}';

Tone _statusTone(String st) => switch (st) { 'Approved' => Tone.success, 'Completed' => Tone.neutral, 'Pending' => Tone.warning, _ => Tone.danger };

/// The teacher's own leaves (Figma 1153:5292): balances, upcoming leave with handover, history.
class LeaveManagementScreen extends StatelessWidget {
  const LeaveManagementScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<LeaveBloc>()..add(const LeaveLoadRequested()),
        child: const NoticeListener<LeaveBloc, LeaveState>(child: _LeaveView()),
      );
}

class _LeaveView extends StatelessWidget {
  const _LeaveView();
  @override
  Widget build(BuildContext context) {
    final st = context.watch<LeaveBloc>().state;
    final upcoming = st.upcoming, history = st.history;
    return DetailScaffold(
      title: 'Leave Management',
      bottom: AppButton('Apply Leave', icon: Icons.add_rounded, onPressed: () => context.push(RoutePaths.leaveApply)),
      body: st.status != EngageStatus.loaded
          ? EngageStatusBody(status: st.status, error: st.error, onRetry: () => context.read<LeaveBloc>().add(const LeaveLoadRequested()))
          : ListView(padding: EdgeInsets.all(S.page), children: [
              LeaveSegment(index: 0, pending: st.pendingStudentLeaves),
              _Balances(st),
              const SectionHeader('Upcoming Scheduled Leave', icon: Icons.event_available_outlined),
              if (upcoming.isEmpty) AppCard(child: Center(child: Text('No upcoming leave scheduled', style: T.body))),
              for (final e in upcoming) _UpcomingCard(e),
              Padding(
                padding: EdgeInsets.fromLTRB(2.w, 20.h, 2.w, 10.h),
                child: Row(children: [
                  Expanded(child: Text('Recent Leave History', style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  Text('Academic Term 2', style: T.small),
                ]),
              ),
              if (history.isEmpty) const AppEmptyState('No leave history', icon: Icons.history_rounded),
              for (final e in history) _HistoryCard(e),
            ]),
    );
  }
}

class _Balances extends StatelessWidget {
  const _Balances(this.st);
  final LeaveState st;
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 96.h,
        child: ListView.separated(
          scrollDirection: Axis.horizontal, itemCount: st.balances.length, separatorBuilder: (_, _) => SizedBox(width: 10.w),
          itemBuilder: (_, i) {
            final r = st.balances[i];
            final used = st.used(r.type);
            final left = r.total - used;
            return SizedBox(
              width: 140.w,
              child: AppCard(
                color: C.panel, border: C.panelBorder, padding: EdgeInsets.all(12.w), radius: R.lg,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text(r.type, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                  SizedBox(height: 4.h),
                  FittedBox(
                    fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                    child: Text.rich(TextSpan(children: [
                      TextSpan(text: left.toStringAsFixed(used % 1 == 0 ? 0 : 1), style: T.stat.copyWith(fontSize: 22.sp)),
                      TextSpan(text: ' / ${r.total.toInt()} left', style: T.small),
                    ])),
                  ),
                  SizedBox(height: 6.h),
                  AppProgress(r.total == 0 ? 0 : used / r.total, height: 5),
                ]),
              ),
            );
          },
        ),
      );
}

class _UpcomingCard extends StatelessWidget {
  const _UpcomingCard(this.e);
  final MyLeave e;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 12.h),
        child: AppCard(
          radius: R.xl,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Text('${DateFormat('d MMM yyyy').format(parseIso(e.from) ?? DateTime.now())} • ${e.type}${e.note.isEmpty ? '' : ' (${e.note})'}',
                    style: T.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis),
              ),
              SizedBox(width: 8.w),
              Pill(e.status, tone: _statusTone(e.status)),
            ]),
            if (e.handover.isNotEmpty) ...[
              SizedBox(height: 10.h),
              Container(
                width: double.infinity, padding: EdgeInsets.all(12.w),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
                child: Row(children: [
                  Avatar(e.handover, size: 32), SizedBox(width: 10.w),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Duty Handover: ${e.handover}', style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                      if (e.handoverNote.isNotEmpty) Text(e.handoverNote, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
                    ]),
                  ),
                ]),
              ),
            ],
            SizedBox(height: 10.h),
            Align(
              alignment: Alignment.centerRight,
              child: AppButton('Cancel Leave', kind: BtnKind.ghost, small: true, expand: false, onPressed: () async {
                final ok = await confirmAction(context, title: 'Cancel this leave?', message: 'Your leave on ${_range(e)} will be withdrawn.', confirm: 'Cancel leave', danger: true);
                if (ok && context.mounted) context.read<LeaveBloc>().add(MyLeaveCancelled(e.id));
              }),
            ),
          ]),
        ),
      );
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard(this.e);
  final MyLeave e;
  @override
  Widget build(BuildContext context) {
    final att = e.attachment;
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Text('${e.type} — ${_daysText(e.days)}', style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis)),
            SizedBox(width: 8.w),
            Pill(e.status, tone: _statusTone(e.status)),
          ]),
          SizedBox(height: 4.h),
          Text(e.note.isNotEmpty && e.timeText.isEmpty ? '${_range(e)} • ${e.note}' : _range(e), style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
          SizedBox(height: 8.h),
          Text('Reason: ${e.reason}', style: T.body.copyWith(color: C.ink, fontSize: 13.sp), maxLines: 3, overflow: TextOverflow.ellipsis),
          if (att != null) ...[
            SizedBox(height: 8.h),
            AppFileChip(
              name: att.name, size: att.size,
              trailing: IconButton(
                tooltip: 'View attachment', icon: Icon(Icons.visibility_outlined, size: 18.r, color: C.primary),
                onPressed: () => showNotice(context, 'Opening ${att.name} (simulated)'),
              ),
            ),
          ],
          if (e.sanctionedBy.isNotEmpty) ...[
            SizedBox(height: 8.h),
            Text('Sanctioned by: ${e.sanctionedBy}', style: T.smallStrong.copyWith(color: C.slate), maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ]),
      ),
    );
  }
}
