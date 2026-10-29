import '../models/auth_models.dart';

abstract interface class AuthRepository {
  Future<void> requestCode(String phone);
  Future<CrewSession> verify(String code);
  Future<CrewSession> chooseRole(CrewRole role);
  Future<void> signOut();
}

/// Demo identity is deliberately separate from production authentication.
class DemoAuthRepository implements AuthRepository {
  String? _phone;
  int _attempts = 0;
  bool _verified = false;
  @override
  Future<void> requestCode(String phone) async {
    final value = phone.replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^\d{10}$').hasMatch(value)) {
      throw const AuthFailure('Enter a valid 10-digit mobile number.');
    }
    _phone = value;
    _attempts = 0;
    _verified = false;
  }

  @override
  Future<CrewSession> verify(String code) async {
    if (_phone == null) {
      throw const AuthFailure('Request a demo verification code first.');
    }
    if (_attempts >= 3) {
      throw const AuthFailure('Request a new code before trying again.');
    }
    _attempts++;
    if (code != '482916') throw const AuthFailure('Use demo code 482916.');
    _verified = true;
    return CrewSession(authenticated: true, phone: _phone!);
  }

  @override
  Future<CrewSession> chooseRole(CrewRole role) async {
    if (!_verified) {
      throw const AuthFailure('Sign in before choosing a crew role.');
    }
    return CrewSession(authenticated: true, role: role, phone: _phone!);
  }

  @override
  Future<void> signOut() async {
    _phone = null;
    _verified = false;
    _attempts = 0;
  }
}
