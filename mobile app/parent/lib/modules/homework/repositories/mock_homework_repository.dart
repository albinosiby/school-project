import 'dart:async';
import '../../../di/demo_data.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/homework_models.dart';
import 'homework_repository_interface.dart';

/// Demo homework; hand-ins are kept in memory and shown as submitted.
class MockHomeworkRepository implements IHomeworkRepository {
  MockHomeworkRepository(this._cache);
  final CacheService _cache;
  final _changes = StreamController<String>.broadcast();

  /// "{childId}_{homeworkId}" -> the hand-in.
  final _handins = <String, Homework Function(Homework)>{};

  List<Homework> _apply(String childId, List<Homework> list) => [
    for (final h in list) _handins['${childId}_${h.id}']?.call(h) ?? h,
  ];

  @override
  Stream<List<Homework>> watchHomework(String childId) => cacheFirst(
    cache: _cache,
    key: 'homework:$childId',
    refreshOn: _changes.stream.where((c) => c == childId),
    fetch: () async {
      await MockLatency.wait();
      return _apply(childId, DemoData.homework(childId));
    },
  );

  @override
  Future<void> submit({
    required String childId,
    required String homeworkId,
    required List<PickedHandin> files,
    String note = '',
  }) async {
    final problem = handinProblem(files, note);
    if (problem != null) throw AppException(message: problem);
    final at = DateTime.now();
    final handed = [
      for (final f in files)
        HandinFile(name: f.name, type: PickedHandin.mimeOf(f.name) ?? f.mime, size: f.size, path: 'demo/$homeworkId/${safeHandinName(f.name)}'),
    ];
    _handins['${childId}_$homeworkId'] = (h) => h.copyWith(
      submitted: true,
      files: handed,
      note: note.trim(),
      submittedAt: at,
      late: at.isAfter(DateTime(h.due.year, h.due.month, h.due.day, 23, 59, 59)),
    );
    _changes.add(childId);
  }
}
