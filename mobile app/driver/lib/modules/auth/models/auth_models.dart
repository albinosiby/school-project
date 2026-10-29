import 'package:equatable/equatable.dart';

enum CrewRole { driver, assistant }

class CrewSession extends Equatable {
  const CrewSession({
    this.authenticated = false,
    this.role = CrewRole.driver,
    this.phone = '9876543210',
  });
  final bool authenticated;
  final CrewRole role;
  final String phone;
  @override
  List<Object?> get props => [authenticated, role, phone];
}

class AuthFailure implements Exception {
  const AuthFailure(this.message);
  final String message;
}
