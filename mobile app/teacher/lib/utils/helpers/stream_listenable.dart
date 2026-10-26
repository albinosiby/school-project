import 'dart:async';
import 'package:flutter/foundation.dart';

/// Turns a stream into a [Listenable] (go_router `refreshListenable`): notifies on every event.
class StreamListenable extends ChangeNotifier {
  StreamListenable(Stream<dynamic> stream) {
    _sub = stream.listen((_) => notifyListeners());
  }
  late final StreamSubscription<dynamic> _sub;

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}
