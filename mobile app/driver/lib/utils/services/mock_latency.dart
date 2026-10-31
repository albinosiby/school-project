/// Simulated network delay of the mock repositories. Tests set this to [Duration.zero].
class MockLatency {
  MockLatency._();
  static Duration delay = const Duration(milliseconds: 350);
  static Future<void> wait() => Future<void>.delayed(delay);
}
