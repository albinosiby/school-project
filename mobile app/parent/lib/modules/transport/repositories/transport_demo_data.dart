import '../../../di/demo_data.dart';
import '../../../utils/helpers/date_helper.dart';
import '../models/transport_models.dart';

/// Demo bus data: both children ride Bus #14 (Route 4B) home in the afternoon.
class TransportDemoData {
  TransportDemoData._();

  static const busNo = '14';
  static const route = '4B';
  static const vehicleNo = 'DL-01-AB-4092';
  static const safety = '4-Cam CCTV';

  /// Minutes since departure when the app starts: the bus is between stops, 12 mins from the drop.
  static const startElapsedMinutes = 30.0;

  static const driver = BusContact(
    name: 'Mr. Rajesh Kumar',
    role: 'Driver',
    phone: '+91 98100 44092',
    rating: 4.9,
  );
  static const attendant = BusContact(
    name: 'Ms. Sunita Devi',
    role: 'Bus attendant',
    phone: '+91 98100 27731',
  );

  static const stops = [
    BusStop(
      id: 'st_campus',
      name: 'Greenfield Campus',
      offsetMinutes: 0,
      km: 0,
      mapX: .11,
      mapY: .18,
    ),
    BusStop(
      id: 'st_moti',
      name: 'Moti Bagh Crossing',
      offsetMinutes: 10,
      km: 2.6,
      mapX: .37,
      mapY: .25,
    ),
    BusStop(
      id: 'st_s9',
      name: 'Sector 9 Crossing',
      offsetMinutes: 22,
      km: 5.1,
      mapX: .52,
      mapY: .52,
    ),
    BusStop(
      id: 'st_s12',
      name: 'Sector 12 Market',
      offsetMinutes: 34,
      km: 7.6,
      mapX: .49,
      mapY: .71,
    ),
    BusStop(
      id: 'st_s14',
      name: 'Sector 14 Main Gate',
      offsetMinutes: 42,
      km: 9.1,
      mapX: .68,
      mapY: .71,
      isChildDrop: true,
    ),
    BusStop(
      id: 'st_s16',
      name: 'Sector 16 Terminus',
      offsetMinutes: 55,
      km: 11.5,
      mapX: .80,
      mapY: .92,
    ),
  ];

  static String seatOf(String childId) =>
      childId == DemoData.aarav.id ? '#14B' : '#09A';

  static const defaultAlerts = {
    BusAlert.proximity: true,
    BusAlert.arrival: true,
    BusAlert.delay: false,
  };

  /// Morning RFID taps: Aarav tapped in at 08:05 on school days; Ananya has no tap today.
  static GateEntry? gateEntry(String childId, DateTime day) {
    if (day.weekday > DateTime.friday) return null;
    if (childId != DemoData.aarav.id && sameDay(day, DateTime.now())) {
      return null;
    }
    return GateEntry(
      at: dateOnly(day).add(const Duration(hours: 8, minutes: 5)),
      gate: 'Gate 2 North',
    );
  }
}
