import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus, errorMessage;
import '../models/consent_models.dart';
import '../repositories/consent_repository_interface.dart';

export '../models/consent_models.dart';

sealed class ConsentEvent extends Equatable {
  const ConsentEvent();
  @override
  List<Object?> get props => [];
}

class LoadConsent extends ConsentEvent {
  const LoadConsent();
}

class SaveConsent extends ConsentEvent {
  const SaveConsent({required this.photos, required this.notifications});
  final bool photos, notifications;
  @override
  List<Object?> get props => [photos, notifications];
}

class WithdrawConsent extends ConsentEvent {
  const WithdrawConsent();
}

class ConsentState extends Equatable {
  const ConsentState({
    this.status = LoadStatus.loading,
    this.record,
    this.saving = false,
    this.error,
  });
  final LoadStatus status;
  final ConsentRecord? record;
  final bool saving;
  final String? error;

  /// Loaded and there is no current consent: the app asks for it.
  bool get needsConsent =>
      status == LoadStatus.loaded && !(record?.isCurrent ?? false);

  ConsentState copyWith({
    LoadStatus? status,
    ConsentRecord? record,
    bool clearRecord = false,
    bool? saving,
    String? error,
  }) => ConsentState(
    status: status ?? this.status,
    record: clearRecord ? null : record ?? this.record,
    saving: saving ?? this.saving,
    error: error,
  );

  @override
  List<Object?> get props => [status, record, saving, error];
}

/// Global: the guardian's consent (Home asks once when none is recorded; Settings > Privacy changes it).
class ConsentBloc extends Bloc<ConsentEvent, ConsentState> {
  ConsentBloc(this._repo) : super(const ConsentState()) {
    on<LoadConsent>(
      (e, emit) => emit.forEach<ConsentRecord?>(
        _repo.watch(),
        onData: (r) => state.copyWith(
          status: LoadStatus.loaded,
          record: r,
          clearRecord: r == null,
        ),
        onError: (err, _) => state.status == LoadStatus.loaded
            ? state
            : state.copyWith(
                status: LoadStatus.error,
                error: errorMessage(err),
              ),
      ),
      transformer: restartable(),
    );
    on<SaveConsent>((e, emit) async {
      emit(state.copyWith(saving: true));
      try {
        await _repo.save(photos: e.photos, notifications: e.notifications);
        emit(
          state.copyWith(
            saving: false,
            status: LoadStatus.loaded,
            record: ConsentRecord(
              photos: e.photos,
              notifications: e.notifications,
              acceptedAt: DateTime.now(),
            ),
          ),
        );
      } catch (err) {
        emit(state.copyWith(saving: false, error: errorMessage(err)));
      }
    }, transformer: droppable());
    on<WithdrawConsent>((e, emit) async {
      emit(state.copyWith(saving: true));
      try {
        await _repo.withdraw();
        emit(
          state.copyWith(
            saving: false,
            record: state.record?.copyWith(withdrawn: true),
          ),
        );
      } catch (err) {
        emit(state.copyWith(saving: false, error: errorMessage(err)));
      }
    }, transformer: droppable());
  }
  final IConsentRepository _repo;
}
