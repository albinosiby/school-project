import 'package:equatable/equatable.dart';

/// Morning pickup (home -> school) or afternoon drop (school -> home).
enum TripKind { pickup, drop }

extension TripKindX on TripKind {
  String get code => name;
  String get label => this == TripKind.pickup ? 'Morning Pickup' : 'Afternoon Drop';
  String get short => this == TripKind.pickup ? 'Pickup' : 'Drop';
  static TripKind parse(Object? v) => '$v' == 'drop' ? TripKind.drop : TripKind.pickup;
}

enum TripStatus { scheduled, active, completed }

extension TripStatusX on TripStatus {
  String get code => name;
  String get label => switch (this) {
    TripStatus.scheduled => 'Scheduled',
    TripStatus.active => 'Live',
    TripStatus.completed => 'Completed',
  };
  static TripStatus parse(Object? v) => switch ('$v') {
    'active' => TripStatus.active,
    'completed' => TripStatus.completed,
    _ => TripStatus.scheduled,
  };
}

/// Pre-trip checklist (contract 14.3): every item must be true before a pickup trip starts.
class Checklist extends Equatable {
  const Checklist({
    this.brakes = false,
    this.lights = false,
    this.tyres = false,
    this.fuel = false,
    this.firstAid = false,
    this.cleanliness = false,
  });
  final bool brakes, lights, tyres, fuel, firstAid, cleanliness;

  static const items = <(String key, String label, String hint)>[
    ('brakes', 'Brakes & steering', 'Pedal firm, no pull, handbrake holds'),
    ('lights', 'Lights & indicators', 'Head, tail, brake and hazard lamps work'),
    ('tyres', 'Tyres & mirrors', 'Pressure, tread, no cuts; mirrors adjusted'),
    ('fuel', 'Fuel & fluids', 'Enough fuel for the route; coolant, oil ok'),
    ('firstAid', 'First-aid & fire kit', 'Kit sealed and in date; extinguisher charged'),
    ('cleanliness', 'Cabin clean & seat belts', 'Floor clear, belts and emergency exit free'),
  ];

  bool operator [](String key) => switch (key) {
    'brakes' => brakes,
    'lights' => lights,
    'tyres' => tyres,
    'fuel' => fuel,
    'firstAid' => firstAid,
    'cleanliness' => cleanliness,
    _ => false,
  };

  Checklist set(String key, bool v) => Checklist(
    brakes: key == 'brakes' ? v : brakes,
    lights: key == 'lights' ? v : lights,
    tyres: key == 'tyres' ? v : tyres,
    fuel: key == 'fuel' ? v : fuel,
    firstAid: key == 'firstAid' ? v : firstAid,
    cleanliness: key == 'cleanliness' ? v : cleanliness,
  );

  bool get complete => brakes && lights && tyres && fuel && firstAid && cleanliness;
  int get done => [brakes, lights, tyres, fuel, firstAid, cleanliness].where((b) => b).length;

  factory Checklist.fromJson(Map<String, dynamic>? j) => j == null
      ? const Checklist()
      : Checklist(
          brakes: j['brakes'] == true, lights: j['lights'] == true, tyres: j['tyres'] == true,
          fuel: j['fuel'] == true, firstAid: j['firstAid'] == true, cleanliness: j['cleanliness'] == true,
        );
  Map<String, dynamic> toJson() => {'brakes': brakes, 'lights': lights, 'tyres': tyres, 'fuel': fuel, 'firstAid': firstAid, 'cleanliness': cleanliness};

  @override
  List<Object?> get props => [brakes, lights, tyres, fuel, firstAid, cleanliness];
}

/// `tr_trips/{date}_{busId}_{kind}` (contract 14.3).
class Trip extends Equatable {
  const Trip({
    required this.id,
    required this.busId,
    required this.date,
    required this.kind,
    this.bus = '',
    this.routeName = '',
    this.status = TripStatus.scheduled,
    this.driverId = '',
    this.driver = '',
    this.attendantId = '',
    this.attendant = '',
    this.total = 0,
    this.boarded = 0,
    this.dropped = 0,
    this.absent = 0,
    this.startedAt,
    this.startedBy,
    this.endedAt,
    this.endedBy,
    this.checklist = const Checklist(),
    this.checklistAt,
    this.odometerStart,
    this.odometerEnd,
    this.note = '',
    this.currentStopId,
  });
  final String id, busId, date, bus, routeName, driverId, driver, attendantId, attendant, note;
  final TripKind kind;
  final TripStatus status;
  final int total, boarded, dropped, absent;
  final DateTime? startedAt, endedAt, checklistAt;
  final String? startedBy, endedBy, currentStopId;
  final Checklist checklist;
  final int? odometerStart, odometerEnd;

  static String idFor(String date, String busId, TripKind kind) => '${date}_${busId}_${kind.code}';

