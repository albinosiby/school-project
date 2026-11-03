import '../../../utils/services/firebase/parent_session.dart';
import '../models/family_models.dart';
import 'family_repository_interface.dart';

/// Guardian (`users/{uid}`) and the linked children (`students/{id}` + their class for the class teacher), live.
class FirebaseFamilyRepository implements IFamilyRepository {
  FirebaseFamilyRepository(this._session);
  final ParentSession _session;

  @override
  // switchLatest, not asyncExpand: the children stream never completes, so asyncExpand would never see a child
  // linked or unlinked by the school while the app is open
  Stream<Family> watchFamily() => switchLatest(_session.watchUser(), (user) {
        final ids = _session.studentIds;
        final children = combineLatest([
          for (final id in ids)
            _session.col('students').doc(id).snapshots().asyncMap((s) async {
              final d = s.data() ?? const <String, dynamic>{};
              _session.remember(id, d);
              final cid = '${d['classId'] ?? ''}';
              final cls = cid.isEmpty ? null : (await _session.col('classes').doc(cid).get()).data();
              return Child(
                id: id,
                name: '${d['name'] ?? ''}',
                grade: '${d['grade'] ?? ''}',
                section: '${d['section'] ?? ''}',
                rollNo: (d['roll'] as num?)?.toInt() ?? 0,
                admissionNo: '${d['grn'] ?? ''}',
                classTeacher: '${cls?['classTeacher'] ?? ''}',
              );
            }),
        ]);
        return children.map((kids) {
          final first = _session.studentIds.isEmpty ? null : _session.cached(_session.studentIds.first);
          return Family(
            guardian: Guardian(
              id: _session.uid,
              name: '${user['name'] ?? first?['guardian'] ?? ''}',
              email: '${user['email'] ?? ''}',
              phone: '${user['phone'] ?? first?['phone'] ?? ''}',
              relation: '${first?['relation'] ?? 'Parent'}',
            ),
            children: kids,
          );
        });
      });
}
