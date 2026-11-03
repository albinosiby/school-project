import 'package:driver_app/modules/students/models/student_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  BusStudent s(String id, String stop, int roll) => BusStudent(id: id, name: id, busStopId: stop, roll: roll);

  test('roster follows the bus stop order, not the stop id order', () {
    final roster = [s('a', 'stp_01', 2), s('b', 'stp_03', 1), s('c', 'stp_02', 5), s('d', 'stp_01', 1)];
    // the office moved stp_03 to the front of the route
    expect(inRouteOrder(roster, ['stp_03', 'stp_01', 'stp_02']).map((x) => x.id), ['b', 'd', 'a', 'c']);
  });

  test('children at an unknown stop come last, by roll', () {
    final roster = [s('x', 'gone', 3), s('y', 'stp_01', 9), s('z', '', 1)];
    expect(inRouteOrder(roster, ['stp_01']).map((x) => x.id), ['y', 'z', 'x']);
  });
}
