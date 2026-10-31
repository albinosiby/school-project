import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../shared/widgets/crew_widgets.dart';
import '../bloc/trips_bloc.dart';
import '../models/trip_models.dart';
import 'widgets/trip_card.dart';

/// Figma 1.4 Trip History: past trips of the bus, newest first, with a filter by kind.
class TripHistoryScreen extends StatefulWidget {
  const TripHistoryScreen({super.key});
  @override
  State<TripHistoryScreen> createState() => _TripHistoryScreenState();
}

class _TripHistoryScreenState extends State<TripHistoryScreen> {
  String _filter = 'All';

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Trip history',
    fallbackRoute: RoutePaths.trips,
    body: CrewContextView(
      builder: (context, ctx) => DataView<TripHistoryBloc, List<Trip>>(
        create: () => getIt<TripHistoryBloc>(),
        dataKey: ctx.bus!.id,
        isEmpty: (t) => t.isEmpty,
        emptyTitle: 'No past trips',
        emptyHint: 'Completed trips appear here.',
        emptyIcon: Icons.history_rounded,
        builder: (context, trips) {
          final rows = trips.where((t) => _filter == 'All' || t.kind.short == _filter).toList();
          final completed = trips.where((t) => t.isCompleted).toList();
          final onTime = completed.where((t) => t.absent == 0).length;
          return ListView(
            padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 24.h),
            children: [
              Row(children: [
                Expanded(child: StatTile(label: 'Trips', value: '${completed.length}', icon: Icons.route_rounded)),
                SizedBox(width: 8.w),
                Expanded(child: StatTile(label: 'Full boarding', value: '$onTime', icon: Icons.task_alt_rounded, tone: Tone.success)),
                SizedBox(width: 8.w),
                Expanded(child: StatTile(label: 'Absences', value: '${completed.fold(0, (n, t) => n + t.absent)}', icon: Icons.person_off_rounded, tone: Tone.danger)),
              ]),
              SizedBox(height: 12.h),
              AppSegmented(items: const ['All', 'Pickup', 'Drop'], value: _filter, onChanged: (v) => setState(() => _filter = v)),
              SizedBox(height: 12.h),
              for (final t in rows) ...[
                TripCard(trip: t, onTap: () => context.push(RoutePaths.trip(t.id))),
                SizedBox(height: 10.h),
              ],
            ],
          );
        },
      ),
    ),
  );
}
