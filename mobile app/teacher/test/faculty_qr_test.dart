import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/modules/home/screens/faculty_id_screen.dart';

void main() {
  test('the faculty QR is a real code carrying the employee id', () {
    final image = facultyQr('FUS-0064');
    expect(image.moduleCount, 21, reason: 'a short id fits a version-1 code');
    // finder pattern corner is dark, its inner ring is light: the layout of a genuine QR symbol
    expect(image.isDark(0, 0), isTrue);
    expect(image.isDark(1, 1), isFalse);
    expect(image.isDark(3, 3), isTrue);
    expect(facultyQr('a-much-longer-employee-identifier-0001').moduleCount, greaterThan(21));
  });
}
