import 'package:equatable/equatable.dart';

/// The signed-in account: the Firebase user joined with `users/{uid}` (school, staff id, role).
class AuthUser extends Equatable {
  const AuthUser({required this.uid, required this.email, required this.name, required this.schoolId, required this.staffId, this.role = 'teacher'});
  final String uid, email, name, schoolId, staffId, role;

  @override
  List<Object?> get props => [uid, email, name, schoolId, staffId, role];
}

/// A sign-in / account problem with a message that can be shown to the teacher as is.
class AuthFailure implements Exception {
  const AuthFailure(this.message);
  final String message;
  @override
  String toString() => message;
}

/// The teacher closed the Google account picker; not an error to show.
class AuthCancelled implements Exception {
  const AuthCancelled();
}

/// Maps Firebase Auth error codes to friendly messages.
String authMessage(String code) => switch (code) {
      'invalid-email' => 'That email address is not valid.',
      'user-not-found' || 'wrong-password' || 'invalid-credential' || 'invalid-login-credentials' => 'Incorrect email or password.',
      'user-disabled' => 'This account has been disabled. Contact the school admin.',
      'too-many-requests' => 'Too many attempts. Wait a few minutes and try again.',
      'account-exists-with-different-credential' => 'This email signs in with a password. Use email and password, or "Forgot password?" to set one.',
      'popup-blocked' => 'The browser blocked the Google window. Allow pop-ups for this site and try again.',
      'operation-not-allowed' => 'Google sign-in is not enabled for this school yet. Use email and password.',
      'network-request-failed' => 'No internet connection. Check your network and try again.',
      _ => 'Could not sign in. Please try again.',
    };

/// Pure rules for the sign-in form.
class AuthValidators {
  AuthValidators._();
  static String? email(String? v) {
    final s = (v ?? '').trim();
    if (s.isEmpty) return 'Enter your school email';
    return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$').hasMatch(s) ? null : 'Enter a valid email address';
  }

  static String? password(String? v) => (v ?? '').isEmpty ? 'Enter your password' : null;
}
