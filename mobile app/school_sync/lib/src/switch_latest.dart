import 'dart:async';

/// Replace the old subscription on reassignment. Never emit an old bus/child result after a switch.
Stream<R> switchSchoolStream<S, R>(Stream<S> source, Stream<R> Function(S) build) {
  late StreamController<R> controller;
  StreamSubscription<S>? outer;
  StreamSubscription<R>? inner;
  var generation = 0, finished = false, active = false;
  void complete() {
    if (finished && !active && !controller.isClosed) controller.close();
  }

  controller = StreamController<R>(
    onListen: () {
      outer = source.listen(
        (value) {
          final ticket = ++generation;
          inner?.cancel();
          active = true;
          try {
            inner = build(value).listen(
              (result) {
                if (ticket == generation && !controller.isClosed) controller.add(result);
              },
              onError: (Object e, StackTrace s) {
                if (ticket == generation && !controller.isClosed) controller.addError(e, s);
              },
              onDone: () {
                if (ticket == generation) {
                  active = false;
                  complete();
                }
              },
            );
          } catch (e, s) {
            active = false;
            controller.addError(e, s);
            complete();
          }
        },
        onError: controller.addError,
        onDone: () {
          finished = true;
          complete();
        },
      );
    },
    onCancel: () async {
      generation++;
      await outer?.cancel();
      await inner?.cancel();
    },
  );
  return controller.stream;
}
