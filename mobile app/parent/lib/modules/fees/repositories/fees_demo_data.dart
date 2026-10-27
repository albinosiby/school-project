import '../models/fee_models.dart';

/// Demo receipts for the instalments already paid in `DemoData.fees` (paid a few days before the due
/// date by UPI). Numbers are stable per invoice so the history looks the same after every refresh.
List<FeeReceipt> demoReceipts(FeesData base) => [
  for (final (i, inv) in base.invoices.indexed)
    if (inv.paid > 0)
      FeeReceipt(
        id: 'rcpt_${inv.id}',
        number: 'GIS-${inv.issued.year}-${(4100 + i * 37).toString()}',
        date: inv.due.subtract(const Duration(days: 3)),
        method: PaymentMethod.upi,
        reference: 'UPI${(inv.paid * 7).toStringAsFixed(0)}${i}23',
        lines: [FeeItem(inv.title, inv.paid)],
      ),
];
