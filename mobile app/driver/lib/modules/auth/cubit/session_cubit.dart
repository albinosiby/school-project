import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/auth_models.dart';
import '../repositories/auth_repository.dart';

class SessionCubit extends Cubit<CrewSession> {
  SessionCubit(this.repository) : super(const CrewSession());
  final AuthRepository repository;
  String _requestedPhone = '9876543210';
  String get requestedPhone => _requestedPhone;
  Future<void> requestCode(String phone) async {
    await repository.requestCode(phone);
    _requestedPhone = phone.replaceAll(RegExp(r'\D'), '');
  }

  Future<void> verify(String code) async => emit(await repository.verify(code));
  Future<void> chooseRole(CrewRole role) async =>
      emit(await repository.chooseRole(role));
  Map<String, String> get bindings => {
    'auth.phone':
        '+91 ${_requestedPhone.substring(0, 5)} ${_requestedPhone.substring(5)}',
  };
  Future<void> signOut() async {
    _requestedPhone = '9876543210';
    await repository.signOut();
    emit(const CrewSession());
  }
}
