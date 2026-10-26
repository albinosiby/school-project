import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../utils/exceptions/app_exception.dart';

enum LoadStatus { loading, loaded, error }

class ChildDataEvent extends Equatable {
  const ChildDataEvent();
  @override
  List<Object?> get props => [];
}

/// Load (or switch to) the data of [childId].
class LoadChildData extends ChildDataEvent {
  const LoadChildData(this.childId);
  final String childId;
  @override
  List<Object?> get props => [childId];
}

/// Re-run the last load (pull to refresh, retry).
class RefreshChildData extends ChildDataEvent {
  const RefreshChildData();
}

class DataState<T> extends Equatable {
  const DataState({
    this.status = LoadStatus.loading,
    this.data,
    this.error,
    this.childId,
  });
  final LoadStatus status;
  final T? data;
  final String? error;
  final String? childId;

  bool get isLoading => status == LoadStatus.loading;
  bool get hasError => status == LoadStatus.error;
  bool get hasData => data != null;

  @override
  List<Object?> get props => [status, data, error, childId];
}

/// Base for every "load a stream of data for the selected child" BLoC. The repository stream is
/// cache-first (cached value, then fresh value), so the UI shows cached data instantly and updates
/// when fresh data arrives. Errors only surface when there is nothing to show.
abstract class ChildDataBloc<T> extends Bloc<ChildDataEvent, DataState<T>> {
  ChildDataBloc(this._source) : super(DataState<T>()) {
    on<LoadChildData>(_load, transformer: restartable());
    on<RefreshChildData>((event, emit) {
      final id = state.childId;
      if (id != null) add(LoadChildData(id));
    });
  }

  final Stream<T> Function(String childId) _source;

  Future<void> _load(LoadChildData event, Emitter<DataState<T>> emit) async {
    final keep = state.childId == event.childId && state.hasData;
    if (!keep) emit(DataState<T>(childId: event.childId));
    await emit.forEach<T>(
      _source(event.childId),
      onData: (d) => DataState<T>(
        status: LoadStatus.loaded,
        data: d,
        childId: event.childId,
      ),
      onError: (err, _) => state.childId == event.childId && state.hasData
          ? state
          : DataState<T>(
              status: LoadStatus.error,
              error: errorMessage(err),
              childId: event.childId,
            ),
    );
  }
}

String errorMessage(Object e) =>
    e is AppException ? e.message : 'Something went wrong. Please try again.';
