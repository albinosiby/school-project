import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../utils/exceptions/app_exception.dart';

enum LoadStatus { loading, loaded, error }

class DataEvent extends Equatable {
  const DataEvent();
  @override
  List<Object?> get props => [];
}

/// Load (or switch to) the data for [key] (a bus id, a date, a month...).
class LoadData extends DataEvent {
  const LoadData([this.key = '']);
  final String key;
  @override
  List<Object?> get props => [key];
}

/// Re-run the last load (pull to refresh, retry).
class RefreshData extends DataEvent {
  const RefreshData();
}

class DataState<T> extends Equatable {
  const DataState({this.status = LoadStatus.loading, this.data, this.error, this.key});
  final LoadStatus status;
  final T? data;
  final String? error;
  final String? key;

  bool get isLoading => status == LoadStatus.loading;
  bool get hasError => status == LoadStatus.error;
  bool get hasData => data != null;

  @override
  List<Object?> get props => [status, data, error, key];
}

/// Base for every "load a stream of data" BLoC. The repository stream is cache-first (cached value, then fresh
/// value), so the UI shows cached data instantly and updates when fresh data arrives. Errors only surface when there
/// is nothing to show.
abstract class DataBloc<T> extends Bloc<DataEvent, DataState<T>> {
  DataBloc(this._source) : super(DataState<T>()) {
    on<LoadData>(_load, transformer: restartable());
    on<RefreshData>((event, emit) => add(LoadData(state.key ?? '')));
  }

  final Stream<T> Function(String key) _source;

  Future<void> _load(LoadData event, Emitter<DataState<T>> emit) async {
    final keep = state.key == event.key && state.hasData;
    if (!keep) emit(DataState<T>(key: event.key));
    await emit.forEach<T>(
      _source(event.key),
      onData: (d) => DataState<T>(status: LoadStatus.loaded, data: d, key: event.key),
      onError: (err, _) => state.key == event.key && state.hasData
          ? state
          : DataState<T>(status: LoadStatus.error, error: errorMessage(err), key: event.key),
    );
  }
}

String errorMessage(Object e) => e is AppException ? e.message : 'Something went wrong. Please try again.';
