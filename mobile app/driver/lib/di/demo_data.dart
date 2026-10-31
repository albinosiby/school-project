import 'dart:async';
import '../modules/attendance/models/attendance_models.dart';
import '../modules/crew/models/crew_models.dart';
import '../modules/crew_attendance/models/crew_attendance_models.dart';
import '../modules/leave/models/leave_models.dart';
import '../modules/notices/models/notice_models.dart';
import '../modules/students/models/student_models.dart';
import '../modules/trips/models/trip_models.dart';
import '../utils/services/firebase/crew_session.dart' show isoDay;

/// In-memory school for the local backend (default build). Shapes follow data contract section 14; everything is
/// fictional and relative to "now" so the demo always has a live-looking day.
class DemoStore {
  DemoStore({DateTime? now}) : now = now ?? DateTime.now() {
    _seed();
  }
  final DateTime now;
  final _changes = StreamController<void>.broadcast();
  Stream<void> get changes => _changes.stream;
  void notify() => _changes.add(null);

  static const schoolName = 'Greenfield International School';
  static const password = 'shift123';
  static const driverEmail = 'rajesh.kumar@greenfield.edu';
  static const attendantEmail = 'sunita.devi@greenfield.edu';

  final crew = <String, CrewMember>{};
  final buses = <String, Bus>{};
  final students = <String, BusStudent>{};
  final trips = <String, Trip>{};
  final attendance = <String, TripAttendance>{};
  final crewDays = <String, CrewDay>{};
  final leaves = <String, CrewLeave>{};
  final notices = <Notice>[];
  String checkInBy = '06:30';

  String get today => isoDay(now);

