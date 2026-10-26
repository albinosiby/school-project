import 'dart:async';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../../../utils/services/local_storage_service.dart';
import '../../family/repositories/family_repository_interface.dart';
import '../models/guardian_profile.dart';
import 'profile_repository_interface.dart';

/// The guardian's profile from the school record (`users/{uid}` and the first child's guardian details).
/// Contact details are the school's record, so changes go through the office (the app cannot write them);
/// the photo choice is kept on this device.
class FirebaseProfileRepository implements IProfileRepository {
  FirebaseProfileRepository(this._session, this._family, this._storage);
  final ParentSession _session;
  final IFamilyRepository _family;
  final LocalStorageService _storage;
  final _photo = StreamController<void>.broadcast();

  String get _photoKey => 'profile_photo:${_session.uid}';

  @override
  Stream<GuardianProfile> watchProfile() {
    late final StreamController<GuardianProfile> out;
    final subs = <StreamSubscription<Object?>>[];
    GuardianProfile? last;
    out = StreamController<GuardianProfile>(
      onListen: () => subs
        ..add(_family.watchFamily().listen((f) {
          final first = _session.studentIds.isEmpty ? null : _session.cached(_session.studentIds.first);
          last = GuardianProfile(
            guardian: f.guardian,
            parentId: '${_session.user['email'] ?? f.guardian.email}',
            address: '${first?['address'] ?? ''}',
            emergencyName: f.guardian.name,
            emergencyRelation: f.guardian.relation,
            emergencyPhone: f.guardian.phone,
            phoneVerified: f.guardian.phone.isNotEmpty,
            photoStyle: _storage.getString(_photoKey) == null ? null : int.tryParse(_storage.getString(_photoKey)!),
          );
          out.add(last!);
        }, onError: out.addError))
        ..add(_photo.stream.listen((_) {
          final l = last;
          if (l != null) out.add(l.copyWith(photoStyle: () => int.tryParse(_storage.getString(_photoKey) ?? '')));
        })),
      onCancel: () async {
        for (final s in subs) {
          await s.cancel();
        }
      },
    );
    return out.stream;
  }

  @override
  Future<void> updateProfile(GuardianProfile profile) async => throw AppException(
        message: 'Your contact details are the school\'s record. Ask the school office to update them.',
      );

  @override
  Future<void> setPhoto(int? style) async {
    style == null ? await _storage.remove(_photoKey) : await _storage.setString(_photoKey, '$style');
    _photo.add(null);
  }
}
