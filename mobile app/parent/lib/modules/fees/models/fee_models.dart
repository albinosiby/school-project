import 'package:equatable/equatable.dart';

enum InvoiceStatus { paid, partial, due, overdue }

extension InvoiceStatusX on InvoiceStatus {
  String get label => switch (this) {
    InvoiceStatus.paid => 'Paid',
    InvoiceStatus.partial => 'Part paid',
    InvoiceStatus.due => 'Due',
    InvoiceStatus.overdue => 'Overdue',
  };
}

class FeeItem extends Equatable {
  const FeeItem(this.label, this.amount);
  final String label;
  final double amount;
  @override
  List<Object?> get props => [label, amount];
}

class Invoice extends Equatable {
  const Invoice({
    required this.id,
    required this.title,
    required this.issued,
    required this.due,
    required this.items,
    this.paid = 0,
  });
  final String id, title;
  final DateTime issued, due;
  final List<FeeItem> items;
  final double paid;

  double get amount => items.fold(0, (a, i) => a + i.amount);
  double get balance => amount - paid;

  Invoice withPaid(double paid) => Invoice(
    id: id,
    title: title,
    issued: issued,
    due: due,
    items: items,
    paid: paid,
  );

  InvoiceStatus statusAt(DateTime now) {
    if (balance <= 0) return InvoiceStatus.paid;
    final overdue = DateTime(
      due.year,
      due.month,
      due.day,
    ).isBefore(DateTime(now.year, now.month, now.day));
    if (overdue) return InvoiceStatus.overdue;
    return paid > 0 ? InvoiceStatus.partial : InvoiceStatus.due;
  }

  @override
  List<Object?> get props => [id, title, issued, due, items, paid];
}

enum PaymentMethod { upi, card, netBanking }

extension PaymentMethodX on PaymentMethod {
  String get label => switch (this) {
    PaymentMethod.upi => 'UPI',
    PaymentMethod.card => 'Debit / Credit card',
    PaymentMethod.netBanking => 'Net banking',
  };
  String get hint => switch (this) {
    PaymentMethod.upi => 'Google Pay, PhonePe, Paytm, BHIM',
    PaymentMethod.card => 'Visa, Mastercard, RuPay',
    PaymentMethod.netBanking => 'All major Indian banks',
  };
}

/// Proof of one payment (one or more instalments paid together).
class FeeReceipt extends Equatable {
  const FeeReceipt({
    required this.id,
    required this.number,
    required this.date,
    required this.method,
    required this.lines,
    this.reference,
  });
  final String id, number;
  final DateTime date;
  final PaymentMethod method;

  /// What was paid: one line per instalment (title, amount).
  final List<FeeItem> lines;

  /// Gateway / UTR reference (simulated).
  final String? reference;

  double get amount => lines.fold(0, (a, l) => a + l.amount);
  String get fileName => 'Receipt_$number.pdf';

  @override
  List<Object?> get props => [id, number, date, method, lines, reference];
}

class FeesData extends Equatable {
  const FeesData(this.invoices, {this.receipts = const []});
  final List<Invoice> invoices;

  /// Payment receipts, newest first.
  final List<FeeReceipt> receipts;

  /// Instalments with something left to pay, earliest due first.
  List<Invoice> get unpaid =>
      invoices.where((i) => i.balance > 0).toList()
        ..sort((a, b) => a.due.compareTo(b.due));

  double get total => invoices.fold(0, (a, i) => a + i.amount);
  double get paid => invoices.fold(0, (a, i) => a + i.paid);
  double get balance => total - paid;

  /// Earliest due date among unpaid invoices.
  DateTime? get nextDue {
    final unpaid =
        invoices.where((i) => i.balance > 0).map((i) => i.due).toList()..sort();
    return unpaid.isEmpty ? null : unpaid.first;
  }

  @override
  List<Object?> get props => [invoices, receipts];
}
