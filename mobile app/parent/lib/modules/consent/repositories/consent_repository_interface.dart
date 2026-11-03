import '../models/consent_models.dart';

abstract class IConsentRepository {
  /// The signed-in guardian's consent, or null when none was recorded yet (cache-first, live).
  Stream<ConsentRecord?> watch();

  /// Records (or updates) consent with the optional items; data processing is always given.
  Future<void> save({required bool photos, required bool notifications});

  /// Withdraws consent (the school sees it in the admin web and the audit log).
  Future<void> withdraw();
}
