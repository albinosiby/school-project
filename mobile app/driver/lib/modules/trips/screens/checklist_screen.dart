import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../shared/widgets/crew_widgets.dart';
import '../bloc/trips_bloc.dart';
import '../models/trip_models.dart';

/// Figma 1.1 Pre-Trip Checklist: six inspection items; all required before a pickup trip starts.
class ChecklistScreen extends StatefulWidget {
  const ChecklistScreen({super.key, required this.tripId});
  final String tripId;
  @override
  State<ChecklistScreen> createState() => _ChecklistScreenState();
}

class _ChecklistScreenState extends State<ChecklistScreen> {
  Checklist? _draft;

  @override
  Widget build(BuildContext context) => BlocProvider<TripActionBloc>(
    create: (_) => getIt<TripActionBloc>(),
    child: BlocListener<TripActionBloc, TripActionState>(
      listener: (context, s) {
        if (s.error != null) ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(behavior: SnackBarBehavior.floating, backgroundColor: C.danger, content: Text(s.error!)));
        if (s.done != null) {
          ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(behavior: SnackBarBehavior.floating, content: Text(s.done!)));
          if (context.canPop()) context.pop();
        }
      },
      child: CrewContextView(
        builder: (context, ctx) => DataView<DayTripsBloc, List<Trip>>(
          create: () => getIt<DayTripsBloc>(),
          dataKey: '${ctx.bus!.id}|${widget.tripId.split('_').first}',
          refreshable: false,
          builder: (context, trips) {
            final trip = trips.where((t) => t.id == widget.tripId).firstOrNull;
            if (trip == null) return const DetailScaffold(title: 'Checklist', body: AppEmptyState('Trip not found'));
            final c = _draft ?? trip.checklist;
            final busy = context.watch<TripActionBloc>().state.busy;
            return DetailScaffold(
              title: 'Pre-trip checklist',
              subtitle: '${trip.bus} · ${trip.kind.label}',
              fallbackRoute: RoutePaths.trip(trip.id),
              body: ListView(
                padding: EdgeInsets.all(16.w),
                children: [
                  AppSurfaceCard(
                    color: c.complete ? C.successSoft : C.warningSoft,
                    borderColor: c.complete ? C.successSoft : C.warningSoft,
                    child: Row(children: [
                      Icon(c.complete ? Icons.verified_rounded : Icons.pending_actions_rounded, color: c.complete ? C.successDark : C.warningDark, size: 28.r),
                      SizedBox(width: 12.w),
                      Expanded(child: Text(c.complete ? 'All ${Checklist.items.length} checks passed. The trip can start.' : '${c.done} of ${Checklist.items.length} checks done. Inspect every item before starting.', style: T.bodyStrong.copyWith(color: c.complete ? C.successDark : C.warningDark))),
                    ]),
                  ),
                  SizedBox(height: 12.h),
                  AppSurfaceCard(
                    padding: EdgeInsets.zero,
                    child: Column(children: [
                      for (final (i, item) in Checklist.items.indexed) ...[
                        if (i > 0) const Divider(height: 1, color: C.border),
                        CheckboxListTile(
                          value: c[item.$1],
                          activeColor: C.success,
                          controlAffinity: ListTileControlAffinity.leading,
                          onChanged: trip.isCompleted ? null : (v) => setState(() => _draft = c.set(item.$1, v ?? false)),
                          title: Text(item.$2, style: T.bodyStrong),
                          subtitle: Text(item.$3, style: T.small),
                        ),
                      ],
                    ]),
                  ),
                  if (trip.checklistAt != null) Padding(padding: EdgeInsets.only(top: 10.h), child: Text('Last saved ${clock(trip.checklistAt)}', style: T.small, textAlign: TextAlign.center)),
                ],
              ),
              bottom: trip.isCompleted
                  ? null
                  : AppButton(
                      c.complete ? 'Save & mark passed' : 'Save progress',
                      icon: Icons.save_rounded,
                      busy: busy,
                      onPressed: () => context.read<TripActionBloc>().add(SaveChecklist(trip, c)),
                    ),
            );
          },
        ),
      ),
    ),
  );
}
