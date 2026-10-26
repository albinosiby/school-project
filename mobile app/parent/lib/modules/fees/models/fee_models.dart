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

class FeesData extends Equatable {
  const FeesData(this.invoices);
  final List<Invoice> invoices;

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
  List<Object?> get props => [invoices];
}
