import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show errorMessage;
import '../repositories/fee_repository_interface.dart';
import 'fee_payment_events.dart';
import 'fee_payment_states.dart';

export 'fee_payment_events.dart';
export 'fee_payment_states.dart';

/// Simulated online payment of fee instalments and receipt downloads. The fees list updates through
/// the repository stream (FeesBloc) once a payment succeeds.
class FeePaymentBloc extends Bloc<FeePaymentEvent, FeePaymentState> {
  FeePaymentBloc(this._repo) : super(const FeePaymentState()) {
    on<FeePaymentSubmitted>(_pay, transformer: droppable());
    on<ReceiptDownloadRequested>(_download);
  }
  final IFeeRepository _repo;

  Future<void> _pay(
    FeePaymentSubmitted e,
    Emitter<FeePaymentState> emit,
  ) async {
    emit(state.copyWith(status: PaymentStatus.processing));
    try {
      final r = await _repo.pay(
        childId: e.childId,
        invoiceIds: e.invoiceIds,
        method: e.method,
      );
      emit(state.copyWith(status: PaymentStatus.success, receipt: r));
    } catch (err) {
      emit(
        state.copyWith(status: PaymentStatus.failure, error: errorMessage(err)),
      );
    }
  }

  Future<void> _download(
    ReceiptDownloadRequested e,
    Emitter<FeePaymentState> emit,
  ) async {
    final file = await _repo.downloadReceipt(e.receipt);
    emit(
      state.copyWith(downloaded: file, downloadCount: state.downloadCount + 1),
    );
  }
}
