import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../models/transport_models.dart';

/// Copy shared by Track Live and the Home bus card. The demo feed ([BusTrip.statusOnly] false) keeps the Figma
/// wording; the school backend has no GPS, so its trip is described from recorded trip status and the child's mark.
extension BusTripLabels on BusTrip {
  String get _routeSuffix => route.isEmpty ? '' : ' • Route $route';

  /// "Pickup" / "Drop-off".
  String get stopTitle => kind == TripKind.pickup ? 'Pickup' : 'Drop-off';

  /// Pill on the ETA card.
  String get statusPill {
    if (!statusOnly) {
      return phase == TripPhase.inTransit
          ? 'On Time • Route $route'
          : 'Arrived • Route $route';
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
    if (!statusOnly) {
      return phase == TripPhase.inTransit
          ? ('Onboard Safe', Tone.success, Icons.sensors_rounded)
          : (
              'Dropped Safely',
              Tone.success,
              Icons.check_circle_outline_rounded,
            );
    }
    return switch (mark) {
      BusMark.boarded => ('On board', Tone.success, Icons.sensors_rounded),
      BusMark.dropped => (
        kind == TripKind.pickup ? 'At school' : 'Dropped off',
        Tone.success,
        Icons.check_circle_outline_rounded,
      ),
      BusMark.absent => (
        'Not on the bus',
        Tone.warning,
        Icons.person_off_outlined,
      ),
      null => ('Not marked yet', Tone.neutral, Icons.schedule_rounded),
    };
  }

  /// Child card second line.
  String get childLine {
    if (!statusOnly) {
      final tap = boardedAt;
      return [
        'Seat $seat',
        if (tap != null) 'Tap ${fmtClock(tap)}',
      ].join(' • ');
    }
    final at = markAt;
    return [
      if (seat.isNotEmpty) 'Seat $seat',
      if (markVerb != null)
        at == null ? markVerb! : '$markVerb ${fmtClock(at)}',
      if (markVerb == null)
        '${kind == TripKind.pickup ? 'Pickup' : 'Drop'} at ${dropStop.name}',
    ].join(' • ');
  }

  /// ETA headline, e.g. "12 mins" (+ " away" while on the way).
  (String, String?) get headline {
    if (statusOnly)
      return (
        switch (mark) {
          BusMark.dropped =>
            kind == TripKind.pickup ? 'At school' : 'Dropped off',
          BusMark.boarded => 'On board',
          BusMark.absent => 'Marked absent',
          null => switch (phase) {
            TripPhase.scheduled => 'Not started',
            TripPhase.completed => 'Trip ended',
            _ => 'On the way',
          },
        },
        null,
      );
    if (phase == TripPhase.scheduled)
      return (fmtClock(dropEta!), '  scheduled');
    if (phase == TripPhase.inTransit) {
      return ('$minutesToDrop min${minutesToDrop == 1 ? '' : 's'}', '  away');
    }
    if (!statusOnly) return ('Dropped off', null);
    return (
      switch (mark) {
        BusMark.dropped =>
          kind == TripKind.pickup ? 'At school' : 'Dropped off',
        BusMark.boarded => 'On board',
        BusMark.absent => 'Marked absent',
        null => phase == TripPhase.completed ? 'Trip ended' : 'Stop passed',
      },
      null,
    );
  }

  /// Line under the headline.
  String get headlineDetail {
    final stop = dropStop.name;
    if (statusOnly) return '$stopTitle at $stop';
    return switch (phase) {
      TripPhase.scheduled =>
        'Trip starts ${fmtClock(departedAt!)} • $stopTitle at $stop',
      TripPhase.inTransit => '$stopTitle at ${fmtClock(dropEta!)} • $stop',
      _ =>
        statusOnly
            ? '$stopTitle at $stop was due ${fmtClock(dropEta!)}'
            : 'Reached $stop at ${fmtClock(dropEta!)}',
    };
  }

  /// Map chip (top left).
  String get mapStatus {
    if (!statusOnly)
      return phase == TripPhase.completed
          ? 'Trip ended'
          : 'Live • $speedKmh km/h';
    return switch (phase) {
      TripPhase.scheduled => 'Not started',
      TripPhase.completed => 'Trip ended',
      _ => 'Trip in progress',
    };
  }

  /// Bottom map chip.
  String get originLine => statusOnly
      ? (departedAt == null
            ? origin.name
            : '${origin.name} • Departed ${fmtClock(departedAt!)}')
      : phase == TripPhase.scheduled
      ? '${origin.name} • Starts ${fmtClock(departedAt!)}'
      : '${origin.name} • Departed ${fmtClock(departedAt!)}';

  /// ETA bubble on the map.
  String get etaBubble => statusOnly
      ? 'Your stop: ${dropStop.name}'
      : '${kind == TripKind.pickup ? 'Pickup' : 'Drop'} ETA ${fmtClock(dropEta!)}';

  /// Timeline header of the child's stop.
  String get childStopCaps =>
      kind == TripKind.pickup ? "YOUR CHILD'S PICKUP" : "YOUR CHILD'S DROP";
}

/// School trip status comes from crew records; no position or arrival time is inferred.
const tripStatusCaption =
    'Trip status and boarding updates are recorded by the bus crew. Live location is unavailable.';
