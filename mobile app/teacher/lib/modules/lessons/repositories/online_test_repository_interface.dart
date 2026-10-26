import '../models/online_test_models.dart';

/// Online tests (collection `ts_tests`).
abstract class IOnlineTestRepository {
  Future<List<OnlineTest>> getAll();
  Future<OnlineTest?> get(String id);
  /// Creates a test; an empty [OnlineTest.id] gets a generated one.
  Future<OnlineTest> create(OnlineTest test);
  Future<void> update(OnlineTest test);
  Future<void> delete(String id);
  /// Records that the test link was shared.
  Future<void> share(String id);
  /// Queues a parent/student notification about a test.
  Future<void> notify(String text);
  Stream<void> watch();
}
