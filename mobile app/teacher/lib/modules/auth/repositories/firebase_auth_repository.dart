import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:google_sign_in/google_sign_in.dart';
import '../../../utils/services/firebase/firebase_auth_service.dart';
import '../../../utils/services/firebase/firestore_data_store.dart';
import '../../../utils/services/firebase/push_notification_service.dart';
import '../../../utils/services/firebase/store_adapters.dart';
import '../models/auth_models.dart';
import 'auth_repository_interface.dart';

/// Firebase Auth (email + password, or Google). After sign-in `users/{uid}` gives `schoolId`, `staffId` and `role`
/// (DATA_CONTRACT §1); only teachers may use this app. Then the [FirestoreDataStore] is started for that school.
class FirebaseAuthRepository implements IAuthRepository {
  FirebaseAuthRepository(this._auth, this._store, {FirebaseFirestore? firestore, PushNotificationService? push})
      : _fs = firestore,
        _push = push; // ignore: prefer_initializing_formals (named private parameters are not allowed)
  final FirebaseAuthService _auth;
  final FirestoreDataStore _store;
  final PushNotificationService? _push;
  FirebaseFirestore? _fs;
  AuthUser? _user;

  FirebaseFirestore get _db => _fs ??= FirebaseFirestore.instance;

  @override
  AuthUser? get currentUser => _user;

  @override
  Future<AuthUser?> restoreSession() async {
    try {
      final u = await _auth.authStateChanges.first.timeout(const Duration(seconds: 6));
      if (u == null) return null;
      return await _resolve(u);
    } on AuthFailure {
      return null;
    } catch (_) {
      return null;
    }
  }

  @override
  Future<AuthUser> signIn(String email, String password) async {
    try {
      final cred = await _auth.signInWithEmailAndPassword(email.trim(), password);
      return await _resolve(cred.user!);
    } on fb.FirebaseAuthException catch (e) {
      throw AuthFailure(authMessage(e.code));
    } on FirebaseException catch (e) {
      throw AuthFailure(e.code == 'permission-denied' ? 'This account is not set up for the teacher app. Contact the school admin.' : 'Could not load your school profile (${e.code}).');
    }
  }

  @override
  Future<AuthUser> signInWithGoogle() async {
    final fb.UserCredential cred;
    try {
      cred = await _auth.signInWithGoogle();
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) throw const AuthCancelled();
      throw AuthFailure('Google sign-in failed (${e.code.name}). Please try again.');
    } on fb.FirebaseAuthException catch (e) {
      if (e.code == 'popup-closed-by-user' || e.code == 'cancelled-popup-request') throw const AuthCancelled();
      throw AuthFailure(authMessage(e.code));
    }
    final u = cred.user!;
    // Google signs into the account the admin created for this email (same uid), so users/{uid} already exists.
    // A brand-new account means the email was never registered by the school: remove it again.
    if (cred.additionalUserInfo?.isNewUser == true && !(await _db.doc('users/${u.uid}').get().then((s) => s.exists, onError: (_) => false))) {
      await u.delete().catchError((_) {});
      await _auth.signOut();
      throw AuthFailure('${u.email ?? 'This Google account'} is not registered as a teacher. Ask the school admin to add this email, or sign in with your school email.');
    }
    try {
      return await _resolve(u);
    } on FirebaseException catch (e) {
      throw AuthFailure(e.code == 'permission-denied' ? 'This account is not set up for the teacher app. Contact the school admin.' : 'Could not load your school profile (${e.code}).');
    }
  }

  Future<AuthUser> _resolve(fb.User u) async {
    final snap = await _db.doc('users/${u.uid}').get();
    final d = snap.data();
    if (!snap.exists || d == null || d['schoolId'] == null) {
      await _auth.signOut();
      throw const AuthFailure('This account is not linked to a school. Ask the school admin to add you as a teacher.');
    }
    if (d['role'] != 'teacher') {
      await _auth.signOut();
      throw AuthFailure('This app is for teachers. This account is registered as ${d['role'] == 'admin' ? 'an administrator' : 'a ${d['role']}'}.');
    }
    final staffId = '${d['staffId'] ?? ''}';
    if (staffId.isEmpty) {
      await _auth.signOut();
      throw const AuthFailure('Your account has no staff profile yet. Ask the school admin to finish setting it up.');
    }
    final user = AuthUser(uid: u.uid, email: u.email ?? '${d['email'] ?? ''}', name: '${d['name'] ?? ''}', schoolId: '${d['schoolId']}', staffId: staffId);
    _user = user;
    _store.start(AdapterContext(schoolId: user.schoolId, staffId: staffId, authUid: user.uid));
    // asks for notification permission and registers this device's FCM token (in the background)
    unawaited(_push?.start(user.uid));
    return user;
  }

  @override
  Future<void> sendPasswordReset(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email.trim());
    } on fb.FirebaseAuthException catch (e) {
      // do not reveal whether an address has an account
      if (e.code == 'user-not-found') return;
      throw AuthFailure(authMessage(e.code));
    }
  }

  @override
  Future<void> signOut() async {
    await _push?.stop();
    _store.stop();
    _user = null;
    await _auth.signOut();
  }
}
