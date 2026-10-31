import 'package:equatable/equatable.dart';

/// The two crew roles of the driver app (contract 14.1).
enum CrewRole { driver, attendant }

extension CrewRoleX on CrewRole {
  String get label => this == CrewRole.driver ? 'Driver' : 'Bus Staff';
  String get title => this == CrewRole.driver ? 'Lead Driver' : 'Bus Attendant';
  String get code => name;
  static CrewRole parse(Object? v) => '$v' == 'attendant' ? CrewRole.attendant : CrewRole.driver;
}

/// `tr_crew/{id}`.
class CrewMember extends Equatable {
  const CrewMember({
    required this.id,
    required this.name,
    required this.role,
    this.empId = '',
    this.phone = '',
    this.email = '',
    this.status = 'Active',
    this.busId,
    this.bus,
    this.licenseNo,
    this.licenseExpiry,
    this.joined,
    this.address = '',
    this.emergencyName = '',
    this.emergencyPhone = '',
    this.photoUrl,
  });
  final String id, name, empId, phone, email, status, address, emergencyName, emergencyPhone;
  final CrewRole role;
  final String? busId, bus, licenseNo, licenseExpiry, joined, photoUrl;

  bool get isDriver => role == CrewRole.driver;
  bool get hasBus => (busId ?? '').isNotEmpty;

  factory CrewMember.fromJson(Map<String, dynamic> j, {String? id}) => CrewMember(
    id: id ?? '${j['id'] ?? ''}',
    name: '${j['name'] ?? ''}',
    role: CrewRoleX.parse(j['role']),
    empId: '${j['empId'] ?? ''}',
    phone: '${j['phone'] ?? ''}',
    email: '${j['email'] ?? ''}',
    status: '${j['status'] ?? 'Active'}',
    busId: _opt(j['busId']),
    bus: _opt(j['bus']),
    licenseNo: _opt(j['licenseNo']),
    licenseExpiry: _opt(j['licenseExpiry']),
    joined: _opt(j['joined']),
    address: '${j['address'] ?? ''}',
    emergencyName: '${j['emergencyName'] ?? ''}',
    emergencyPhone: '${j['emergencyPhone'] ?? ''}',
    photoUrl: _opt(j['photoUrl']),
  );

  Map<String, dynamic> toJson() => {
    'id': id, 'name': name, 'role': role.code, 'empId': empId, 'phone': phone, 'email': email, 'status': status,
    if (busId != null) 'busId': busId, if (bus != null) 'bus': bus,
    if (licenseNo != null) 'licenseNo': licenseNo, if (licenseExpiry != null) 'licenseExpiry': licenseExpiry,
    if (joined != null) 'joined': joined, 'address': address, 'emergencyName': emergencyName, 'emergencyPhone': emergencyPhone,
    if (photoUrl != null) 'photoUrl': photoUrl,
  };

  CrewMember copyWith({String? phone, String? address, String? emergencyName, String? emergencyPhone, String? status, String? busId, String? bus}) =>
      CrewMember(
        id: id, name: name, role: role, empId: empId, phone: phone ?? this.phone, email: email, status: status ?? this.status,
        busId: busId ?? this.busId, bus: bus ?? this.bus, licenseNo: licenseNo, licenseExpiry: licenseExpiry, joined: joined,
        address: address ?? this.address, emergencyName: emergencyName ?? this.emergencyName,
        emergencyPhone: emergencyPhone ?? this.emergencyPhone, photoUrl: photoUrl,
      );

  @override
  List<Object?> get props => [id, name, role, empId, phone, email, status, busId, bus, licenseNo, licenseExpiry, joined, address, emergencyName, emergencyPhone, photoUrl];
}

String? _opt(Object? v) => v == null || '$v'.isEmpty ? null : '$v';

/// One stop of a bus route (contract 14.2), in route order.
class BusStop extends Equatable {
  const BusStop({required this.id, required this.name, this.pickupTime = '', this.dropTime = '', this.landmark = ''});
  final String id, name, pickupTime, dropTime, landmark;

  factory BusStop.fromJson(Map<String, dynamic> j) => BusStop(
    id: '${j['id'] ?? ''}', name: '${j['name'] ?? ''}', pickupTime: '${j['pickupTime'] ?? ''}',
    dropTime: '${j['dropTime'] ?? ''}', landmark: '${j['landmark'] ?? ''}',
  );
  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'pickupTime': pickupTime, 'dropTime': dropTime, 'landmark': landmark};

  @override
  List<Object?> get props => [id, name, pickupTime, dropTime, landmark];
}

/// `tr_buses/{id}`.
class Bus extends Equatable {
  const Bus({
    required this.id,
    required this.number,
    this.regNo = '',
    this.capacity = 0,
    this.model = '',
    this.routeName = '',
    this.driverId,
    this.driver,
    this.attendantId,
    this.attendant,
    this.stops = const [],
    this.pickupStart = '',
    this.dropStart = '',
    this.status = 'Active',
    this.studentCount = 0,
    this.note = '',
  });
  final String id, number, regNo, model, routeName, pickupStart, dropStart, status, note;
  final int capacity, studentCount;
  final String? driverId, driver, attendantId, attendant;
  final List<BusStop> stops;

  String get label => 'Bus $number';
  BusStop? stop(String? id) => id == null ? null : stops.where((s) => s.id == id).firstOrNull;

  factory Bus.fromJson(Map<String, dynamic> j, {String? id}) => Bus(
    id: id ?? '${j['id'] ?? ''}',
    number: '${j['number'] ?? ''}',
    regNo: '${j['regNo'] ?? ''}',
    capacity: (j['capacity'] as num?)?.toInt() ?? 0,
    model: '${j['model'] ?? ''}',
    routeName: '${j['routeName'] ?? ''}',
    driverId: _opt(j['driverId']),
    driver: _opt(j['driver']),
    attendantId: _opt(j['attendantId']),
    attendant: _opt(j['attendant']),
    stops: [for (final s in (j['stops'] as List? ?? const [])) if (s is Map) BusStop.fromJson(Map<String, dynamic>.from(s))],
    pickupStart: '${j['pickupStart'] ?? ''}',
    dropStart: '${j['dropStart'] ?? ''}',
    status: '${j['status'] ?? 'Active'}',
    studentCount: (j['studentCount'] as num?)?.toInt() ?? 0,
    note: '${j['note'] ?? ''}',
  );

  Map<String, dynamic> toJson() => {
    'id': id, 'number': number, 'regNo': regNo, 'capacity': capacity, 'model': model, 'routeName': routeName,
    if (driverId != null) 'driverId': driverId, if (driver != null) 'driver': driver,
    if (attendantId != null) 'attendantId': attendantId, if (attendant != null) 'attendant': attendant,
    'stops': [for (final s in stops) s.toJson()], 'pickupStart': pickupStart, 'dropStart': dropStart,
    'status': status, 'studentCount': studentCount, 'note': note,
  };

  @override
  List<Object?> get props => [id, number, regNo, capacity, model, routeName, driverId, driver, attendantId, attendant, stops, pickupStart, dropStart, status, studentCount, note];
}

/// What the signed-in crew member sees on Home: themselves, their bus and the other crew member of that bus.
class CrewContext extends Equatable {
  const CrewContext({required this.me, this.bus, this.partner, this.schoolName = ''});
  final CrewMember me;
  final Bus? bus;
  final CrewMember? partner;
  final String schoolName;

  @override
  List<Object?> get props => [me, bus, partner, schoolName];
}
