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

enum StopState { passed, next, upcoming }

enum TripPhase { inTransit, droppedOff, completed }

/// The afternoon trip of the child's bus. Position is simulated from [elapsedMinutes] (minutes since
/// departure); everything shown (ETA, next stop, distance, progress) derives from it.
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
  });
  final String childId, busNo, route, vehicleNo, safety, seat;
  final BusContact driver, attendant;
  final DateTime departedAt, boardedAt;
  final double elapsedMinutes;
  final List<BusStop> stops;
  final Map<BusAlert, bool> alerts;

  bool alertOn(BusAlert a) => alerts[a] ?? false;

  BusStop get origin => stops.first;
  BusStop get terminus => stops.last;
  BusStop get dropStop =>
      stops.firstWhere((s) => s.isChildDrop, orElse: () => stops.last);
  int get dropIndex => stops.indexOf(dropStop);

  DateTime timeAt(BusStop s) =>
      departedAt.add(Duration(minutes: s.offsetMinutes));
  DateTime get dropEta => timeAt(dropStop);

  StopState stateOf(BusStop s) => s.offsetMinutes <= elapsedMinutes
      ? StopState.passed
      : (s == nextStop ? StopState.next : StopState.upcoming);

  BusStop? get nextStop {
    for (final s in stops) {
      if (s.offsetMinutes > elapsedMinutes) return s;
    }
    return null;
  }

  /// Index of the last passed stop (segment start).
  int get _segment {
    var i = 0;
    for (var k = 0; k < stops.length; k++) {
      if (stops[k].offsetMinutes <= elapsedMinutes) i = k;
    }
    return i;
  }

  /// 0..1 progress inside the current segment.
  double get _segmentT {
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
  int get stopsToDrop => stops
      .take(dropIndex + 1)
      .where((s) => s.offsetMinutes > elapsedMinutes)
      .length;

  /// 0..1 of the way from campus to the child's drop.
  double get progressToDrop =>
      dropStop.km == 0 ? 1 : (kmTravelled / dropStop.km).clamp(0, 1).toDouble();

  TripPhase get phase => elapsedMinutes >= terminus.offsetMinutes
      ? TripPhase.completed
      : elapsedMinutes >= dropStop.offsetMinutes
      ? TripPhase.droppedOff
      : TripPhase.inTransit;

  /// Simulated GPS speed (0 once the trip is over).
  int get speedKmh => phase == TripPhase.completed
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
