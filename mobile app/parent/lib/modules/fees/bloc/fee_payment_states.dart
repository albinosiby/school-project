import 'package:equatable/equatable.dart';
import '../models/fee_models.dart';

/// [reported]: payment details sent to the office for verification ([FeePaymentState.claim]).
enum PaymentStatus { idle, processing, success, reported, failure }

class FeePaymentState extends Equatable {
  const FeePaymentState({
    this.status = PaymentStatus.idle,
    this.receipt,
    this.claim,
    this.error,
    this.downloaded,
    this.downloadCount = 0,
  });
  final PaymentStatus status;

  /// Receipt of the last successful payment.
  final FeeReceipt? receipt;

  /// The last payment reported to the office.
  final PaymentClaim? claim;
  final String? error;

  /// File name of the last downloaded receipt; [downloadCount] changes on every download.
  final String? downloaded;
  final int downloadCount;

  bool get isProcessing => status == PaymentStatus.processing;

  FeePaymentState copyWith({
    PaymentStatus? status,
    FeeReceipt? receipt,
    PaymentClaim? claim,
    String? error,
    String? downloaded,
    int? downloadCount,
  }) => FeePaymentState(
    status: status ?? this.status,
    receipt: receipt ?? this.receipt,
    claim: claim ?? this.claim,
    error: error,
    downloaded: downloaded ?? this.downloaded,
    downloadCount: downloadCount ?? this.downloadCount,
  );

  @override
  List<Object?> get props => [
    status,
    receipt,
    claim,
    error,
    downloaded,
    downloadCount,
  ];
}
