import 'dart:async';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:firebase_auth_mocks/firebase_auth_mocks.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/modules/crew/repositories/firebase_crew_repository.dart';
import 'package:driver_app/utils/services/firebase/crew_session.dart';

void main() {
  test('crew reassignment changes context immediately and seats use the actual student roster', () async {
    final db = FakeFirebaseFirestore(), auth = MockFirebaseAuth(signedIn: true, mockUser: MockUser(uid: 'u1'));
    const root = 'schools/s1';
    await db.doc('users/u1').set({'schoolId': 's1', 'role': 'driver', 'crewId': 'crew1'});
    await db.doc('$root/tr_crew/crew1').set({'role': 'driver', 'busId': 'b1', 'name': 'Driver'});
    await db.doc('$root/tr_buses/b1').set({'number': '1', 'capacity': 36, 'totalSeats': 38, 'endPoint': 'Kannur'});
    await db.doc('$root/tr_buses/b2').set({'number': '2', 'capacity': 20, 'totalSeats': 22, 'endPoint': 'Town'});
    await db.doc('$root/students/kid').set({'busId': 'b1'});
    final session = CrewSession(db: db, auth: auth);
    await session.load();
    final iterator = StreamIterator(FirebaseCrewRepository(session).watchContext());
    expect(await iterator.moveNext(), true);
    expect(iterator.current.bus!.studentCount, 1);
    expect(iterator.current.bus!.availableSeats, 35);
    expect(iterator.current.bus!.totalSeats, 38);
    expect(iterator.current.bus!.endPoint, 'Kannur');
    await db.doc('$root/tr_crew/crew1').update({'busId': 'b2'});
    do {
      expect(await iterator.moveNext(), true);
    } while (iterator.current.bus?.id != 'b2');
    expect(iterator.current.bus!.availableSeats, 20);
    expect(iterator.current.bus!.endPoint, 'Town');
    await iterator.cancel();
  });
}
