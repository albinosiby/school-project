import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../../../di/injection.dart';
import '../../../attendance/bloc/load_status.dart';
import '../../../attendance/bloc/self_log_bloc.dart';
import '../../../attendance/bloc/self_log_events.dart';
import '../../../attendance/bloc/self_log_states.dart';
import '../../../attendance/models/attendance_models.dart';
import '../../../attendance/screens/widgets/att_widgets.dart';

/// The teacher's own check-in / check-out for today on the Home tab: the same punch the Staff Self-Log records,
/// one tap away. Tapping the header opens the full self-log.
class HomeCheckInCard extends StatelessWidget {
  const HomeCheckInCard({super.key});

  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<SelfLogBloc>()..add(const SelfLogLoadRequested()),
    child: const _CheckInView(),
  );
}

class _CheckInView extends StatelessWidget {
  const _CheckInView();

  @override
  Widget build(BuildContext context) {
    final s = context.watch<SelfLogBloc>().state;
    final bloc = context.read<SelfLogBloc>();
    final row = s.today;
    final inT = row?.inTime, outT = row?.outTime;
    final loading = s.status != LoadStatus.loaded;
    final logged = inT == null ? 0 : (mins(outT ?? nowHm()) - mins(inT)).clamp(0, 24 * 60);
    final onTime = inT != null && mins(inT) <= mins(onTimeBy);
    final (label, tone) = outT != null
        ? ('Day complete', Tone.success)
        : inT != null
            ? (onTime ? 'Checked in • On time' : 'Checked in • Late', onTime ? Tone.success : Tone.warning)
            : ('Not checked in', Tone.neutral);
    return AppCard(
      radius: R.xl,
      padding: EdgeInsets.all(14.r),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        InkWell(
          onTap: () => context.push(RoutePaths.attendanceSelfLog),
          child: Row(children: [
            IconTile(Icons.fingerprint_rounded, size: 38, tone: tone),
            SizedBox(width: 10.w),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('MY ATTENDANCE', style: T.capsMuted),
              Text(label, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
            ])),
            Icon(Icons.chevron_right_rounded, color: C.muted, size: 22.r),
          ]),
        ),
        SizedBox(height: 12.h),
        Row(children: [
          Expanded(child: _Time('CHECK-IN', inT == null ? '--:--' : t12(inT))),
          SizedBox(width: 8.w),
          Expanded(child: _Time('CHECK-OUT', outT == null ? '--:--' : t12(outT))),
          SizedBox(width: 8.w),
          Expanded(child: _Time('LOGGED', inT == null ? '0h 0m' : '${logged ~/ 60}h ${logged % 60}m', color: C.primary)),
        ]),
        SizedBox(height: 12.h),
        if (inT == null)
          AppButton('Check In', icon: Icons.login_rounded, small: true, onPressed: loading ? null : () {
            final now = nowHm();
            bloc.add(SelfLogPunchedIn(now));
            toast(context, 'Checked in at ${t12(now)}');
          })
        else if (outT == null)
          AppButton('Check Out', icon: Icons.logout_rounded, kind: BtnKind.outline, small: true, onPressed: () async {
            if (mins(nowHm()) < mins(unlockAt)) {
              final ok = await AppDialogs.showConfirmDialog(context,
                  title: 'Check out early?', message: 'Your shift ends at ${t12(shiftEnd)} (unlocks ${t12(unlockAt)}). An early check-out is logged as a short day.', confirm: 'Check Out');
              if (!ok || !context.mounted) return;
            }
            final now = nowHm();
            bloc.add(SelfLogPunchedOut(now));
            toast(context, 'Checked out at ${t12(now)}');
          })
        else
          Text('Checked out at ${t12(outT)} • ${logged ~/ 60}h ${logged % 60}m logged today', style: T.small.copyWith(color: C.successDark)),
      ]),
    );
  }
}

class _Time extends StatelessWidget {
  const _Time(this.label, this.value, {this.color});
  final String label, value;
  final Color? color;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 8.h),
    decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: T.capsMuted.copyWith(fontSize: 9.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
      FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(value, style: T.bodyStrong.copyWith(color: color ?? C.ink))),
    ]),
  );
}
