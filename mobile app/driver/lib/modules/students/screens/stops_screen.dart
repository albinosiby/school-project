import 'package:flutter/material.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../shared/widgets/crew_widgets.dart';
import '../bloc/roster_bloc.dart';
import '../models/student_models.dart';
import 'widgets/student_sheet.dart';

/// Figma 2.1 View Stops: the route in order with times and the pupils at each stop.
class StopsScreen extends StatelessWidget {
  const StopsScreen({super.key});

  @override
  Widget build(BuildContext context) => CrewContextView(
    builder: (context, ctx) {
      final bus = ctx.bus!;
      return DetailScaffold(
        title: 'Route stops',
        subtitle: '${bus.label} · ${bus.routeName} · ${bus.stops.length} stops',
        fallbackRoute: RoutePaths.students,
        body: DataView<RosterBloc, List<BusStudent>>(
          create: () => getIt<RosterBloc>(),
          dataKey: bus.id,
          builder: (context, roster) => ListView(
            padding: EdgeInsets.all(16.w),
            children: [
              if (bus.stops.isEmpty) const AppEmptyState('No stops yet', hint: 'The transport office adds stops to the bus route.', icon: Icons.place_outlined),
              for (final (i, stop) in bus.stops.indexed)
                AppSurfaceCard(
                  margin: EdgeInsets.only(bottom: 12.h),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      CircleAvatar(radius: 16.r, backgroundColor: C.primary, child: Text('${i + 1}', style: T.smallStrong.copyWith(color: Colors.white))),
                      SizedBox(width: 12.w),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(stop.name, style: T.h3),
                          if (stop.landmark.isNotEmpty) Text(stop.landmark, style: T.small),
                        ]),
                      ),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Text('↑ ${clock24(stop.pickupTime)}', style: T.smallStrong),
                        Text('↓ ${clock24(stop.dropTime)}', style: T.small),
                      ]),
                    ]),
                    SizedBox(height: 10.h),
                    Builder(builder: (context) {
                      final kids = roster.where((s) => s.busStopId == stop.id).toList();
                      if (kids.isEmpty) return Text('No pupils at this stop', style: T.small);
                      return Wrap(spacing: 6.w, runSpacing: 6.h, children: [
                        for (final k in kids)
                          ActionChip(
                            avatar: Avatar(k.name, size: 22),
                            label: Text(k.name, style: T.small.copyWith(color: C.ink)),
                            backgroundColor: C.surface,
                            side: const BorderSide(color: C.border),
                            onPressed: () => showStudentSheet(context, k, bus),
                          ),
                      ]);
                    }),
                  ]),
                ),
            ],
          ),
        ),
      );
    },
  );
}
