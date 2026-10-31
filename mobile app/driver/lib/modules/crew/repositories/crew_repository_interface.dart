import '../models/crew_models.dart';

abstract class ICrewRepository {
  /// Cache-first: the signed-in crew member, their bus and the partner on that bus, updated live.
  Stream<CrewContext> watchContext();

  /// The fields a crew member may edit on their own `tr_crew` doc (contract 14.7).
  Future<void> updateProfile({String? phone, String? address, String? emergencyName, String? emergencyPhone});
}
