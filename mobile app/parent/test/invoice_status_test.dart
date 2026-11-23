import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/modules/fees/models/fee_models.dart';
import 'package:parent_app/modules/fees/repositories/firebase_fee_repository.dart';

void main() {
  final now = DateTime(2026, 11, 17);
  final data = <String, dynamic>{
    'amount': 1000,
    'paid': 200,
    'due': '2026-07-01',
    'statusOverride': {
      'status': 'Pending',
      'amount': 1000,
      'paid': 200,
      'due': '2026-07-01',
    },
  };
  test('a reviewed manual label appears without changing money', () {
    final invoice = FirebaseFeeRepository.fromDoc('invoice', data);
    expect(invoice.statusAt(now), InvoiceStatus.due);
    expect(invoice.balance, 800);
  });
  test('a payment or due date change invalidates the manual label', () {
    final paid = FirebaseFeeRepository.fromDoc('invoice', {
      ...data,
      'paid': 300,
    });
    expect(paid.statusAt(now), InvoiceStatus.overdue);
    final changed = FirebaseFeeRepository.fromDoc('invoice', {
      ...data,
      'due': '2026-08-01',
    });
    expect(changed.statusAt(now), InvoiceStatus.overdue);
    final invoice = FirebaseFeeRepository.fromDoc('invoice', data);
    expect(invoice.withPaid(400).statusAt(now), InvoiceStatus.overdue);
    expect(invoice.withPaid(1000).statusAt(now), InvoiceStatus.paid);
  });
  test('a paid invoice stays Paid even if old override data remains', () {
    final invoice = FirebaseFeeRepository.fromDoc('invoice', {
      ...data,
      'paid': 1000,
    });
    expect(invoice.statusAt(now), InvoiceStatus.paid);
  });
  test('a manual Overdue label also applies before the recorded due date', () {
    final invoice = FirebaseFeeRepository.fromDoc('invoice', {
      ...data,
      'due': '2099-01-01',
      'statusOverride': {
        'status': 'Overdue',
        'amount': 1000,
        'paid': 200,
        'due': '2099-01-01',
      },
    });
    expect(invoice.statusAt(now), InvoiceStatus.overdue);
    expect(invoice.balance, 800);
  });
}
