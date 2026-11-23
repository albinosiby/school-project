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
    this.manualStatus,
    this.billedAmount,
    this.studentId = '',
  });
  final String id, title;
  final DateTime issued, due;
  final List<FeeItem> items;
  final double paid;
  final InvoiceStatus? manualStatus;
  final double? billedAmount;
  final String studentId;

  double get amount => billedAmount ?? items.fold(0, (a, i) => a + i.amount);
  double get balance => amount - paid;

  Invoice withPaid(double paid) => Invoice(
    id: id,
    title: title,
    issued: issued,
    due: due,
    items: items,
    paid: paid,
    manualStatus: paid == this.paid ? manualStatus : null,
    billedAmount: billedAmount,
    studentId: studentId,
  );

  InvoiceStatus statusAt(DateTime now) {
    if (balance <= 0) return InvoiceStatus.paid;
    if (manualStatus == InvoiceStatus.due || manualStatus == InvoiceStatus.overdue) return manualStatus!;
    final overdue = DateTime(due.year, due.month, due.day).isBefore(DateTime(now.year, now.month, now.day));
    if (overdue) return InvoiceStatus.overdue;
    return paid > 0 ? InvoiceStatus.partial : InvoiceStatus.due;
  }

  @override
  List<Object?> get props => [id, title, issued, due, items, paid, manualStatus, billedAmount, studentId];
}

enum PaymentMethod {
  upi,
  card,
  netBanking,
  cheque,
  cash;

  /// What the parent can choose to pay with online (cheque and cash are paid at the bank / office and only appear on receipts).
  static const online = [upi, card, netBanking];

  /// The method of a `fee_payments.mode` string ("UPI · UTR…", "Cheque · 123456", "Cash", "NEFT / IMPS / RTGS · …").
  static PaymentMethod fromMode(String mode) {
    final m = mode.toLowerCase();
    if (m.contains('cheque') || m.contains('check')) return cheque;
    if (m.contains('cash')) return cash;
    if (m.contains('card')) return card;
    if (m.contains('net') || m.contains('bank') || m.contains('neft') || m.contains('imps') || m.contains('rtgs')) return netBanking;
    return upi;
  }
}

extension PaymentMethodX on PaymentMethod {
  String get label => switch (this) {
    PaymentMethod.upi => 'UPI',
    PaymentMethod.card => 'Debit / Credit card',
    PaymentMethod.netBanking => 'Net banking',
    PaymentMethod.cheque => 'Cheque',
    PaymentMethod.cash => 'Cash',
  };
  String get hint => switch (this) {
    PaymentMethod.upi => 'Google Pay, PhonePe, Paytm, BHIM',
    PaymentMethod.card => 'Visa, Mastercard, RuPay',
    PaymentMethod.netBanking => 'All major Indian banks',
    PaymentMethod.cheque => 'Deposited at the bank or the school office',
    PaymentMethod.cash => 'Paid at the school office or bank counter',
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
    this.studentId = '',
  });
  final String id, number, studentId;
  final DateTime date;
  final PaymentMethod method;

  /// What was paid: one line per instalment (title, amount).
  final List<FeeItem> lines;

  /// Gateway / UTR reference (simulated).
  final String? reference;

  double get amount => lines.fold(0, (a, l) => a + l.amount);
  String get fileName => 'Receipt_$number.pdf';

  @override
  List<Object?> get props => [id, number, date, method, lines, reference, studentId];
}

class FeesData extends Equatable {
  const FeesData(this.invoices, {this.receipts = const [], this.claims = const [], this.bank, this.annual});
  final List<Invoice> invoices;
  final AnnualFees? annual;

  /// Payment receipts, newest first.
  final List<FeeReceipt> receipts;

  /// Payments the parent reported (bank transfer / UPI to the school account), newest first.
  final List<PaymentClaim> claims;

  /// The school account to pay into. When set, Pay Now means "pay to this account and report it"
  /// (the office verifies and issues the receipt); when null, the online payment flow is used.
  final BankDetails? bank;

  /// Reported payments the office has not verified yet.
  List<PaymentClaim> get pendingClaims => claims.where((c) => c.status == ClaimStatus.pending).toList();

  /// Instalments with something left to pay, earliest due first.
  List<Invoice> get unpaid => invoices.where((i) => i.balance > 0).toList()..sort((a, b) => a.due.compareTo(b.due));

  double get total => annual?.complete == true ? annual!.net : invoices.fold(0, (a, i) => a + i.amount);
  double get paid => annual?.complete == true ? annual!.paid : invoices.fold(0, (a, i) => a + i.paid);
  double get balance => (annual?.complete == true ? annual!.payable : total - paid).clamp(0, double.infinity);

