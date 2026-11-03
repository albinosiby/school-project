import 'dart:math' as math;
import 'package:equatable/equatable.dart';

/// Parent notification preferences for the school bus (Track Live "notify me" toggles).
enum BusAlert { proximity, arrival, delay }

extension BusAlertX on BusAlert {
  String get title => switch (this) {
    BusAlert.proximity => 'Proximity Alert (500m)',
    BusAlert.arrival => 'Arrival at drop stop',
    BusAlert.delay => 'Delay alerts',
  };
  String get subtitle => switch (this) {
    BusAlert.proximity => 'Notify me when the bus is 500 m from the drop stop',
    BusAlert.arrival => 'Notify me when my child gets off the bus',
    BusAlert.delay => 'Notify me if the bus runs more than 10 mins late',
  };
}

class BusStop extends Equatable {
  const BusStop({
    required this.id,
    required this.name,
    required this.offsetMinutes,
    required this.km,
    required this.mapX,
    required this.mapY,
    this.isChildDrop = false,
  });
  final String id, name;

  /// Scheduled minutes after departure.
  final int offsetMinutes;

  /// Route distance from the campus.
  final double km;

  /// Position on the simulated map (0..1 of its width / height).
  final double mapX, mapY;
  final bool isChildDrop;

  @override
  List<Object?> get props => [
    id,
    name,
    offsetMinutes,
    km,
    mapX,
    mapY,
    isChildDrop,
  ];
}

class BusContact extends Equatable {
  const BusContact({
    required this.name,
    required this.role,
    required this.phone,
    this.rating,
  });
  final String name, role, phone;
  final double? rating;

  @override
  List<Object?> get props => [name, role, phone, rating];
}

/// Alerts on by default (until the guardian changes them on this device).
const defaultBusAlerts = {
  BusAlert.proximity: true,
  BusAlert.arrival: true,
  BusAlert.delay: false,
};

enum StopState { passed, next, upcoming }

/// [scheduled]: the trip has not started yet (nothing passed).
enum TripPhase { scheduled, inTransit, droppedOff, completed }

/// Morning (home -> school) or afternoon (school -> home) trip (data contract §14.3).
enum TripKind { pickup, drop }

/// `tr_trips.status`.
enum TripStatus { scheduled, active, completed }

/// The child's mark on the trip (`tr_attendance.marks`, §14.4).
enum BusMark { boarded, absent, dropped }

/// The trip of the child's bus. Position is derived from [elapsedMinutes] (minutes since departure):
/// simulated GPS in the demo, the stop schedule and trip status on the school backend ([scheduleBased]);
/// everything shown (ETA, next stop, distance, progress) derives from it.
class BusTrip extends Equatable {
  const BusTrip({
    required this.childId,
    required this.busNo,
    required this.route,
    required this.vehicleNo,
    required this.safety,
    required this.driver,
    required this.attendant,
    required this.departedAt,
    required this.elapsedMinutes,
    required this.stops,
    required this.seat,
    required this.boardedAt,
    required this.alerts,
    this.kind = TripKind.drop,
    this.status = TripStatus.active,
    this.mark,
    this.markAt,
    this.scheduleBased = false,
  });

  /// The child has no school bus (no `par_transport` doc): Track Live and Home show an empty state.
  BusTrip.notOnBus(this.childId)
    : busNo = '',
      route = '',
      vehicleNo = '',
      safety = '',
      seat = '',
      driver = const BusContact(name: '', role: 'Driver', phone: ''),
      attendant = const BusContact(name: '', role: 'Bus attendant', phone: ''),
      departedAt = DateTime(2000),
      boardedAt = null,
      elapsedMinutes = 0,
      stops = const [],
      alerts = const {},
      kind = TripKind.drop,
      status = TripStatus.scheduled,
      mark = null,
      markAt = null,
      scheduleBased = true;

  final String childId, busNo, route, vehicleNo, safety;

  /// Empty when the school does not allot seats.
  final String seat;
  final BusContact driver, attendant;
  final DateTime departedAt;

  /// When the child tapped in / was marked boarded; null when not known.
  final DateTime? boardedAt;
  final double elapsedMinutes;
  final List<BusStop> stops;
  final Map<BusAlert, bool> alerts;
  final TripKind kind;
  final TripStatus status;
  final BusMark? mark;
  final DateTime? markAt;

  /// No GPS feed: the position is estimated from the stop schedule and the trip status.
  final bool scheduleBased;

  /// False for [BusTrip.notOnBus].
  bool get onBus => stops.isNotEmpty;

  bool alertOn(BusAlert a) => alerts[a] ?? false;

  /// "pickup" / "drop": the child's stop on this trip.
  String get stopWord => kind == TripKind.pickup ? 'pickup' : 'drop';

  /// The bus has reached (or passed) [s]; nothing has passed before the trip starts.
  bool isPassed(BusStop s) =>
      status != TripStatus.scheduled && s.offsetMinutes <= elapsedMinutes;

