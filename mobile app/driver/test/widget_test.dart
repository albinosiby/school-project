import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/modules/auth/repositories/auth_repository.dart';
import 'package:driver_app/modules/auth/models/auth_models.dart';
import 'package:driver_app/modules/transport/repositories/trip_repository.dart';
import 'package:driver_app/modules/transport/models/trip_models.dart';

void main() {
  test('demo auth validates phone, verification, role and logout', () async {
    final r = DemoAuthRepository();
    await expectLater(r.requestCode('123'), throwsA(isA<AuthFailure>()));
    await r.requestCode('98765 43210');
    await expectLater(r.verify('000000'), throwsA(isA<AuthFailure>()));
    expect((await r.verify('482916')).authenticated, isTrue);
    expect((await r.chooseRole(CrewRole.assistant)).role, CrewRole.assistant);
    await r.signOut();
    await expectLater(
      r.chooseRole(CrewRole.driver),
      throwsA(isA<AuthFailure>()),
    );
  });
  test('trip requires checks, deduplicates boarding and verifies handover', () {
    final r = LocalTripRepository();
    expect(r.start, throwsStateError);
    r.check('door');
    r.check('panic');
    expect(r.start().status, TripStatus.active);
    r.board('student-1');
    r.board('student-1');
    expect(r.current.boarded.length, 1);
    expect(() => r.handover('student-1', '0000'), throwsStateError);
    expect(r.handover('student-1', '4092').handedOver, contains('student-1'));
    expect(r.finish().status, TripStatus.completed);
    r.clear();
    expect(r.current.status, TripStatus.scheduled);
  });
}
