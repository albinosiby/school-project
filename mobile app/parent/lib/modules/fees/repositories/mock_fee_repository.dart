import 'dart:async';
import '../../../di/demo_data.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/fee_models.dart';
import 'fee_repository_interface.dart';
import 'fees_demo_data.dart';

/// In-memory fees: demo invoices plus payments made in this session (simulated gateway).
class MockFeeRepository implements IFeeRepository {
  MockFeeRepository(this._cache);
  final CacheService _cache;

  /// childId -> invoiceId -> amount paid in this session.
  final Map<String, Map<String, double>> _paid = {};
  final Map<String, List<FeeReceipt>> _receipts = {};
  final Map<String, List<PaymentClaim>> _claims = {};
  final _changes = StreamController<void>.broadcast();
  int _seq = 0;

  FeesData _build(String childId) {
    final base = DemoData.fees(childId);
    final extra = _paid[childId] ?? const {};
    final invoices = [
      for (final i in base.invoices)
        extra.containsKey(i.id) ? i.withPaid(i.paid + extra[i.id]!) : i,
    ];
    final receipts = [...?_receipts[childId], ...demoReceipts(base)]
      ..sort((a, b) => b.date.compareTo(a.date));
    return FeesData(invoices, receipts: receipts, claims: [...?_claims[childId]]);
  }

  @override
  Stream<FeesData> watchFees(String childId) => cacheFirst(
    cache: _cache,
    key: 'fee:$childId',
    fetch: () async {
      await MockLatency.wait();
      return _build(childId);
    },
    refetch: () async => _build(childId),
    refreshOn: _changes.stream,
  );

  @override
  Future<FeeReceipt> pay({
    required String childId,
    required List<String> invoiceIds,
    required PaymentMethod method,
  }) async {
    await MockLatency.wait();
    final payable = _build(childId).invoices
        .where((i) => invoiceIds.contains(i.id) && i.balance > 0)
        .toList();
    if (payable.isEmpty) {
      throw AppException(message: 'Select at least one instalment to pay.');
    }
    final now = DateTime.now();
    _seq++;
    final receipt = FeeReceipt(
      id: 'rcpt_${childId}_${now.microsecondsSinceEpoch}',
      number: 'GIS-${now.year}-${(5200 + _seq).toString()}',
      date: now,
      method: method,
      reference: 'TXN${now.millisecondsSinceEpoch % 100000000}',
      lines: [for (final i in payable) FeeItem(i.title, i.balance)],
    );
    final paid = _paid[childId] ??= {};
    for (final i in payable) {
      paid[i.id] = (paid[i.id] ?? 0) + i.balance;
    }
    (_receipts[childId] ??= []).insert(0, receipt);
    _changes.add(null);
    return receipt;
  }

  /// Kept for the bank-transfer flow; the demo has no school account ([FeesData.bank] is null), so it pays online.
  @override
  Future<PaymentClaim> reportPayment({
    required String childId,
    required String invoiceId,
    required double amount,
    required TransferMode mode,
    required String reference,
    required DateTime paidOn,
    String note = '',
  }) async {
    await MockLatency.wait();
    final invoice = _build(childId).invoices.where((i) => i.id == invoiceId).firstOrNull;
    if (invoice == null || amount <= 0 || reference.trim().isEmpty) {
      throw AppException(message: 'Enter the instalment, amount and reference.');
    }
    final claim = PaymentClaim(
      id: 'clm_${childId}_${++_seq}',
      invoiceId: invoiceId,
      invoiceTitle: invoice.title,
      amount: amount,
      mode: mode,
      reference: reference.trim(),
      paidOn: paidOn,
      submittedAt: DateTime.now(),
      note: note.trim().isEmpty ? null : note.trim(),
    );
    (_claims[childId] ??= []).insert(0, claim);
    _changes.add(null);
    return claim;
  }

  @override
  Future<String> downloadReceipt(FeeReceipt receipt) async {
    await MockLatency.wait();
    return receipt.fileName;
  }
}
