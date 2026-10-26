import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/load_status.dart';
import '../bloc/slips_bloc.dart';
import '../bloc/slips_events.dart';
import '../models/attendance_models.dart';
import 'widgets/att_widgets.dart';

/// 1.2.1 View Leave Slip (Figma 1153:16881).
class LeaveSlipScreen extends StatelessWidget {
  const LeaveSlipScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => BlocProvider(create: (_) => getIt<SlipsBloc>()..add(const SlipsLoadRequested()), child: _SlipView(id: id));
}

class _SlipView extends StatelessWidget {
  const _SlipView({required this.id});
  final String id;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<SlipsBloc>().state;
    final bloc = context.read<SlipsBloc>();
    if (s.status != LoadStatus.loaded) return DetailScaffold(title: 'Leave Slip', fallbackRoute: RoutePaths.attendanceHistory, body: attLoading());
    final sl = s.leaveSlip(id);
    if (sl == null) {
      return const DetailScaffold(title: 'Leave Slip', fallbackRoute: RoutePaths.attendanceHistory, body: Center(child: AppEmptyState('Leave slip not found', icon: Icons.search_off_rounded)));
    }
    final st = s.student(sl.studentId);
    final cls = s.classOf(st);
    final rate = st == null ? 0.0 : s.rateOf(st);
    final status = sl.status;

    void set(String v, String msg, {String? note}) {
      bloc.add(LeaveSlipStatusChanged(id, v, note: note));
      toast(context, msg);
      if (v != 'Clarify') goBack(context);
    }

