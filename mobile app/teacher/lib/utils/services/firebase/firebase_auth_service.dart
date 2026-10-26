import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../google/google_workspace_service.dart';

class FirebaseAuthService {
  final fb.FirebaseAuth _auth = fb.FirebaseAuth.instance;
  bool _usedGoogle = false;

  fb.User? get currentUser => _auth.currentUser;

  Stream<fb.User?> get authStateChanges => _auth.authStateChanges();

  Future<fb.UserCredential> signInWithEmailAndPassword(
    String email,
    String password,
  ) {
    return _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  Future<fb.UserCredential> createUserWithEmailAndPassword(
    String email,
    String password,
  ) {
    return _auth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  /// Google account picker: a popup on web, the native Google sign-in sheet on Android/iOS.
  /// Throws [fb.FirebaseAuthException] or [GoogleSignInException] (code `canceled` when the teacher closes it).
  Future<fb.UserCredential> signInWithGoogle() async {
    if (kIsWeb) return _auth.signInWithPopup(fb.GoogleAuthProvider()..setCustomParameters({'prompt': 'select_account'}));
    await ensureGoogleSignIn();
    _usedGoogle = true;
    final account = await GoogleSignIn.instance.authenticate();
    return _auth.signInWithCredential(fb.GoogleAuthProvider.credential(idToken: account.authentication.idToken));
  }

  Future<void> sendPasswordResetEmail(String email) => _auth.sendPasswordResetEmail(email: email);

  Future<void> signOut() async {
    if (!kIsWeb && _usedGoogle) await GoogleSignIn.instance.signOut().catchError((_) {});
    await _auth.signOut();
  }
}
