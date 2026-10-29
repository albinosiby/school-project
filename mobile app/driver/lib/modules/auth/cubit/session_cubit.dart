import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/auth_models.dart';
import '../repositories/auth_repository.dart';

class SessionCubit extends Cubit<CrewSession> {
  SessionCubit(this.repository) : super(const CrewSession());
  final AuthRepository repository;
  Future<void> requestCode(String phone) => repository.requestCode(phone);
  Future<void> verify(String code) async => emit(await repository.verify(code));
  Future<void> chooseRole(CrewRole role) async =>
      emit(await repository.chooseRole(role));
  Future<void> signOut() async {
    await repository.signOut();
    emit(const CrewSession());
  }
}
