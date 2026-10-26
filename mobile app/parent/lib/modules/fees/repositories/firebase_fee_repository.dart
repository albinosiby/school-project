import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../models/fee_models.dart';
import 'fee_repository_interface.dart';

/// The child's `fee_invoices` and `fee_payments` (matched on `grn`, §13.2). `paid` is kept current by the admin's fee counter.
class FirebaseFeeRepository implements IFeeRepository {
  FirebaseFeeRepository(this._session);
  final ParentSession _session;

  @override
  Stream<FeesData> watchFees(String childId) async* {
    final grn = await _session.grnOf(childId);
    if (grn.isEmpty) {
      yield const FeesData([]);
      return;
    }
    final invoices = _session.col('fee_invoices').where('grn', isEqualTo: grn).snapshots();
    final payments = _session.col('fee_payments').where('grn', isEqualTo: grn).snapshots();
    yield* combineLatest<QuerySnapshot<Json>>([invoices, payments]).map((both) {
      final list = [for (final d in both[0].docs) fromDoc(d.id, d.data())]..sort((a, b) => b.due.compareTo(a.due));
      final receipts = [for (final d in both[1].docs) receiptOf(d.id, d.data())]..sort((a, b) => b.date.compareTo(a.date));
      return FeesData(list, receipts: receipts);
    });
  }

  /// Online payment needs a payment gateway; the school collects fees at the office for now.
  @override
  Future<FeeReceipt> pay({required String childId, required List<String> invoiceIds, required PaymentMethod method}) async =>
      throw AppException(message: 'Online payment is not available yet. Please pay at the school office; the receipt appears here.');

  /// Receipt PDFs are not generated yet: returns the receipt's file name so the screen can confirm.
  @override
  Future<String> downloadReceipt(FeeReceipt receipt) async => receipt.fileName;

  static FeeReceipt receiptOf(String id, Json d) {
    final mode = '${d['mode'] ?? ''}'.toLowerCase();
    return FeeReceipt(
      id: id,
      number: '${d['receiptNo'] ?? id}',
      date: parseDay(d['date']) ?? DateTime.now(),
      method: mode.contains('card') ? PaymentMethod.card : mode.contains('net') || mode.contains('bank') ? PaymentMethod.netBanking : PaymentMethod.upi,
      lines: [FeeItem('${d['invoiceNo'] ?? 'Fees'}${'${d['mode'] ?? ''}'.isEmpty ? '' : ' · ${d['mode']}'}', (d['amount'] as num?)?.toDouble() ?? 0)],
      reference: '${d['invoiceNo'] ?? ''}'.isEmpty ? null : '${d['invoiceNo']}',
    );
  }

  static Invoice fromDoc(String id, Json d) {
    final lines = [
      for (final l in (d['lines'] as List?) ?? const [])
        if (l is Map) FeeItem('${l['label'] ?? ''}', (l['amount'] as num?)?.toDouble() ?? 0),
    ];
    final amount = (d['amount'] as num?)?.toDouble() ?? 0;
    final issued = parseDay(d['issued']) ?? DateTime.now();
    return Invoice(
      id: id,
      title: [d['term'], 'Fees'].where((e) => e != null && '$e'.isNotEmpty).join(' '),
      issued: issued,
      due: parseDay(d['due']) ?? issued,
      items: lines.isEmpty ? [FeeItem('School fees', amount)] : lines,
      paid: (d['paid'] as num?)?.toDouble() ?? 0,
    );
  }
}
