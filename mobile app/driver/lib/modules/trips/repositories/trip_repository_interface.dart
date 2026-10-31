import '../models/trip_models.dart';

abstract class ITripRepository {
  /// Cache-first: the bus's pickup and drop trips of [date] (YYYY-MM-DD). Creates the two `scheduled` docs
  /// for today when they do not exist yet (contract 14.3).
  Stream<List<Trip>> watchDay(String busId, String date);

  /// Cache-first: past trips of the bus, newest first.
  Stream<List<Trip>> watchHistory(String busId);

  Future<void> saveChecklist(Trip trip, Checklist checklist);
  Future<void> startTrip(Trip trip, {int? odometer});
  Future<void> endTrip(Trip trip, {int? odometer, String note = ''});
  Future<void> setCurrentStop(Trip trip, String? stopId);
}
