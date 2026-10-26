/// Cache used by the stale-while-revalidate repositories. In-memory for the demo; swap the body for a
/// JSON-on-disk implementation (SharedPreferences / sqflite) without touching repositories or BLoCs.
class CacheService {
  final Map<String, Object> _entries = {};

  T? read<T>(String key) {
    final v = _entries[key];
    return v is T ? v : null;
  }

  void write(String key, Object value) => _entries[key] = value;
  void remove(String key) => _entries.remove(key);
  void clear() => _entries.clear();
  bool contains(String key) => _entries.containsKey(key);
}

/// Cache-first read:
///   cache hit  -> emit cached value, fetch in background, save, emit fresh value
///   cache miss -> fetch, save, emit
/// If the background fetch fails while a cached value was shown, the cached value stays (no error is emitted).
/// [refreshOn] re-runs [refetch] (default: [fetch]) whenever it fires (used by mock repositories after a local write).
Stream<T> cacheFirst<T extends Object>({
  required CacheService cache,
  required String key,
  required Future<T> Function() fetch,
  Stream<void>? refreshOn,
  Future<T> Function()? refetch,
}) async* {
  final cached = cache.read<T>(key);
  if (cached != null) yield cached;
  try {
    final fresh = await fetch();
    cache.write(key, fresh);
    yield fresh;
  } catch (_) {
    if (cached == null) rethrow;
  }
  if (refreshOn != null) {
    await for (final _ in refreshOn) {
      try {
        final fresh = await (refetch ?? fetch)();
        cache.write(key, fresh);
        yield fresh;
      } catch (_) {
        // keep the last value on screen
      }
    }
  }
}
