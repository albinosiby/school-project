import '../../../utils/services/firebase/crew_session.dart';
import '../models/notice_models.dart';
import 'notice_repository_interface.dart';

/// Published `com_notices` addressed to the transport crew (contract 14.6).
class FirebaseNoticeRepository implements INoticeRepository {
  FirebaseNoticeRepository(this._session);
  final CrewSession _session;

  @override
  Stream<List<Notice>> watch() => _session.whenReady(() => _session.col('com_notices').where('status', isEqualTo: 'Published').snapshots().map(
        (q) => [for (final d in q.docs) Notice.fromJson(d.data(), id: d.id)].where((n) => n.forCrew).toList()
          ..sort((a, b) {
            if (a.pinned != b.pinned) return a.pinned ? -1 : 1;
            return (b.sentAt ?? DateTime(0)).compareTo(a.sentAt ?? DateTime(0));
          }),
      ));
}
