import 'dart:async';

Stream<List<T>> combineSchoolStreams<T>(List<Stream<T>> streams) {
  if (streams.isEmpty) return Stream.value(<T>[]);
  late StreamController<List<T>> out;
  final subscriptions = <StreamSubscription<T>>[];
  final values = List<T?>.filled(streams.length, null);
  final seen = List<bool>.filled(streams.length, false);
  var completed = 0;
  out = StreamController<List<T>>(
    onListen: () {
      for (var index = 0; index < streams.length; index++) {
        subscriptions.add(
          streams[index].listen(
            (value) {
              values[index] = value;
              seen[index] = true;
              if (!out.isClosed && seen.every((v) => v)) out.add(List<T>.from(values));
            },
            onError: out.addError,
            onDone: () {
              completed++;
              if ((completed == streams.length || !seen[index]) && !out.isClosed) out.close();
            },
          ),
        );
      }
    },
    onCancel: () async {
      for (final subscription in subscriptions) {
        await subscription.cancel();
      }
    },
  );
  return out.stream;
}
