import '../../../utils/services/firebase/parent_session.dart';
import '../models/fee_models.dart';
import 'fee_repository_interface.dart';

/// The child's `fee_invoices` (matched on `grn`, §13.2). `paid` is kept current by the admin's fee counter.
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
    yield* _session.col('fee_invoices').where('grn', isEqualTo: grn).snapshots().map((q) {
      final list = [for (final d in q.docs) fromDoc(d.id, d.data())]..sort((a, b) => b.due.compareTo(a.due));
      return FeesData(list);
    });
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