  /// Stops carry route distances (the demo map); the school backend only has times.
  bool get hasDistance => stops.any((s) => s.km > 0);

  BusStop get origin => stops.first;
  BusStop get terminus => stops.last;
  BusStop get dropStop =>
      stops.firstWhere((s) => s.isChildDrop, orElse: () => stops.last);
  int get dropIndex => stops.indexOf(dropStop);

  DateTime timeAt(BusStop s) =>
      departedAt.add(Duration(minutes: s.offsetMinutes));
  DateTime get dropEta => timeAt(dropStop);

  StopState stateOf(BusStop s) => isPassed(s)
      ? StopState.passed
      : (s == nextStop ? StopState.next : StopState.upcoming);

  BusStop? get nextStop {
    for (final s in stops) {
      if (!isPassed(s)) return s;
    }
    return null;
  }

  /// Index of the last passed stop (segment start).
  int get _segment {
    var i = 0;
    for (var k = 0; k < stops.length; k++) {
      if (isPassed(stops[k])) i = k;
    }
    return i;
  }

  /// 0..1 progress inside the current segment.
  double get _segmentT {
    if (status == TripStatus.scheduled) return 0;
    final i = _segment;
    if (i >= stops.length - 1) return 0;
    final a = stops[i].offsetMinutes, b = stops[i + 1].offsetMinutes;
    return ((elapsedMinutes - a) / (b - a)).clamp(0, 1).toDouble();
  }

  /// Simulated map position of the bus (0..1).
  ({double x, double y}) get mapPosition {
    final i = _segment;
    if (i >= stops.length - 1) return (x: terminus.mapX, y: terminus.mapY);
    final t = _segmentT, a = stops[i], b = stops[i + 1];
    return (
      x: a.mapX + (b.mapX - a.mapX) * t,
      y: a.mapY + (b.mapY - a.mapY) * t,
    );
  }

  double get kmTravelled {
    final i = _segment;
    if (i >= stops.length - 1) return terminus.km;
    return stops[i].km + (stops[i + 1].km - stops[i].km) * _segmentT;
  }

  double get kmToDrop => math.max(0, dropStop.km - kmTravelled);
  int get minutesToDrop =>
      math.max(0, (dropStop.offsetMinutes - elapsedMinutes).ceil());
  int? get minutesToNext => nextStop == null
      ? null
      : math.max(1, (nextStop!.offsetMinutes - elapsedMinutes).ceil());

  /// Stops still ahead up to and including the child's drop.
  int get stopsToDrop =>
      stops.take(dropIndex + 1).where((s) => !isPassed(s)).length;

  /// 0..1 of the way from the first stop to the child's stop (by distance, else by the schedule).
  double get progressToDrop {
    if (status == TripStatus.scheduled) return 0;
    if (!hasDistance) {
      final to = dropStop.offsetMinutes;
      return to <= 0
          ? (isPassed(dropStop) ? 1 : 0)
          : (elapsedMinutes / to).clamp(0, 1).toDouble();
    }
    return dropStop.km == 0
        ? 1
        : (kmTravelled / dropStop.km).clamp(0, 1).toDouble();
  }

  TripPhase get phase => status == TripStatus.scheduled
      ? TripPhase.scheduled
      : status == TripStatus.completed ||
            elapsedMinutes >= terminus.offsetMinutes
      ? TripPhase.completed
      : isPassed(dropStop)
      ? TripPhase.droppedOff
      : TripPhase.inTransit;

  /// Simulated GPS speed (0 once the trip is over or before it starts).
  int get speedKmh =>
      phase == TripPhase.completed || phase == TripPhase.scheduled
      ? 0
      : 24 + ((elapsedMinutes * 7).round() % 15);

  String get traffic => speedKmh < 28
      ? 'Heavy Traffic'
      : (speedKmh < 34 ? 'Mild Traffic' : 'Clear Roads');

  BusTrip copyWith({double? elapsedMinutes, Map<BusAlert, bool>? alerts}) =>
      BusTrip(
        childId: childId,
        busNo: busNo,
        route: route,
        vehicleNo: vehicleNo,
        safety: safety,
        driver: driver,
        attendant: attendant,
        departedAt: departedAt,
        elapsedMinutes: elapsedMinutes ?? this.elapsedMinutes,
        stops: stops,
        seat: seat,
        boardedAt: boardedAt,
        alerts: alerts ?? this.alerts,
        kind: kind,
        status: status,
        mark: mark,
        markAt: markAt,
        scheduleBased: scheduleBased,
      );

  @override
  List<Object?> get props => [
    childId,
    busNo,
    route,
    vehicleNo,
    safety,
    seat,
    driver,
    attendant,
    departedAt,
    boardedAt,
    elapsedMinutes,
    stops,
    alerts,
    kind,
    status,
    mark,
    markAt,
    scheduleBased,
  ];
}

/// RFID badge tap at the school gate.
class GateEntry extends Equatable {
  const GateEntry({required this.at, required this.gate});
  final DateTime at;
  final String gate;

  @override
  List<Object?> get props => [at, gate];
}
