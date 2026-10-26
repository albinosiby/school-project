import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/modules/school/bloc/school_bloc.dart';
import 'package:teacher_app/modules/school/bloc/school_events.dart';
import 'package:teacher_app/modules/school/bloc/school_states.dart';
import 'package:teacher_app/modules/showcase/screens/showcase_screen.dart';
import 'package:teacher_app/modules/tasks/models/homework_models.dart';
import 'package:teacher_app/modules/tasks/repositories/homework_repository_interface.dart';
import 'package:teacher_app/utils/services/local_database_service.dart';
import 'helpers/pump_app.dart';

void main() {
  setUp(setUpTestApp);

  test('school bloc loads and reacts to changes', () async {
    final bloc = getIt<SchoolBloc>()..add(const SchoolLoadRequested());
    await expectLater(bloc.stream, emitsThrough(predicate<SchoolState>((s) => s.status == SchoolStatus.loaded && s.classes.length == 4)));
    expect(bloc.state.studentsOf('cls_10B').length, 42);
    getIt<LocalDatabaseService>().setDoc('me', {'name': 'Mrs. Test'});
    await expectLater(bloc.stream, emitsThrough(predicate<SchoolState>((s) => s.teacher?.name == 'Mrs. Test')));
    await bloc.close();
  });

  test('homework repository creates with pending submissions for the class', () async {
    final repo = getIt<IHomeworkRepository>();
    final hw = await repo.create(const Homework(id: '', classId: 'cls_9A', title: 'T', subject: 'Science', due: '2026-11-01', maxMarks: 10, createdAt: '2026-10-24'));
    expect(hw.submissions.length, 38);
    expect(hw.count(SubmissionStatus.pending), 38);
  });

  testWidgets('design system showcase renders', (tester) async {
    await pumpScreen(tester, screen: const ShowcaseScreen());
    expect(find.text('Design System'), findsOneWidget);
  });
}
