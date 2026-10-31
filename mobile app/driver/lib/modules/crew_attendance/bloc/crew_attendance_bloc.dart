import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/data_bloc.dart';
import '../models/crew_attendance_models.dart';
import '../repositories/crew_attendance_repository_interface.dart';

/// Own check-in days of a month (key = YYYY-MM).
class CrewAttendanceBloc extends DataBloc<CrewAttendance> {
  CrewAttendanceBloc(ICrewAttendanceRepository repo) : super(repo.watch);
}

class PunchState extends Equatable {
  const PunchState({this.busy = false, this.error, this.done});
  final bool busy;
  final String? error, done;
  @override
  List<Object?> get props => [busy, error, done];
}

sealed class PunchEvent extends Equatable {
  const PunchEvent();
  @override
  List<Object?> get props => [];
}

class PunchIn extends PunchEvent {
  const PunchIn();
}

class PunchOut extends PunchEvent {
  const PunchOut();
}

class PunchBloc extends Bloc<PunchEvent, PunchState> {
  PunchBloc(this._repo) : super(const PunchState()) {
    on<PunchIn>((e, emit) => _run(emit, _repo.punchIn, 'Checked in'), transformer: droppable());
    on<PunchOut>((e, emit) => _run(emit, _repo.punchOut, 'Checked out'), transformer: droppable());
  }
  final ICrewAttendanceRepository _repo;

  Future<void> _run(Emitter<PunchState> emit, Future<void> Function() op, String done) async {
    emit(const PunchState(busy: true));
    try {
      await op();
      emit(PunchState(done: done));
    } catch (err) {
      emit(PunchState(error: errorMessage(err)));
    }
  }
}
