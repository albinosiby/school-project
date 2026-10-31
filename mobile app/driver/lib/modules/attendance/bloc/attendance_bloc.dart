import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/data_bloc.dart';
import '../../trips/models/trip_models.dart';
import '../models/attendance_models.dart';
import '../repositories/attendance_repository_interface.dart';

/// Marks of one trip, with the mark action. Optimistic: the tapped mark shows at once; the stream confirms it.
class AttendanceBloc extends Bloc<AttendanceEvent, AttendanceState> {
  AttendanceBloc(this._repo, this.trip) : super(const AttendanceState()) {
    on<WatchAttendance>((e, emit) async {
      await emit.forEach<TripAttendance>(
        _repo.watch(trip),
        onData: (a) => state.copyWith(status: LoadStatus.loaded, attendance: a),
        onError: (err, _) => state.attendance != null ? state : state.copyWith(status: LoadStatus.error, error: errorMessage(err)),
      );
    }, transformer: restartable());
    on<MarkStudent>((e, emit) async {
      final before = state.attendance;
      if (before != null) {
        emit(state.copyWith(
          attendance: before.withMark(e.studentId, e.status == null ? null : Mark(status: e.status!, at: DateTime.now(), by: '', stopId: e.stopId)),
          pending: {...state.pending, e.studentId},
        ));
      }
      try {
        await _repo.mark(trip, e.studentId, e.status, stopId: e.stopId);
        emit(state.copyWith(pending: {...state.pending}..remove(e.studentId)));
      } catch (err) {
        emit(state.copyWith(attendance: before, pending: {...state.pending}..remove(e.studentId), error: errorMessage(err), clearError: false));
      }
    }, transformer: concurrent());
    on<ClearAttendanceError>((e, emit) => emit(state.copyWith(clearError: true)));
  }
  final IAttendanceRepository _repo;
  final Trip trip;
}

class AttendanceState extends Equatable {
  const AttendanceState({this.status = LoadStatus.loading, this.attendance, this.error, this.pending = const {}});
  final LoadStatus status;
  final TripAttendance? attendance;
  final String? error;
  final Set<String> pending;

  AttendanceState copyWith({LoadStatus? status, TripAttendance? attendance, String? error, bool clearError = true, Set<String>? pending}) =>
      AttendanceState(status: status ?? this.status, attendance: attendance ?? this.attendance, error: clearError ? error : error ?? this.error, pending: pending ?? this.pending);

  @override
  List<Object?> get props => [status, attendance, error, pending];
}

sealed class AttendanceEvent extends Equatable {
  const AttendanceEvent();
  @override
  List<Object?> get props => [];
}

class WatchAttendance extends AttendanceEvent {
  const WatchAttendance();
}

class MarkStudent extends AttendanceEvent {
  const MarkStudent(this.studentId, this.status, {this.stopId});
  final String studentId;
  final MarkStatus? status;
  final String? stopId;
  @override
  List<Object?> get props => [studentId, status, stopId];
}

class ClearAttendanceError extends AttendanceEvent {
  const ClearAttendanceError();
}

/// Attendance history of the bus (key = busId), for the student sheet.
class BusAttendanceHistoryBloc extends DataBloc<List<TripAttendance>> {
  BusAttendanceHistoryBloc(IAttendanceRepository repo) : super(repo.watchBusHistory);
}
