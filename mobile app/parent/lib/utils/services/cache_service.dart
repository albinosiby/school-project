import 'dart:async';

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
///
/// [refreshOn] is subscribed as soon as the stream is listened to, so a write that happens while the first
/// fetch is in flight still triggers a refresh. Cancelling never waits on [refreshOn].
Stream<T> cacheFirst<T extends Object>({
  required CacheService cache,
  required String key,
  required Future<T> Function() fetch,
  Stream<void>? refreshOn,
  Future<T> Function()? refetch,
}) {
  late final StreamController<T> out;
  StreamSubscription<void>? trigger;
  var loading = false, pending = false;

  Future<void> run(Future<T> Function() load, {required bool hasValue}) async {
    loading = true;
    try {
      final fresh = await load();
      cache.write(key, fresh);
      if (!out.isClosed) out.add(fresh);
    } catch (e, st) {
      // Keep whatever is on screen; only surface the error when nothing was shown.
      if (!hasValue && !out.isClosed) out.addError(e, st);
    } finally {
      loading = false;
    }
    if (pending && !out.isClosed) {
      pending = false;
      await run(refetch ?? fetch, hasValue: true);
    }
  }

  out = StreamController<T>(
    onListen: () {
      final cached = cache.read<T>(key);
      if (cached != null) out.add(cached);
      trigger = refreshOn?.listen((_) {
        if (loading) {
          pending = true;
        } else {
          run(refetch ?? fetch, hasValue: true);
        }
      });
      run(fetch, hasValue: cached != null);
    },
    onCancel: () {
      trigger?.cancel(); // not awaited: some refresh sources never complete their cancel
      trigger = null;
      out.close();
    },
  );
  return out.stream;
}