  bool get isActive => status == TripStatus.active;
  bool get isCompleted => status == TripStatus.completed;
  bool get isScheduled => status == TripStatus.scheduled;
  /// A pickup trip needs the full checklist (contract 14.3); the drop trip reuses the morning inspection.
  bool get needsChecklist => kind == TripKind.pickup && !checklist.complete;
  int get pending => total - boarded - dropped - absent;

  factory Trip.fromJson(Map<String, dynamic> j, {String? id}) => Trip(
    id: id ?? '${j['id'] ?? ''}',
    busId: '${j['busId'] ?? ''}',
    bus: '${j['bus'] ?? ''}',
    routeName: '${j['routeName'] ?? ''}',
    date: '${j['date'] ?? ''}',
    kind: TripKindX.parse(j['kind']),
    status: TripStatusX.parse(j['status']),
    driverId: '${j['driverId'] ?? ''}',
    driver: '${j['driver'] ?? ''}',
    attendantId: '${j['attendantId'] ?? ''}',
    attendant: '${j['attendant'] ?? ''}',
    total: (j['total'] as num?)?.toInt() ?? 0,
    boarded: (j['boarded'] as num?)?.toInt() ?? 0,
    dropped: (j['dropped'] as num?)?.toInt() ?? 0,
    absent: (j['absent'] as num?)?.toInt() ?? 0,
    startedAt: parseIso(j['startedAt']),
    startedBy: j['startedBy'] == null ? null : '${j['startedBy']}',
    endedAt: parseIso(j['endedAt']),
    endedBy: j['endedBy'] == null ? null : '${j['endedBy']}',
    checklist: Checklist.fromJson(j['checklist'] is Map ? Map<String, dynamic>.from(j['checklist'] as Map) : null),
    checklistAt: parseIso(j['checklistAt']),
    odometerStart: (j['odometerStart'] as num?)?.toInt(),
    odometerEnd: (j['odometerEnd'] as num?)?.toInt(),
    note: '${j['note'] ?? ''}',
    currentStopId: j['currentStopId'] == null ? null : '${j['currentStopId']}',
  );

  Map<String, dynamic> toJson() => {
    'id': id, 'busId': busId, 'bus': bus, 'routeName': routeName, 'date': date, 'kind': kind.code, 'status': status.code,
    'driverId': driverId, 'driver': driver, 'attendantId': attendantId, 'attendant': attendant,
    'total': total, 'boarded': boarded, 'dropped': dropped, 'absent': absent,
    if (startedAt != null) 'startedAt': startedAt!.toUtc().toIso8601String(), if (startedBy != null) 'startedBy': startedBy,
    if (endedAt != null) 'endedAt': endedAt!.toUtc().toIso8601String(), if (endedBy != null) 'endedBy': endedBy,
    'checklist': checklist.toJson(), if (checklistAt != null) 'checklistAt': checklistAt!.toUtc().toIso8601String(),
    if (odometerStart != null) 'odometerStart': odometerStart, if (odometerEnd != null) 'odometerEnd': odometerEnd,
    'note': note, if (currentStopId != null) 'currentStopId': currentStopId,
  };

  Trip copyWith({
    TripStatus? status, int? total, int? boarded, int? dropped, int? absent, DateTime? startedAt, String? startedBy,
    DateTime? endedAt, String? endedBy, Checklist? checklist, DateTime? checklistAt, int? odometerStart, int? odometerEnd,
    String? note, String? currentStopId,
  }) => Trip(
    id: id, busId: busId, bus: bus, routeName: routeName, date: date, kind: kind, status: status ?? this.status,
    driverId: driverId, driver: driver, attendantId: attendantId, attendant: attendant,
    total: total ?? this.total, boarded: boarded ?? this.boarded, dropped: dropped ?? this.dropped, absent: absent ?? this.absent,
    startedAt: startedAt ?? this.startedAt, startedBy: startedBy ?? this.startedBy, endedAt: endedAt ?? this.endedAt,
    endedBy: endedBy ?? this.endedBy, checklist: checklist ?? this.checklist, checklistAt: checklistAt ?? this.checklistAt,
    odometerStart: odometerStart ?? this.odometerStart, odometerEnd: odometerEnd ?? this.odometerEnd, note: note ?? this.note,
    currentStopId: currentStopId ?? this.currentStopId,
  );

  @override
  List<Object?> get props => [id, busId, bus, routeName, date, kind, status, driverId, driver, attendantId, attendant, total, boarded, dropped, absent, startedAt, startedBy, endedAt, endedBy, checklist, checklistAt, odometerStart, odometerEnd, note, currentStopId];
}

/// ISO string (UTC `...Z`) or millis -> local DateTime; null when unparsable.
DateTime? parseIso(Object? v) => switch (v) {
  int ms => DateTime.fromMillisecondsSinceEpoch(ms),
  String s when s.isNotEmpty => DateTime.tryParse(s)?.toLocal(),
  _ => null,
};
