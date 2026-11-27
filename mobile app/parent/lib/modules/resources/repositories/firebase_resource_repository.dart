import '../../../utils/services/firebase/parent_session.dart';
import '../models/resource_models.dart';
import 'resource_repository_interface.dart';

/// `cl_resources` of the child's class that the teacher made visible to parents (the rules allow exactly this query).
class FirebaseResourceRepository implements IResourceRepository {
  FirebaseResourceRepository(this._session);
  final ParentSession _session;

  @override
  Stream<List<ClassResource>> watchResources(String childId) async* {
    final classId = await _session.classIdOf(childId);
    if (classId.isEmpty) {
      yield const [];
      return;
    }
    yield* _session
        .col('cl_resources')
        .where('classId', isEqualTo: classId)
        .where('visibility', isEqualTo: 'parents')
        .snapshots()
        .map((q) => ClassResource.sorted([for (final d in q.docs) ?ClassResource.fromDoc(d.id, d.data())]));
  }
}
