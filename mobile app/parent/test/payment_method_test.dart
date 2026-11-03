import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/modules/fees/models/fee_models.dart';
import 'package:parent_app/modules/fees/repositories/firebase_fee_repository.dart';

/// Receipts from fee_payments.mode as the admin web writes it ("{mode} · {REF}", contract 13.8).
void main() {
  test('each office payment mode maps to its own receipt method', () {
    expect(PaymentMethod.fromMode('UPI · UTR998877'), PaymentMethod.upi);
    expect(PaymentMethod.fromMode('Cheque · 123456'), PaymentMethod.cheque);
    expect(PaymentMethod.fromMode('Cash deposit at bank · SLIP42'), PaymentMethod.cash);
    expect(PaymentMethod.fromMode('Cash'), PaymentMethod.cash);
    expect(PaymentMethod.fromMode('NEFT / IMPS / RTGS · HDFC0001'), PaymentMethod.netBanking);
    expect(PaymentMethod.fromMode('Card · 4242'), PaymentMethod.card);
    expect(PaymentMethod.fromMode('UPI · ADD77DD'), PaymentMethod.upi, reason: 'a reference never changes the method');
  });

  test('a cheque receipt is labelled Cheque, not UPI', () {
    final r = FirebaseFeeRepository.receiptOf('pay_1', {'receiptNo': 'R-1', 'date': '2026-11-02', 'mode': 'Cheque · 004512', 'amount': 5000, 'invoiceNo': 'INV-9'});
    expect(r.method, PaymentMethod.cheque);
    expect(r.method.label, 'Cheque');
  });

  test('parents still pick only online methods', () {
    expect(PaymentMethod.online, [PaymentMethod.upi, PaymentMethod.card, PaymentMethod.netBanking]);
  });
}
