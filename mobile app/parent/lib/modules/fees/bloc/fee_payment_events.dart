import 'package:equatable/equatable.dart';
import '../models/fee_models.dart';

sealed class FeePaymentEvent extends Equatable {
  const FeePaymentEvent();
  @override
  List<Object?> get props => [];
}

/// Pay the full balance of [invoiceIds] for [childId] with [method].
class FeePaymentSubmitted extends FeePaymentEvent {
  const FeePaymentSubmitted({
    required this.childId,
    required this.invoiceIds,
    required this.method,
  });
  final String childId;
  final List<String> invoiceIds;
  final PaymentMethod method;
  @override
  List<Object?> get props => [childId, invoiceIds, method];
}

/// Save the PDF of [receipt] on the device.
class ReceiptDownloadRequested extends FeePaymentEvent {
  const ReceiptDownloadRequested(this.receipt);
  final FeeReceipt receipt;
  @override
  List<Object?> get props => [receipt];
}
