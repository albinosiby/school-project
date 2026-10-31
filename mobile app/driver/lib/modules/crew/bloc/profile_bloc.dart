import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/data_bloc.dart' show errorMessage;
import '../repositories/crew_repository_interface.dart';

class ProfileFormState extends Equatable {
  const ProfileFormState({this.busy = false, this.error, this.saved = false});
  final bool busy, saved;
  final String? error;
  @override
  List<Object?> get props => [busy, error, saved];
}

class SaveProfile extends Equatable {
  const SaveProfile({required this.phone, required this.address, required this.emergencyName, required this.emergencyPhone});
  final String phone, address, emergencyName, emergencyPhone;
  @override
  List<Object?> get props => [phone, address, emergencyName, emergencyPhone];
}

class ProfileFormBloc extends Bloc<SaveProfile, ProfileFormState> {
  ProfileFormBloc(this._repo) : super(const ProfileFormState()) {
    on<SaveProfile>((e, emit) async {
      if (!RegExp(r'^[+\d][\d\s-]{7,}$').hasMatch(e.phone.trim())) {
        emit(const ProfileFormState(error: 'Enter a valid phone number.'));
        return;
      }
      emit(const ProfileFormState(busy: true));
      try {
        await _repo.updateProfile(phone: e.phone.trim(), address: e.address.trim(), emergencyName: e.emergencyName.trim(), emergencyPhone: e.emergencyPhone.trim());
        emit(const ProfileFormState(saved: true));
      } catch (err) {
        emit(ProfileFormState(error: errorMessage(err)));
      }
    }, transformer: droppable());
  }
  final ICrewRepository _repo;
}
