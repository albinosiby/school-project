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

String _range(MyLeave e) {
  final f = parseIso(e.from), t = parseIso(e.to);
  if (f == null) return '';
  final df = DateFormat('EEE, d MMM yyyy');
  if (e.timeText.isNotEmpty) return '${df.format(f)} • ${e.timeText}';
  if (t == null || e.from == e.to) return df.format(f);
  final same = f.year == t.year && f.month == t.month;
  return same ? '${DateFormat('d').format(f)} – ${DateFormat('d MMM yyyy').format(t)}' : '${DateFormat('d MMM').format(f)} – ${DateFormat('d MMM yyyy').format(t)}';
}

String _daysText(double d) => d == 0.5 ? 'Half day' : '${d.toInt()} day${d == 1 ? '' : 's'}';
String _num(double v) => v.toStringAsFixed(v % 1 == 0 ? 0 : 1);

Tone _statusTone(String st) => switch (st) {
  'Approved' => Tone.success,
  'Completed' => Tone.neutral,
  'Pending' => Tone.warning,
  _ => Tone.danger,
};

/// The teacher's own leaves (Figma 1153:5292): balances, upcoming leave with handover, history.
/// Student leave requests are reviewed in Attendance (leave and medical slips), not here.
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
    final pending = st.myLeaves.where((e) => e.status == 'Pending').length;
    return DetailScaffold(
      title: 'Leave Management',
      subtitle: 'My leaves',
      bottom: AppButton('Apply Leave', icon: Icons.add_rounded, onPressed: () => context.push(RoutePaths.leaveApply)),
      body: st.status != EngageStatus.loaded
          ? EngageStatusBody(status: st.status, error: st.error, onRetry: () => context.read<LeaveBloc>().add(const LeaveLoadRequested()))
          : ListView(
              padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 24.h),
              children: [
                _BalanceCard(st: st, pending: pending),
                _Heading('Upcoming leave', trailing: upcoming.isEmpty ? null : '${upcoming.length}'),
                if (upcoming.isEmpty)
                  const AppCard(child: AppEmptyState('No upcoming leave', hint: 'Leave you apply for shows up here with its status.', icon: Icons.event_available_outlined)),
                for (final e in upcoming) _UpcomingCard(e),
                _Heading('Past leaves', trailing: history.isEmpty ? null : '${history.length}'),
                if (history.isEmpty)
                  const AppCard(child: AppEmptyState('No leave history', icon: Icons.history_rounded))
                else
                  AppCard(
                    radius: R.xl,
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        for (var i = 0; i < history.length; i++) ...[
                          if (i > 0) const Divider(height: 1, color: C.border),
                          _HistoryRow(history[i]),
                        ],
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.title, {this.trailing});
  final String title;
  final String? trailing;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(2.w, 20.h, 2.w, 10.h),
    child: Row(
      children: [
        Expanded(child: Text(title, style: T.h3)),
        if (trailing != null) Pill(trailing!, tone: Tone.neutral),
      ],
    ),
  );
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

const _balanceTones = [Tone.brand, Tone.success, Tone.purple, Tone.warning, Tone.danger, Tone.neutral];

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.st, required this.pending});
  final LeaveState st;
  final int pending;
  @override
  Widget build(BuildContext context) {
    final total = st.balances.fold<double>(0, (a, b) => a + b.total);
    final used = st.balances.fold<double>(0, (a, b) => a + st.used(b.type));
    final left = (total - used).clamp(0, total).toDouble();
    return PanelCard(
      padding: EdgeInsets.all(16.r),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const IconTile(Icons.event_available_rounded, size: 44),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('LEAVE BALANCE', style: T.capsMuted),
                    SizedBox(height: 2.h),
                    Text.rich(TextSpan(children: [
                      TextSpan(text: _num(left), style: T.title),
                      TextSpan(text: ' of ${_num(total)} days left', style: T.body),
                    ])),
                  ],
                ),
              ),
              if (pending > 0) Pill('$pending pending', tone: Tone.warning, icon: Icons.schedule_rounded),
            ],
          ),
          if (st.balances.isNotEmpty) ...[
            SizedBox(height: 14.h),
            Container(
              padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 4.h),
              decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
              child: Column(
                children: [
                  for (var i = 0; i < st.balances.length; i++) ...[
                    if (i > 0) const Divider(height: 1, color: C.border),
                    _BalanceRow(st.balances[i], used: st.used(st.balances[i].type), tone: _balanceTones[i % _balanceTones.length]),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _BalanceRow extends StatelessWidget {
  const _BalanceRow(this.b, {required this.used, required this.tone});
  final LeaveBalance b;
  final double used;
  final Tone tone;
  @override
  Widget build(BuildContext context) {
    final left = (b.total - used).clamp(0, b.total).toDouble();
    final c = toneColors(tone);
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 10.h),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(width: 10.r, height: 10.r, decoration: BoxDecoration(color: c.fg, shape: BoxShape.circle)),
              SizedBox(width: 8.w),
              Expanded(child: Text(b.type, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
              Text.rich(TextSpan(children: [
                TextSpan(text: _num(left), style: T.h3.copyWith(color: c.fg)),
                TextSpan(text: ' / ${_num(b.total)} left', style: T.small),
              ])),
            ],
          ),
          SizedBox(height: 6.h),
          AppProgress(b.total == 0 ? 0 : (used / b.total).clamp(0, 1).toDouble(), tone: tone, height: 6),
          SizedBox(height: 2.h),
          Text(used == 0 ? 'None used yet' : '${_num(used)} used', style: T.small.copyWith(fontSize: 11.sp)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Upcoming
// ---------------------------------------------------------------------------

class _DateBlock extends StatelessWidget {
  const _DateBlock(this.iso, {required this.tone});
  final String iso;
  final Tone tone;
  @override
  Widget build(BuildContext context) {
    final d = parseIso(iso);
    final c = toneColors(tone);
    return Container(
      width: 48.r,
      padding: EdgeInsets.symmetric(vertical: 8.h),
      decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(R.md)),
      child: Column(
        children: [
          Text(d == null ? '' : DateFormat('MMM').format(d).toUpperCase(), style: T.capsMuted.copyWith(fontSize: 9.5.sp, color: c.fg)),
          Text(d == null ? '–' : '${d.day}', style: T.h2.copyWith(color: c.fg, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class _UpcomingCard extends StatelessWidget {
  const _UpcomingCard(this.e);
  final MyLeave e;
  @override
  Widget build(BuildContext context) {
    final tone = _statusTone(e.status);
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppCard(
        radius: R.xl,
        padding: EdgeInsets.all(14.r),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _DateBlock(e.from, tone: tone),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${e.type} • ${_daysText(e.days)}', style: T.bodyStrong.copyWith(fontSize: 15.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
                      SizedBox(height: 2.h),
                      Text(_range(e), style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                      if (e.note.isNotEmpty) Text(e.note, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
                SizedBox(width: 8.w),
                Pill(e.status, tone: tone, dot: true),
              ],
            ),
            if (e.reason.isNotEmpty) ...[
              SizedBox(height: 10.h),
              Text(e.reason, style: T.body.copyWith(color: C.ink, fontSize: 13.sp), maxLines: 3, overflow: TextOverflow.ellipsis),
            ],
            if (e.handover.isNotEmpty) ...[
              SizedBox(height: 10.h),
              Container(
                padding: EdgeInsets.all(10.r),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
                child: Row(
                  children: [
                    Avatar(e.handover, size: 32),
                    SizedBox(width: 10.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('DUTY HANDOVER', style: T.capsMuted.copyWith(fontSize: 9.5.sp)),
                          Text(e.handover, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                          if (e.handoverNote.isNotEmpty) Text(e.handoverNote, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
            SizedBox(height: 10.h),
            // a request can be withdrawn only while it is pending (contract §4, firestore.rules); a decided leave is the office's
            if (e.status == 'Pending')
              Row(
                children: [
                  Expanded(child: Text('Awaiting the office\'s decision.', style: T.small)),
                  AppButton('Cancel Leave', icon: Icons.close_rounded, kind: BtnKind.outline, small: true, expand: false, onPressed: () async {
                    final ok = await confirmAction(context, title: 'Cancel this leave?', message: 'Your leave on ${_range(e)} will be withdrawn.', confirm: 'Cancel leave', danger: true);
                    if (ok && context.mounted) context.read<LeaveBloc>().add(MyLeaveCancelled(e.id));
                  }),
                ],
              )
            else
              Row(
                children: [
                  Icon(Icons.info_outline_rounded, size: 14.r, color: C.muted),
                  SizedBox(width: 6.w),
                  Expanded(child: Text('To cancel a ${e.status.toLowerCase()} leave, contact the school office.', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis)),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

class _HistoryRow extends StatelessWidget {
  const _HistoryRow(this.e);
  final MyLeave e;
  @override
  Widget build(BuildContext context) {
    final tone = _statusTone(e.status);
    final att = e.attachment;
    return Padding(
      padding: EdgeInsets.fromLTRB(14.w, 12.h, 14.w, 12.h),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DateBlock(e.from, tone: Tone.neutral),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${e.type} • ${_daysText(e.days)}', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                    SizedBox(height: 2.h),
                    Text(e.note.isNotEmpty && e.timeText.isEmpty ? '${_range(e)} • ${e.note}' : _range(e), style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
                    if (e.reason.isNotEmpty) ...[
                      SizedBox(height: 4.h),
                      Text(e.reason, style: T.small.copyWith(color: C.ink), maxLines: 2, overflow: TextOverflow.ellipsis),
                    ],
                    if (e.sanctionedBy.isNotEmpty) ...[
                      SizedBox(height: 2.h),
                      Text('Sanctioned by ${e.sanctionedBy}', style: T.small.copyWith(fontSize: 11.sp, color: C.muted), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ],
                  ],
                ),
              ),
              SizedBox(width: 8.w),
              Pill(e.status, tone: tone),
            ],
          ),
          if (att != null) ...[
            SizedBox(height: 8.h),
            AppFileChip(
              name: att.name,
              size: att.size,
              trailing: IconButton(
                tooltip: 'View attachment',
                icon: Icon(Icons.visibility_outlined, size: 18.r, color: C.primary),
                onPressed: () => showNotice(context, 'Opening ${att.name} (simulated)'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
