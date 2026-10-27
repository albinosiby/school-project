import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../../transport/models/transport_models.dart';

/// Live bus tracking card (Figma Home): status line, LIVE GPS chip, drop ETA, next stop, Track Live
/// button and progress to the child's stop.
class HomeBusCard extends StatelessWidget {
  const HomeBusCard({super.key, required this.trip});
  final BusTrip trip;

  @override
  Widget build(BuildContext context) {
    final phase = trip.phase;
    final inTransit = phase == TripPhase.inTransit;
    final status = switch (phase) {
      TripPhase.inTransit => 'IN TRANSIT',
      TripPhase.droppedOff => 'DROPPED OFF',
      TripPhase.completed => 'TRIP ENDED',
    };
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
                  'BUS #${trip.busNo} (ROUTE ${trip.route}) • $status',
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
                      Icons.gps_fixed_rounded,
                      size: 11.r,
                      color: C.successDark,
                    ),
                    SizedBox(width: 4.w),
                    Text(
                      'LIVE GPS',
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
                              : 'Arrived',
                          style: T.smallStrong.copyWith(color: C.emerald),
                        ),
                      ],
                    ),
                    Text(
                      inTransit
                          ? 'Next: ${trip.nextStop?.name ?? trip.dropStop.name}'
                          : 'Dropped at ${trip.dropStop.name}',
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
        ],
      ),
    );
  }
}
