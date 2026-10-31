import '../models/notice_models.dart';

abstract class INoticeRepository {
  /// Cache-first: published notices addressed to the transport crew, newest first.
  Stream<List<Notice>> watch();
}
