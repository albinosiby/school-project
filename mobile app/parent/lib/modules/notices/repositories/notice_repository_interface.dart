import '../models/notice_models.dart';

abstract class INoticeRepository {
  Stream<List<Notice>> watchNotices(String childId);
  Future<void> acknowledge(String noticeId);

  /// The guardian opened the notice: counts as read on the school's side (once per guardian).
  Future<void> markOpened(String noticeId);
}