  void _seed() {
    const stops = [
      BusStop(id: 'stp_01', name: 'Sector 14 Market', pickupTime: '06:45', dropTime: '15:40', landmark: 'Near Mother Dairy booth'),
      BusStop(id: 'stp_02', name: 'DLF Phase 1 Gate', pickupTime: '06:55', dropTime: '15:30', landmark: 'Main road pick'),
      BusStop(id: 'stp_03', name: 'Huda City Metro Gate 3', pickupTime: '07:05', dropTime: '15:20', landmark: 'Auto stand'),
      BusStop(id: 'stp_04', name: 'Sushant Lok Phase 1', pickupTime: '07:15', dropTime: '15:10', landmark: 'Park entrance'),
      BusStop(id: 'stp_05', name: 'Civil Lines Enclave', pickupTime: '07:25', dropTime: '15:00', landmark: 'Temple corner'),
      BusStop(id: 'stp_06', name: 'Leisure Valley', pickupTime: '07:35', dropTime: '14:50', landmark: 'Gate 2'),
    ];
    buses['bus_01'] = const Bus(
      id: 'bus_01', number: '14', regNo: 'DL-01-AB-4092', capacity: 42, model: '42-Seater AC Deluxe', routeName: 'Route 4B',
      driverId: 'crw_001', driver: 'Rajesh Kumar', attendantId: 'crw_002', attendant: 'Sunita Devi', stops: stops,
      pickupStart: '06:45', dropStart: '14:45', studentCount: 14,
    );
    crew['crw_001'] = const CrewMember(
      id: 'crw_001', name: 'Rajesh Kumar', role: CrewRole.driver, empId: 'TR-1004', phone: '+91 98765 43210', email: driverEmail,
      busId: 'bus_01', bus: 'Bus 14', licenseNo: 'DL-0420110149646', licenseExpiry: '2028-03-14', joined: '2018-04-02',
      address: 'H-42, Sector 21, Gurugram', emergencyName: 'Meena Kumar', emergencyPhone: '+91 98765 11111',
    );
    crew['crw_002'] = const CrewMember(
      id: 'crw_002', name: 'Sunita Devi', role: CrewRole.attendant, empId: 'TR-1009', phone: '+91 98765 22222', email: attendantEmail,
      busId: 'bus_01', bus: 'Bus 14', joined: '2021-07-12', address: 'B-7, Sector 9, Gurugram', emergencyName: 'Ramesh Devi', emergencyPhone: '+91 98765 33333',
    );
    crew['crw_003'] = const CrewMember(id: 'crw_003', name: 'Amit Verma', role: CrewRole.driver, empId: 'TR-1011', phone: '+91 98765 44444', email: 'amit.verma@greenfield.edu', busId: 'bus_02', bus: 'Bus 8');
    buses['bus_02'] = const Bus(id: 'bus_02', number: '8', regNo: 'DL-01-CD-1180', capacity: 36, routeName: 'Route 2A', driverId: 'crw_003', driver: 'Amit Verma', stops: [], studentCount: 0);

    const kids = <(String, String, String, String, int, String, String, String, String)>[
      ('stu_101', 'Aarav Sharma', '10', 'B', 18, 'Mr. Rahul Sharma', 'Father', '+91 98100 00001', 'stp_01'),
      ('stu_102', 'Ananya Patel', '10', 'B', 2, 'Mrs. Nisha Patel', 'Mother', '+91 98100 00002', 'stp_01'),
      ('stu_103', 'Rohan Verma', '10', 'B', 14, 'Mr. Sanjay Verma', 'Father', '+91 98100 00003', 'stp_02'),
      ('stu_104', 'Simran Kaur', '10', 'B', 4, 'Mr. Harpreet Singh', 'Father', '+91 98100 00004', 'stp_02'),
      ('stu_105', 'Meera Iyer', '10', 'A', 5, 'Mrs. Lakshmi Iyer', 'Mother', '+91 98100 00005', 'stp_03'),
      ('stu_106', 'Kabir Das', '9', 'A', 9, 'Mr. Alok Das', 'Father', '+91 98100 00006', 'stp_03'),
      ('stu_107', 'Ishita Roy', '9', 'A', 11, 'Mrs. Priya Roy', 'Mother', '+91 98100 00007', 'stp_03'),
      ('stu_108', 'Dev Malhotra', '8', 'C', 7, 'Mr. Vikram Malhotra', 'Father', '+91 98100 00008', 'stp_04'),
      ('stu_109', 'Zara Khan', '8', 'C', 21, 'Mrs. Farah Khan', 'Mother', '+91 98100 00009', 'stp_04'),
      ('stu_110', 'Arjun Nair', '8', 'A', 3, 'Mr. Suresh Nair', 'Father', '+91 98100 00010', 'stp_05'),
      ('stu_111', 'Tara Bose', '7', 'B', 15, 'Mrs. Rina Bose', 'Mother', '+91 98100 00011', 'stp_05'),
      ('stu_112', 'Vivaan Gupta', '7', 'B', 8, 'Mr. Manoj Gupta', 'Father', '+91 98100 00012', 'stp_06'),
      ('stu_113', 'Anika Mehta', '6', 'A', 12, 'Mrs. Pooja Mehta', 'Mother', '+91 98100 00013', 'stp_06'),
      ('stu_114', 'Yash Chauhan', '6', 'A', 19, 'Mr. Deepak Chauhan', 'Father', '+91 98100 00014', 'stp_06'),
    ];
    final bus = buses['bus_01']!;
    for (final k in kids) {
      students[k.$1] = BusStudent(
        id: k.$1, name: k.$2, grade: k.$3, section: k.$4, classId: 'cls_${k.$3}${k.$4}', roll: k.$5, grn: 'GIS-9${k.$1.substring(4)}',
        guardian: k.$6, relation: k.$7, phone: k.$8, busId: 'bus_01', busStopId: k.$9, busStop: bus.stop(k.$9)!.name,
        medicalNote: k.$1 == 'stu_101' ? 'Peanut allergy (EpiPen in front pouch)' : '',
      );
    }

    // history: the last 10 school days, both trips completed with a few absences
    for (var d = 1; d <= 12; d++) {
      final day = now.subtract(Duration(days: d));
      if (day.weekday == DateTime.sunday) continue;
      for (final kind in TripKind.values) {
        final start = DateTime(day.year, day.month, day.day, kind == TripKind.pickup ? 6 : 14, kind == TripKind.pickup ? 44 : 48);
        final marks = <String, Mark>{};
        var i = 0;
        for (final s in students.values) {
          i++;
          final absent = (d + i) % 7 == 0;
          marks[s.id] = Mark(
            status: absent ? MarkStatus.absent : MarkStatus.dropped,
            at: start.add(Duration(minutes: 4 + i * 3)), by: 'crw_002', byName: 'Sunita Devi', stopId: s.busStopId,
          );
        }
        final id = Trip.idFor(isoDay(day), 'bus_01', kind);
        final att = TripAttendance(tripId: id, busId: 'bus_01', bus: 'Bus 14', date: isoDay(day), kind: kind, total: students.length, marks: marks);
        attendance[id] = att;
        trips[id] = Trip(
          id: id, busId: 'bus_01', bus: 'Bus 14', routeName: 'Route 4B', date: isoDay(day), kind: kind, status: TripStatus.completed,
          driverId: 'crw_001', driver: 'Rajesh Kumar', attendantId: 'crw_002', attendant: 'Sunita Devi', total: students.length,
          dropped: att.dropped, absent: att.absent, startedAt: start, startedBy: 'crw_001', endedAt: start.add(const Duration(minutes: 58)),
          endedBy: 'crw_001', checklist: const Checklist(brakes: true, lights: true, tyres: true, fuel: true, firstAid: true, cleanliness: true),
          checklistAt: start.subtract(const Duration(minutes: 20)), odometerStart: 48210 + d * 40, odometerEnd: 48230 + d * 40,
        );
      }
    }
    ensureDay('bus_01', today);

    for (final c in ['crw_001', 'crw_002']) {
      for (var d = 1; d <= 20; d++) {
        final day = now.subtract(Duration(days: d));
        if (day.weekday == DateTime.sunday) continue;
        final late = d % 6 == 0;
        crewDays[CrewDay.idFor(isoDay(day), c)] = CrewDay(
          crewId: c, name: crew[c]!.name, role: crew[c]!.role.code, busId: 'bus_01', date: isoDay(day),
          inTime: late ? '06:41' : '06:1${d % 10}', outTime: '16:0${d % 10}', status: d == 9 ? 'Leave' : late ? 'Late' : 'Present',
        );
      }
    }
    leaves['lv_crw_001_1'] = CrewLeave(
      id: 'lv_crw_001_1', crewId: 'crw_001', name: 'Rajesh Kumar', role: 'driver', busId: 'bus_01', type: 'Casual',
      from: isoDay(now.subtract(const Duration(days: 9))), to: isoDay(now.subtract(const Duration(days: 9))), reason: 'Family function',
      status: 'Approved', appliedAt: now.subtract(const Duration(days: 14)), decidedBy: 'admin', decidedAt: now.subtract(const Duration(days: 12)),
    );
    leaves['lv_crw_002_1'] = CrewLeave(
      id: 'lv_crw_002_1', crewId: 'crw_002', name: 'Sunita Devi', role: 'attendant', busId: 'bus_01', type: 'Sick',
      from: isoDay(now.subtract(const Duration(days: 9))), to: isoDay(now.subtract(const Duration(days: 9))), reason: 'Fever',
      status: 'Approved', appliedAt: now.subtract(const Duration(days: 10)), decidedBy: 'admin', decidedAt: now.subtract(const Duration(days: 10)),
    );
    notices.addAll([
      Notice(id: 'ntc_1', title: 'Fog timings: pickup moves 20 minutes later from Monday', category: 'Transport', audience: 'Transport Routes',
          author: 'Transport Office', sentAt: now.subtract(const Duration(hours: 5)), urgent: true, pinned: true,
          body: 'Because of the morning fog advisory, every route starts 20 minutes later from Monday until further notice. Inform parents at the stops today.'),
      Notice(id: 'ntc_2', title: 'Bus 14 due for service on Saturday', category: 'Vehicle', audience: 'All Parents & Bus Drivers',
          author: 'Fleet Manager', sentAt: now.subtract(const Duration(days: 1)), body: 'Bus 14 goes to the workshop on Saturday. Bus 8 covers Route 4B for the afternoon drop.'),
      Notice(id: 'ntc_3', title: 'Diwali break: school closed 29 Oct – 3 Nov', category: 'Holidays', audience: 'All School',
          author: 'Principal', sentAt: now.subtract(const Duration(days: 3)), body: 'School reopens on 4 November. No trips run during the break.'),
      Notice(id: 'ntc_4', title: 'Exam marks window', category: 'Exams', audience: 'Teachers',
          author: 'Exam cell', sentAt: now.subtract(const Duration(days: 4)), body: 'Teachers only.'),
    ]);
  }

  /// Today's two trips (contract 14.3).
  void ensureDay(String busId, String date) {
    final bus = buses[busId];
    if (bus == null) return;
    final total = students.values.where((s) => s.busId == busId).length;
    for (final kind in TripKind.values) {
      final id = Trip.idFor(date, busId, kind);
      trips.putIfAbsent(id, () => Trip(
        id: id, busId: busId, bus: bus.label, routeName: bus.routeName, date: date, kind: kind, total: total,
        driverId: bus.driverId ?? '', driver: bus.driver ?? '', attendantId: bus.attendantId ?? '', attendant: bus.attendant ?? '',
      ));
    }
  }
}
