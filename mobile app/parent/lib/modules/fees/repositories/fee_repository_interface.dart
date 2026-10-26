import '../models/fee_models.dart';

abstract class IFeeRepository {
  /// Cache-first: emits the cached value (if any), then the fresh value.
  Stream<FeesData> watchFees(String childId);
}
