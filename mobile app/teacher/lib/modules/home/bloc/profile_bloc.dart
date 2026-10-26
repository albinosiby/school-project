import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../repositories/profile_repository_interface.dart';
import 'profile_events.dart';
import 'profile_states.dart';

/// Faculty profile details for Profile and the Digital Faculty ID (teacher identity comes from SchoolBloc).
class ProfileBloc extends Bloc<ProfileEvent, ProfileState> {
  ProfileBloc(this._repo) : super(const ProfileState()) {
    on<ProfileLoadRequested>(_onLoad);
    _sub = _repo.watch().listen((_) => add(const ProfileLoadRequested()));
  }

  final IProfileRepository _repo;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(ProfileLoadRequested e, Emitter<ProfileState> emit) async {
    try {
      emit(ProfileState(status: ProfileStatus.loaded, profile: await _repo.getProfile()));
    } catch (err) {
      emit(ProfileState(status: ProfileStatus.failure, profile: state.profile, error: '$err'));
    }
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
