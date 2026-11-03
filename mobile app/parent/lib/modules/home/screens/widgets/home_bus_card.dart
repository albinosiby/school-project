import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../../transport/models/transport_models.dart';
import '../../../transport/screens/widgets/trip_labels.dart';

/// Live bus tracking card (Figma Home): status line, LIVE GPS chip, drop ETA, next stop, Track Live
/// button and progress to the child's stop.
class HomeBusCard extends StatelessWidget {
  const HomeBusCard({super.key, required this.trip});
  final BusTrip trip;

  @override
  Widget build(BuildContext context) {
    final phase = trip.phase;
    final inTransit = phase == TripPhase.inTransit;
    final live = !trip.scheduleBased;
    final status = switch (phase) {
      TripPhase.scheduled => 'SCHEDULED',
      TripPhase.inTransit => live ? 'IN TRANSIT' : 'ON THE WAY',
      TripPhase.droppedOff =>
        live ? 'DROPPED OFF' : (trip.markVerb ?? 'Stop passed').toUpperCase(),
      TripPhase.completed => 'TRIP ENDED',
    };
    final route = trip.route.isEmpty ? '' : ' (ROUTE ${trip.route})';
    void track() => context.push(RoutePaths.trackLive);
    return AppElevatedCard(
      onTap: track,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 10.r,
                height: 10.r,
                decoration: BoxDecoration(
                  color: inTransit ? C.success : C.muted,
                  shape: BoxShape.circle,
                ),
              ),
              SizedBox(width: 8.w),
              Expanded(
                child: Text(
                  'BUS #${trip.busNo}$route • $status',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.smallStrong.copyWith(
                    color: C.onSurfaceVariant,
                    letterSpacing: .4,
                  ),
                ),
              ),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                decoration: BoxDecoration(
                  color: C.emeraldSoft,
                  borderRadius: BorderRadius.circular(R.pill),
                  border: Border.all(color: C.successSoft),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      live ? Icons.gps_fixed_rounded : Icons.schedule_rounded,
                      size: 11.r,
                      color: C.successDark,
                    ),
                    SizedBox(width: 4.w),
                    Text(
                      live ? 'LIVE GPS' : 'SCHEDULE',
                      style: T.smallStrong.copyWith(
                        color: C.successDark,
                        fontSize: 10.5.sp,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 14.h),
          Row(
            children: [
              Container(
                width: 44.r,
                height: 44.r,
                decoration: BoxDecoration(
                  color: C.primary.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(R.md),
                ),
                child: Icon(
                  Icons.directions_bus_rounded,
                  color: C.primary,
                  size: 22.r,
                ),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8.w,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          fmtClock(trip.dropEta),
                          style: T.h2.copyWith(color: C.ink),
                        ),
                        Text(
                          inTransit
                              ? 'ETA ${trip.minutesToDrop} mins'
                              : phase == TripPhase.scheduled
                              ? 'Scheduled ${trip.stopWord}'
                              : live
                              ? 'Arrived'
                              : 'Stop time passed',
                          style: T.smallStrong.copyWith(color: C.emerald),
                        ),
                      ],
                    ),
                    Text(
                      inTransit
                          ? 'Next: ${trip.nextStop?.name ?? trip.dropStop.name}'
                          : phase == TripPhase.scheduled
                          ? '${trip.stopTitle} at ${trip.dropStop.name} • starts ${fmtClock(trip.departedAt)}'
                          : live
                          ? 'Dropped at ${trip.dropStop.name}'
                          : '${trip.markVerb ?? 'Passed'} • ${trip.dropStop.name}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: T.small,
                    ),
                  ],
                ),
              ),
              SizedBox(width: 8.w),
              AppButton(
                'Track Live',
                icon: Icons.near_me_outlined,
                expand: false,
                small: true,
                onPressed: track,
              ),
            ],
          ),
          SizedBox(height: 14.h),
          Divider(height: 1, color: C.cardBorder),
          SizedBox(height: 12.h),
          Row(
            children: [
              Expanded(
                flex: 3,
                child: AppProgress(trip.progressToDrop, height: 6),
              ),
              SizedBox(width: 10.w),
              Text(
                trip.stopsToDrop == 0
                    ? 'Reached your stop'
                    : '${trip.stopsToDrop} stop${trip.stopsToDrop == 1 ? '' : 's'} remaining',
                style: T.small.copyWith(color: C.muted, fontSize: 11.sp),
              ),
            ],
          ),
          if (!live) ...[
            SizedBox(height: 6.h),
            Text(
              'Schedule-based: this bus has no GPS feed.',
              key: const Key('home-bus-schedule-caption'),
              style: T.small.copyWith(color: C.muted, fontSize: 11.sp),
            ),
          ],
        ],
      ),
    );
  }
}
