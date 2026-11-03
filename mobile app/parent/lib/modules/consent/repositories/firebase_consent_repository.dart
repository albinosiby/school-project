import 'package:cloud_firestore/cloud_firestore.dart' show SetOptions;
import '../../../utils/services/firebase/parent_session.dart';
import '../models/consent_models.dart';
import 'consent_repository_interface.dart';

/// `consents/{uid}` (data contract 13.3): `{uid, studentIds, version, acceptedAt, items: {dataProcessing, photos, notifications}}`;
/// withdrawing sets `withdrawn: true`. The rules let a parent write only their own doc; the `onConsentWritten` function audits it.
class FirebaseConsentRepository implements IConsentRepository {
  FirebaseConsentRepository(this._session);
  final ParentSession _session;

  @override
  Stream<ConsentRecord?> watch() => _session.whenReady(
    () => _session.col('consents').doc(_session.uid).snapshots().map((s) {
      final d = s.data();
      if (d == null) return null;
      final items = d['items'] is Map
          ? Map<String, dynamic>.from(d['items'] as Map)
          : const <String, dynamic>{};
      return ConsentRecord(
        photos: items['photos'] == true,
        notifications: items['notifications'] != false,
        version: '${d['version'] ?? ''}',
        acceptedAt: parseTime(d['acceptedAt']),
        withdrawn: d['withdrawn'] == true,
      );
    }),
  );

  @override
  Future<void> save({required bool photos, required bool notifications}) async {
    await _session.ready;
    await _session.col('consents').doc(_session.uid).set({
      'uid': _session.uid,
      'studentIds': _session.studentIds,
      'version': ConsentRecord.currentVersion,
      'acceptedAt': nowUtc(),
      'items': {
        'dataProcessing': true,
        'photos': photos,
        'notifications': notifications,
      },
      'withdrawn': false,
      'updatedAt': nowUtc(),
      'updatedBy': _session.uid,
    });
  }

  @override
  Future<void> withdraw() async {
    await _session.ready;
    await _session.col('consents').doc(_session.uid).set({
      'uid': _session.uid,
      'withdrawn': true,
      'withdrawnAt': nowUtc(),
      'updatedAt': nowUtc(),
      'updatedBy': _session.uid,
    }, SetOptions(merge: true));
  }
}
