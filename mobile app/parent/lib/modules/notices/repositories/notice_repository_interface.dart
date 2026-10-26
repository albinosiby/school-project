import '../models/notice_models.dart';

abstract class INoticeRepository {
  Stream<List<Notice>> watchNotices(String childId);
  Future<void> acknowledge(String noticeId);
}
