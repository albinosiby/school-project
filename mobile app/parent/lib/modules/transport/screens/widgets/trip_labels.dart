import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../models/transport_models.dart';

/// Copy shared by Track Live and the Home bus card. The demo feed ([BusTrip.scheduleBased] false) keeps the Figma
/// wording; the school backend has no GPS, so its trip is described from the schedule, trip status and the child's mark.
extension BusTripLabels on BusTrip {
  String get _routeSuffix => route.isEmpty ? '' : ' • Route $route';

  /// "Pickup" / "Drop-off".
  String get stopTitle => kind == TripKind.pickup ? 'Pickup' : 'Drop-off';

  /// Pill on the ETA card.
  String get statusPill {
    if (!scheduleBased) {
      return phase == TripPhase.inTransit ? 'On Time • Route $route' : 'Arrived • Route $route';
    }
    return switch (phase) {
      TripPhase.scheduled => 'Scheduled$_routeSuffix',
      TripPhase.completed => 'Trip ended$_routeSuffix',
      _ => 'On the way$_routeSuffix',
    };
  }

  /// The child's mark as a verb ("Boarded"), null before any mark.
  String? get markVerb => switch (mark) {
        BusMark.boarded => 'Boarded',
        BusMark.dropped => kind == TripKind.pickup ? 'Reached school' : 'Got off',
        BusMark.absent => 'Marked absent',
        null => null,
      };

  /// Child card pill: (label, tone, icon).
  (String, Tone, IconData) get childPill {
    if (!scheduleBased) {
      return phase == TripPhase.inTransit
          ? ('Onboard Safe', Tone.success, Icons.sensors_rounded)
          : ('Dropped Safely', Tone.success, Icons.check_circle_outline_rounded);
    }
    return switch (mark) {
      BusMark.boarded => ('On board', Tone.success, Icons.sensors_rounded),
      BusMark.dropped => (
          kind == TripKind.pickup ? 'At school' : 'Dropped off',
          Tone.success,
          Icons.check_circle_outline_rounded,
        ),
      BusMark.absent => ('Not on the bus', Tone.warning, Icons.person_off_outlined),
      null => ('Not marked yet', Tone.neutral, Icons.schedule_rounded),
    };
  }

  /// Child card second line.
  String get childLine {
    if (!scheduleBased) {
      final tap = boardedAt;
      return ['Seat $seat', if (tap != null) 'Tap ${fmtClock(tap)}'].join(' • ');
    }
    final at = markAt;
    return [
      if (seat.isNotEmpty) 'Seat $seat',
      if (markVerb != null) at == null ? markVerb! : '$markVerb ${fmtClock(at)}',
      if (markVerb == null) '${kind == TripKind.pickup ? 'Pickup' : 'Drop'} at ${dropStop.name}',
    ].join(' • ');
  }

  /// ETA headline, e.g. "12 mins" (+ " away" while on the way).
  (String, String?) get headline {
    if (phase == TripPhase.scheduled) return (fmtClock(dropEta), '  scheduled');
    if (phase == TripPhase.inTransit) {
      return ('$minutesToDrop min${minutesToDrop == 1 ? '' : 's'}', '  away');
    }
    if (!scheduleBased) return ('Dropped off', null);
    return (switch (mark) {
      BusMark.dropped => kind == TripKind.pickup ? 'At school' : 'Dropped off',
      BusMark.boarded => 'On board',
      BusMark.absent => 'Marked absent',
      null => phase == TripPhase.completed ? 'Trip ended' : 'Stop passed',
    }, null);
  }

  /// Line under the headline.
  String get headlineDetail {
    final stop = dropStop.name;
    return switch (phase) {
      TripPhase.scheduled => 'Trip starts ${fmtClock(departedAt)} • $stopTitle at $stop',
      TripPhase.inTransit => '$stopTitle at ${fmtClock(dropEta)} • $stop',
      _ => scheduleBased
          ? '$stopTitle at $stop was due ${fmtClock(dropEta)}'
          : 'Reached $stop at ${fmtClock(dropEta)}',
    };
  }

  /// Map chip (top left).
  String get mapStatus {
    if (!scheduleBased) return phase == TripPhase.completed ? 'Trip ended' : 'Live • $speedKmh km/h';
    return switch (phase) {
      TripPhase.scheduled => 'Not started • schedule',
      TripPhase.completed => 'Trip ended',
      _ => 'Estimated from schedule',
    };
  }

  /// Bottom map chip.
  String get originLine => phase == TripPhase.scheduled
      ? '${origin.name} • Starts ${fmtClock(departedAt)}'
      : '${origin.name} • Departed ${fmtClock(departedAt)}';

  /// ETA bubble on the map.
  String get etaBubble => '${kind == TripKind.pickup ? 'Pickup' : 'Drop'} ETA ${fmtClock(dropEta)}';

  /// Timeline header of the child's stop.
  String get childStopCaps => kind == TripKind.pickup ? "YOUR CHILD'S PICKUP" : "YOUR CHILD'S DROP";
}

/// Caption shown wherever a schedule-based position is displayed.
const scheduleCaption = 'No GPS on this bus: the position is estimated from the stop timetable and the trip status '
    'the bus crew records.';
