import '../models/family_models.dart';

abstract class IFamilyRepository {
  /// Guardian and linked children (cache-first).
  Stream<Family> watchFamily();
}
