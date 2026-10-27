import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus, errorMessage;
import '../../attendance/repositories/attendance_repository_interface.dart';
import '../repositories/profile_repository_interface.dart';
import 'profile_events.dart';
import 'profile_states.dart';

export 'profile_events.dart';
export 'profile_states.dart';

class ProfileBloc extends Bloc<ProfileEvent, ProfileState> {
  ProfileBloc(this._repo, this._attendance) : super(const ProfileState()) {
    on<LoadProfile>(
      (event, emit) => emit.forEach(
        _repo.watchProfile(),
        onData: (p) => state.copyWith(status: LoadStatus.loaded, profile: p),
        onError: (e, _) => state.profile != null
            ? state
            : state.copyWith(status: LoadStatus.error, error: errorMessage(e)),
      ),
      transformer: restartable(),
    );
    on<LoadChildAttendance>((event, emit) async {
      final map = {...state.attendance};
      for (final id in event.childIds) {
        try {
          final data = await _attendance.watchAttendance(id).first;
          map[id] = data.overall.percentage;
        } catch (_) {
          // the % is optional on the profile card
        }
      }
      emit(state.copyWith(attendance: map));
    }, transformer: restartable());
    on<SaveProfile>((event, emit) async {
      emit(state.copyWith(save: SaveStatus.saving));
      try {
        await _repo.updateProfile(event.profile);
        emit(state.copyWith(save: SaveStatus.saved));
      } catch (e) {
        emit(state.copyWith(save: SaveStatus.failed, error: errorMessage(e)));
      }
    }, transformer: droppable());
    on<ChangePhoto>((event, emit) => _repo.setPhoto(event.style));
  }

  final IProfileRepository _repo;
  final IAttendanceRepository _attendance;
}
