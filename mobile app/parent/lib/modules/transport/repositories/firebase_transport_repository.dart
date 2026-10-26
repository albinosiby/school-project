import '../../../utils/exceptions/app_exception.dart';
import '../models/transport_models.dart';
import 'transport_repository_interface.dart';

/// No GPS feed or gate scanner is connected to the school system yet: Track Live explains that, Home shows no bus card.
class FirebaseTransportRepository implements ITransportRepository {
  @override
  Stream<BusTrip> watchTrip(String childId) =>
      Stream.error(AppException(message: 'Live bus tracking is not set up for this school yet.'));

  @override
  Future<void> pollPosition(String childId) async {}

  @override
  Future<void> setAlert(String childId, BusAlert alert, bool enabled) async {}

  @override
  Future<GateEntry?> gateEntryOn(String childId, DateTime day) async => null;
}