    return DetailScaffold(
      title: 'Leave Slip',
      subtitle: st?.name,
      fallbackRoute: RoutePaths.attendanceHistory,
      bottom: sl.decided
          ? Row(children: [
              Pill(status, tone: toneForStatus(status)), SizedBox(width: 10.w),
              Expanded(child: Text(status == 'Approved' ? 'This slip has been approved.' : 'This slip was rejected.', style: T.small)),
              TextButton(onPressed: () => bloc.add(LeaveSlipStatusChanged(id, 'Pending')), child: const Text('Reopen')),
            ])
          : Column(mainAxisSize: MainAxisSize.min, children: [
              AppButton('Approve Leave Slip', icon: Icons.check_circle_outline_rounded, onPressed: () => set('Approved', 'Leave slip approved')),
              SizedBox(height: 8.h),
              Row(children: [
                Expanded(child: AppButton('Clarify', icon: Icons.help_outline_rounded, kind: BtnKind.outline, onPressed: () async {
                  final r = await askReason(context, title: 'Ask parent for clarification', hint: 'What do you need to know?', action: 'Send Request');
                  if (r != null && context.mounted) set('Clarify', 'Clarification requested from parent', note: r);
                })),
                SizedBox(width: 8.w),
                Expanded(child: AppButton('Reject', icon: Icons.cancel_outlined, kind: BtnKind.outline, onPressed: () async {
                  final r = await askReason(context, title: 'Reject leave slip', hint: 'Reason for rejection', action: 'Reject');
                  if (r != null && context.mounted) set('Rejected', 'Leave slip rejected', note: r);
                })),
              ]),
            ]),
      body: AttBody(children: [
        AppCard(radius: R.xl, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Avatar(st?.name ?? '?', size: 56), SizedBox(width: 12.w),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(st?.name ?? 'Student', style: T.h1, maxLines: 1, overflow: TextOverflow.ellipsis)),
                SizedBox(width: 4.w),
                Icon(Icons.verified_outlined, size: 18.r, color: C.primary),
              ]),
              Text('Roll #${st?.roll ?? ''} • Grade ${cls?.label ?? ''}', style: T.body, maxLines: 2),
            ])),
            _RoundIcon(icon: Icons.call_outlined, tip: 'Call parent', onTap: () => toast(context, 'Calling ${st?.guardian ?? 'parent'} • ${st?.phone ?? ''}')),
            SizedBox(width: 6.w),
            _RoundIcon(icon: Icons.chat_outlined, tip: 'Message parent', tone: Tone.success, onTap: () => toast(context, 'Message thread with ${st?.guardian ?? 'parent'} opened (simulated)')),
          ]),
          SizedBox(height: 12.h),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
            child: Row(children: [
              Icon(rate >= 75 ? Icons.verified_outlined : Icons.warning_amber_rounded, size: 18.r, color: rate >= 75 ? C.successDark : C.danger), SizedBox(width: 6.w),
              Expanded(child: Text('Attendance Rate', style: T.body.copyWith(color: C.ink), maxLines: 1, overflow: TextOverflow.ellipsis)),
              Text('${rate.toStringAsFixed(1)}%', style: T.bodyStrong), SizedBox(width: 6.w),
              Pill(rate >= 75 ? 'Compliant (≥75%)' : 'Below threshold', tone: rate >= 75 ? Tone.success : Tone.danger),
            ]),
          ),
        ])),
        SizedBox(height: 12.h),
        AppCard(radius: R.xl, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Pill(sl.type, tone: Tone.danger, icon: Icons.monitor_heart_outlined),
            SizedBox(width: 6.w),
            if (!sl.decided) Pill(status, tone: toneForStatus(status)),
            const Spacer(),
            Text(sl.from == sl.to ? fmtKey(sl.from, 'MMM d') : '${fmtKey(sl.from, 'MMM d')} – ${fmtKey(sl.to, 'MMM d')}', style: T.small),
          ]),
          SizedBox(height: 12.h),
          Container(
            width: double.infinity, padding: EdgeInsets.all(12.r),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Wrap(spacing: 8.w, children: [
                Text('PARENT ASSESSMENT', style: T.capsMuted),
                Text('${sl.parent} • ${fmtKey(sl.from, 'MMM d')}', style: T.small),
              ]),
              SizedBox(height: 6.h),
              Text('“${sl.note}”', style: T.body.copyWith(color: C.ink, height: 1.6)),
              if (sl.decisionNote != null) ...[Divider(height: 20.h), Text('Your note: ${sl.decisionNote}', style: T.small)],
            ]),
          ),
        ])),
        SizedBox(height: 12.h),
        AppCard(radius: R.xl, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(Icons.attach_file_rounded, size: 18.r, color: C.primary), SizedBox(width: 6.w),
            Expanded(child: Text('Attached Medical Records (${sl.files.length})', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
            Text('VERIFIED UPLOADS', style: T.capsMuted.copyWith(fontSize: 9.5.sp)),
          ]),
          SizedBox(height: 10.h),
          if (sl.files.isEmpty) Text('No documents attached.', style: T.body),
          for (final f in sl.files)
            Container(
              margin: EdgeInsets.only(bottom: 8.h), padding: EdgeInsets.all(10.r),
              decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
              child: Row(children: [
                IconTile(Icons.picture_as_pdf_outlined, tone: Tone.danger), SizedBox(width: 10.w),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(f.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(f.meta, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ])),
                OutlinedButton(
                  onPressed: () => toast(context, 'Opening ${f.name} (simulated)'),
                  style: OutlinedButton.styleFrom(minimumSize: Size(44.w, 44.h), padding: EdgeInsets.symmetric(horizontal: 10.w)),
                  child: const Text('View'),
                ),
              ]),
            ),
        ])),
      ]),
    );
  }
}

class _RoundIcon extends StatelessWidget {
  const _RoundIcon({required this.icon, required this.tip, required this.onTap, this.tone = Tone.neutral});
  final IconData icon;
  final String tip;
  final VoidCallback onTap;
  final Tone tone;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return IconButton(
      tooltip: tip, onPressed: onTap,
      style: IconButton.styleFrom(backgroundColor: c.bg, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.md))),
      constraints: BoxConstraints(minWidth: 44.r, minHeight: 44.r),
      icon: Icon(icon, size: 20.r, color: tone == Tone.neutral ? C.ink : c.fg),
    );
  }
}
