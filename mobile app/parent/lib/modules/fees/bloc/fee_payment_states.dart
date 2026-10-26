import 'package:equatable/equatable.dart';
import '../models/fee_models.dart';

enum PaymentStatus { idle, processing, success, failure }

class FeePaymentState extends Equatable {
  const FeePaymentState({
    this.status = PaymentStatus.idle,
    this.receipt,
    this.error,
    this.downloaded,
    this.downloadCount = 0,
  });
  final PaymentStatus status;

  /// Receipt of the last successful payment.
  final FeeReceipt? receipt;
  final String? error;

  /// File name of the last downloaded receipt; [downloadCount] changes on every download.
  final String? downloaded;
  final int downloadCount;

  bool get isProcessing => status == PaymentStatus.processing;

  FeePaymentState copyWith({
    PaymentStatus? status,
    FeeReceipt? receipt,
    String? error,
    String? downloaded,
    int? downloadCount,
  }) => FeePaymentState(
    status: status ?? this.status,
    receipt: receipt ?? this.receipt,
    error: error,
    downloaded: downloaded ?? this.downloaded,
    downloadCount: downloadCount ?? this.downloadCount,
  );

  @override
  List<Object?> get props => [
    status,
    receipt,
    error,
    downloaded,
    downloadCount,
  ];
}
