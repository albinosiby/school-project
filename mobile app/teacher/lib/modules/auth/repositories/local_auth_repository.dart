import '../../../utils/services/data_store.dart';
import '../models/auth_models.dart';
import 'auth_repository_interface.dart';

/// Local backend: no login. The demo teacher is always signed in.
class LocalAuthRepository implements IAuthRepository {
  LocalAuthRepository(this._db);
  final DataStore _db;

  AuthUser get _me {
    final me = _db.doc('me');
    return AuthUser(uid: 'local', email: '${me['email'] ?? ''}', name: '${me['name'] ?? ''}', schoolId: 'local', staffId: 'stf_025');
  }

  @override
  AuthUser? get currentUser => _me;

  @override
  Future<AuthUser?> restoreSession() async => _me;

  @override
  Future<AuthUser> signIn(String email, String password) async => _me;

  @override
  Future<AuthUser> signInWithGoogle() async => _me;

  @override
  Future<void> sendPasswordReset(String email) async {}

  @override
  Future<void> signOut() async {}
}
