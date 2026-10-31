import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../shared/widgets/crew_widgets.dart';
import '../../trips/screens/widgets/trip_card.dart';
import '../bloc/leave_bloc.dart';
import '../models/leave_models.dart';

/// Figma 1.11.1 Leave History: own requests with status; withdraw while pending.
class LeaveScreen extends StatelessWidget {
  const LeaveScreen({super.key});

  @override
  Widget build(BuildContext context) => BlocProvider<LeaveFormBloc>(
    create: (_) => getIt<LeaveFormBloc>(),
    child: BlocListener<LeaveFormBloc, LeaveFormState>(
      listenWhen: (a, b) => b.error != null,
      listener: (context, s) => ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(behavior: SnackBarBehavior.floating, backgroundColor: C.danger, content: Text(s.error!))),
      child: DetailScaffold(
        title: 'Leave requests',
        fallbackRoute: RoutePaths.profile,
        fab: FloatingActionButton.extended(onPressed: () => context.push(RoutePaths.applyLeave), backgroundColor: C.primary, foregroundColor: Colors.white, icon: const Icon(Icons.add_rounded), label: const Text('Apply')),
        body: DataView<LeavesBloc, List<CrewLeave>>(
          create: () => getIt<LeavesBloc>(),
          isEmpty: (l) => l.isEmpty,
          emptyTitle: 'No leave requests',
          emptyHint: 'Tap Apply to request leave. The transport office approves it.',
          emptyIcon: Icons.event_busy_rounded,
          builder: (context, leaves) => ListView(
            padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 90.h),
            children: [
              for (final l in leaves)
                AppEntryCard(
                  icon: l.type == 'Sick' ? Icons.medical_services_rounded : l.type == 'Emergency' ? Icons.warning_rounded : Icons.beach_access_rounded,
                  tone: leaveTone(l.status),
                  title: '${l.type} leave · ${l.days} ${l.days == 1 ? 'day' : 'days'}',
                  meta: l.from == l.to ? fmtTripDate(l.from) : '${fmtTripDate(l.from)} – ${fmtTripDate(l.to)}',
                  body: l.reason + (l.decisionNote.isEmpty ? '' : '\nOffice: ${l.decisionNote}'),
                  badge: Pill(l.status, tone: leaveTone(l.status)),
                  footer: [
                    if (l.isPending)
                      TextButton(
                        onPressed: () async {
                          final ok = await AppDialogs.showConfirmDialog(context, title: 'Withdraw request?', message: 'The office will no longer see this leave request.', confirm: 'Withdraw', danger: true);
                          if (ok && context.mounted) context.read<LeaveFormBloc>().add(WithdrawLeave(l.id));
                        },
                        child: Text('Withdraw', style: T.smallStrong.copyWith(color: C.danger)),
                      ),
                  ],
                ),
            ],
          ),
        ),
      ),
    ),
  );
}
