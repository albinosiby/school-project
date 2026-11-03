import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../models/transport_models.dart';
import 'trip_labels.dart';

/// "Route Milestones": every stop with passed (green tick), next (blue, minutes away) and remaining
/// (grey) states; the child's drop stop is highlighted.
class StopTimeline extends StatelessWidget {
  const StopTimeline({super.key, required this.trip});
  final BusTrip trip;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var i = 0; i < trip.stops.length; i++)
        _StopRow(
          trip: trip,
          stop: trip.stops[i],
          last: i == trip.stops.length - 1,
          passedLine: trip.isPassed(trip.stops[i]),
        ),
    ],
  );
}

class _StopRow extends StatelessWidget {
  const _StopRow({
    required this.trip,
    required this.stop,
    required this.last,
    required this.passedLine,
  });
  final BusTrip trip;
  final BusStop stop;
  final bool last, passedLine;

  @override
  Widget build(BuildContext context) {
    final state = trip.stateOf(stop);
    final passed = state == StopState.passed;
    final next = state == StopState.next;
    final blue = next || (stop.isChildDrop && !passed);
    final (dotBg, dotIcon, dotFg) = passed
        ? (C.emeraldSoft, Icons.check_rounded, C.emerald)
        : blue
        ? (
            C.primary,
            stop.isChildDrop
                ? Icons.location_on_rounded
                : Icons.directions_bus_rounded,
            Colors.white,
          )
        : (C.outline, Icons.flag_outlined, C.slate);
    final time = Text(
      fmtClock(trip.timeAt(stop)),
      style: T.small.copyWith(
        color: blue ? C.primary : C.onSurfaceVariant,
        fontWeight: blue ? FontWeight.w700 : FontWeight.w500,
      ),
    );
    final sub = passed
        ? (stop.isChildDrop
              ? (trip.scheduleBased ? (trip.markVerb ?? 'Passed') : 'Dropped off')
              : (stop == trip.origin ? 'Departed' : 'Passed'))
        : next
        ? (trip.phase == TripPhase.scheduled
              ? 'First stop • trip not started'
              : 'Next stop • ${trip.minutesToNext} min${trip.minutesToNext == 1 ? '' : 's'} away')
        : null;
    final body = stop.isChildDrop
        ? Container(
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
            decoration: BoxDecoration(
              color: C.indigoSoft.withValues(alpha: .35),
              borderRadius: BorderRadius.circular(R.md),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        trip.childStopCaps,
                        style: T.caps.copyWith(fontSize: 10.sp),
                      ),
                      Text(
                        stop.name,
                        style: T.bodyStrong.copyWith(color: C.onSurface),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (sub != null) Text(sub, style: T.small),
                    ],
                  ),
                ),
                Text(
                  fmtClock(trip.timeAt(stop)),
                  style: T.h2.copyWith(color: C.primary),
                ),
              ],
            ),
          )
        : Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      stop.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.bodyStrong.copyWith(
                        color: next ? C.primary : C.onSurface,
                        fontWeight: next ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                    if (sub != null)
                      Text(
                        sub,
                        style: T.small.copyWith(
                          color: next ? C.primary : C.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
              ),
              time,
            ],
          );
    return Semantics(
      label:
          '${stop.name}, ${passed ? 'passed' : (next ? 'next stop' : 'upcoming')}',
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 24.r,
              child: Column(
                children: [
                  Container(
                    width: 22.r,
                    height: 22.r,
                    decoration: BoxDecoration(
                      color: dotBg,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(dotIcon, size: 13.r, color: dotFg),
                  ),
                  if (!last)
                    Expanded(
                      child: Container(
                        width: 2,
                        margin: EdgeInsets.symmetric(vertical: 2.h),
                        color: passedLine ? C.primary : C.outline,
                      ),
                    ),
                ],
              ),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: last ? 0 : 14.h),
                child: body,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
