import '../models/fee_models.dart';

abstract class IFeeRepository {
  /// Cache-first: emits the cached value (if any), then the fresh value. Re-emits after a payment.
  Stream<FeesData> watchFees(String childId);

  /// Pays the full balance of [invoiceIds] with [method] and returns the receipt.
  /// Throws [AppException] when nothing payable is selected.
  Future<FeeReceipt> pay({
    required String childId,
    required List<String> invoiceIds,
    required PaymentMethod method,
  });

  /// Saves the receipt PDF on the device and returns the file name (simulated today).
  Future<String> downloadReceipt(FeeReceipt receipt);
}
