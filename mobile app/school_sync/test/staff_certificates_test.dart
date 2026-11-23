import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_sync/modules/certificates/models/staff_certificate.dart';
import 'package:school_sync/modules/certificates/cubit/staff_certificates_cubit.dart';
import 'package:school_sync/school_sync.dart';

const issued = StaffCertificate(id: 'c1', title: 'Employment certificate', number: 'CERT-001', status: 'Issued', issuedOn: '2026-11-21');

class _Certificates implements IStaffCertificatesRepository {
  bool fail = false;
  int opened = 0;
  @override
  Future<List<StaffCertificate>> load() async {
    if (fail) throw const MobileSchoolException('Temporarily unavailable');
    return [issued];
  }

  @override
  Future<void> open(StaffCertificate certificate) async {
    opened++;
  }
}

void main() {
  test('certificate refresh retains loaded rows when the service fails', () async {
    final repo = _Certificates();
    final current = StaffCertificatesCubit(repo);
    await current.load();
    expect(current.state.rows.single.id, 'c1');
    repo.fail = true;
    await current.load();
    expect(current.state.rows.single.id, 'c1');
    expect(current.state.error, contains('unavailable'));
    await current.close();
  });
  testWidgets('official staff certificates fit a narrow phone and show the saved reference', (tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 700));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(MaterialApp(home: StaffCertificatesScreen(repository: _Certificates())));
    await tester.pumpAndSettle();
    expect(find.text('Employment certificate'), findsOneWidget);
    expect(find.textContaining('CERT-001'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  test('terms and senior class labels follow the school configuration', () {
    final policy = SchoolPolicy.fromJson({
      'academicYear': '2026-27',
      'terms': [
        {'name': 'Term 1', 'start': '2026-06-01', 'end': '2026-08-31'},
      ],
    });
    expect(policy.termWeekLabel(DateTime(2026, 6, 8)), 'Term 1 · Week 2');
    expect(policy.termWeekLabel(DateTime(2026, 11, 21)), 'AY 2026-27');
    expect(schoolClassLabel(grade: '11', section: 'A', classId: 'cls_11_course_home_science_A'), '11-Home Science-A');
  });
}
