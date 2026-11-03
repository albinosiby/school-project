import 'dart:async';
import '../models/consent_models.dart';
import 'consent_repository_interface.dart';

/// Demo backend: the demo family has already given consent (so the demo flow is unchanged); edits stay in memory.
class MockConsentRepository implements IConsentRepository {
  MockConsentRepository() : _value = ConsentRecord(acceptedAt: DateTime(2026, 6, 1));

  /// A guardian who has not given consent yet (tests).
  MockConsentRepository.none() : _value = null;
  ConsentRecord? _value;
  final _changes = StreamController<ConsentRecord?>.broadcast();

  @override
  Stream<ConsentRecord?> watch() async* {
    yield _value;
    yield* _changes.stream;
  }

  @override
  Future<void> save({required bool photos, required bool notifications}) async {
    _value = ConsentRecord(
      photos: photos,
      notifications: notifications,
      acceptedAt: DateTime.now(),
    );
    _changes.add(_value);
  }

  @override
  Future<void> withdraw() async {
    _value = _value?.copyWith(withdrawn: true);
    _changes.add(_value);
  }
}