  /// Earliest due date among unpaid invoices.
  DateTime? get nextDue {
    final unpaid = invoices.where((i) => i.balance > 0).map((i) => i.due).toList()..sort();
    return unpaid.isEmpty ? null : unpaid.first;
  }

  @override
  List<Object?> get props => [invoices, receipts, claims, bank, annual];
}

/// The school's account parents pay fees into (`school/school.bank`, data contract §13.8).
class BankDetails extends Equatable {
  const BankDetails({
    this.accountName = '',
    this.accountNo = '',
    this.ifsc = '',
    this.bank = '',
    this.branch = '',
    this.upiId = '',
    this.note = '',
  });
  final String accountName, accountNo, ifsc, bank, branch, upiId, note;

  bool get hasAccount => accountNo.isNotEmpty && ifsc.isNotEmpty;
  bool get isEmpty => !hasAccount && upiId.isEmpty;

  @override
  List<Object?> get props => [accountName, accountNo, ifsc, bank, branch, upiId, note];
}

/// How the parent paid into the school account.
enum TransferMode {
  upi('UPI'),
  bankTransfer('NEFT / IMPS / RTGS'),
  cheque('Cheque'),
  cashDeposit('Cash deposit at bank');

  const TransferMode(this.label);
  final String label;

  /// What the reference number is called for this mode.
  String get referenceLabel => switch (this) {
    TransferMode.upi => 'UPI transaction ID (UTR)',
    TransferMode.bankTransfer => 'UTR / transaction reference',
    TransferMode.cheque => 'Cheque number',
    TransferMode.cashDeposit => 'Deposit slip number',
  };
}

enum ClaimStatus {
  pending('Pending verification'),
  verified('Verified'),
  rejected('Not verified');

  const ClaimStatus(this.label);
  final String label;
}

/// A payment the parent made to the school account and reported in the app (`fee_claims`).
/// The office checks it against the bank statement: verified -> a receipt is issued; rejected -> [reason].
class PaymentClaim extends Equatable {
  const PaymentClaim({
    required this.id,
    required this.invoiceId,
    required this.invoiceTitle,
    required this.amount,
    required this.mode,
    required this.reference,
    required this.paidOn,
    required this.submittedAt,
    this.status = ClaimStatus.pending,
    this.note,
    this.reason,
    this.receiptNo,
  });
  final String id, invoiceId, invoiceTitle, reference;
  final double amount;
  final TransferMode mode;
  final DateTime paidOn, submittedAt;
  final ClaimStatus status;
  final String? note, reason, receiptNo;

  @override
  List<Object?> get props => [id, invoiceId, invoiceTitle, amount, mode, reference, paidOn, submittedAt, status, note, reason, receiptNo];
}

class AnnualFeeCharge extends Equatable {
  const AnnualFeeCharge({required this.name, required this.amount, required this.quantity, required this.frequency});
  final String name, frequency;
  final double amount;
  final int quantity;
  @override
  List<Object?> get props => [name, frequency, amount, quantity];
}

class AnnualFees extends Equatable {
  const AnnualFees({
    required this.academicYear,
    required this.complete,
    required this.gross,
    required this.concessions,
    required this.net,
    required this.paid,
    required this.payable,
    this.charges = const [],
    this.issues = const [],
  });
  final String academicYear;
  final bool complete;
  final double gross, concessions, net, paid, payable;
  final List<AnnualFeeCharge> charges;
  final List<String> issues;
  factory AnnualFees.fromJson(Map<String, dynamic> value) {
    double n(String key) => (value[key] as num?)?.toDouble() ?? 0;
    return AnnualFees(
      academicYear: '${value['academicYear'] ?? ''}',
      complete: value['complete'] == true,
      gross: n('gross'),
      concessions: n('concessions'),
      net: n('net'),
      paid: n('paid'),
      payable: n('payable'),
      issues: [for (final item in value['issues'] as List? ?? const []) '$item'],
      charges: [
        for (final item in value['charges'] as List? ?? const [])
          if (item is Map && item['mandatory'] != false)
            AnnualFeeCharge(
              name: '${item['name']}',
              amount: (item['amount'] as num).toDouble(),
              quantity: (item['quantity'] as num).toInt(),
              frequency: '${item['frequency']}',
            ),
      ],
    );
  }
  @override
  List<Object?> get props => [academicYear, complete, gross, concessions, net, paid, payable, charges, issues];
}
