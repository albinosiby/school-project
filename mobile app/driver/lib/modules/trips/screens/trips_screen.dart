import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/services/firebase/crew_session.dart' show isoDay;
import '../../shared/widgets/crew_widgets.dart';
import '../bloc/trips_bloc.dart';
import '../models/trip_models.dart';
import 'widgets/trip_card.dart';

/// Figma 2. Trips: today's pickup and drop with their state; link to history.
class TripsScreen extends StatelessWidget {
  const TripsScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: C.surface,
    body: Column(children: [
      const CrewTabHeader(title: 'Trips'),
      Expanded(
        child: CrewContextView(
          builder: (context, ctx) {
            final bus = ctx.bus!;
            final date = isoDay(DateTime.now());
            return DataView<DayTripsBloc, List<Trip>>(
              create: () => getIt<DayTripsBloc>(),
              dataKey: '${bus.id}|$date',
              builder: (context, trips) => ListView(
                padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 110.h),
                children: [
                  Row(children: [
                    Expanded(child: Text("Today's trips", style: T.h1)),
                    TextButton.icon(
                      onPressed: () => context.push(RoutePaths.tripHistory),
                      icon: Icon(Icons.history_rounded, size: 18.r), label: const Text('History'),
                    ),
                  ]),
                  Text('${bus.label} · ${bus.routeName} · ${bus.stops.length} stops', style: T.small),
                  SizedBox(height: 14.h),
                  for (final t in trips) ...[
                    TripCard(trip: t, onTap: () => context.push(RoutePaths.trip(t.id)), featured: !t.isCompleted),
                    SizedBox(height: 12.h),
                  ],
                  if (trips.isEmpty) const AppEmptyState('No trips today', hint: 'Trips are created when a crew member of the bus opens the app on a school day.', icon: Icons.event_busy_rounded),
                  SizedBox(height: 8.h),
                  SectionHeader('Route stops', action: 'View all', onAction: () => context.push(RoutePaths.stops)),
                  SizedBox(height: 8.h),
                  AppSurfaceCard(
                    padding: EdgeInsets.symmetric(vertical: 6.h),
                    child: Column(children: [
                      for (final (i, s) in bus.stops.indexed)
                        ListTile(
                          dense: true,
                          leading: CircleAvatar(radius: 14.r, backgroundColor: C.primarySoft, child: Text('${i + 1}', style: T.smallStrong.copyWith(color: C.primary))),
                          title: Text(s.name, style: T.bodyStrong),
                          subtitle: s.landmark.isEmpty ? null : Text(s.landmark, style: T.small),
                          trailing: Text('${clock24(s.pickupTime)}\n${clock24(s.dropTime)}', textAlign: TextAlign.right, style: T.small),
                        ),
                      if (bus.stops.isEmpty) Padding(padding: EdgeInsets.all(12.w), child: Text('No stops on this route yet.', style: T.body)),
                    ]),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    ]),
  );
}
