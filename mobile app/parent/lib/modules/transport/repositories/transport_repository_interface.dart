import '../models/transport_models.dart';

abstract class ITransportRepository {
  /// Cache-first stream of the child's bus trip; keeps emitting as the live position updates.
  Stream<BusTrip> watchTrip(String childId);

  /// Asks for a fresh GPS position; the new trip state arrives through [watchTrip].
  Future<void> pollPosition(String childId);

  /// Turns a "notify me" alert on or off (pushes the updated trip through [watchTrip]).
  Future<void> setAlert(String childId, BusAlert alert, bool enabled);

  /// The child's RFID gate tap on [day], if any.
  Future<GateEntry?> gateEntryOn(String childId, DateTime day);
}
