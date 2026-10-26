import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/bloc/child_data_bloc.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/attendance/bloc/attendance_bloc.dart';
import 'package:parent_app/modules/family/bloc/family_bloc.dart';
import 'package:parent_app/modules/homework/bloc/homework_bloc.dart';
import 'helpers/pump_app.dart';

void main() {
  group('FamilyBloc', () {
    test('loads Mr. Rajesh Sharma with Aarav selected', () async {
      await setUpTestApp(signedIn: true);
      final bloc = getIt<FamilyBloc>()..add(const LoadFamily());
      final s = await bloc.stream.firstWhere(
        (s) => s.status == LoadStatus.loaded,
      );
      expect(s.guardian?.name, 'Mr. Rajesh Sharma');
      expect(s.children.map((c) => c.firstName), ['Aarav', 'Ananya']);
      expect(s.children.map((c) => c.className), ['10-B', '8-C']);
      expect(s.selected?.id, DemoData.aarav.id);
    });

    test(
      'SelectChild switches the selected child; unknown ids are ignored',
      () async {
        await setUpTestApp(signedIn: true);
        final bloc = getIt<FamilyBloc>()..add(const LoadFamily());
        await bloc.stream.firstWhere((s) => s.status == LoadStatus.loaded);
        bloc.add(SelectChild(DemoData.ananya.id));
        expect(
          (await bloc.stream.firstWhere(
            (s) => s.selected?.id == DemoData.ananya.id,
          )).selected?.name,
          'Ananya Sharma',
        );
        bloc.add(const SelectChild('nope'));
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.selected?.id, DemoData.ananya.id);
      },
    );
  });

  group('child scoped data', () {
    test('homework differs per child and loads cache-first', () async {
      await setUpTestApp(signedIn: true);
      final a = getIt<HomeworkBloc>()..add(LoadChildData(DemoData.aarav.id));
      final sa = await a.stream.firstWhere((s) => s.hasData);
      final n = getIt<HomeworkBloc>()..add(LoadChildData(DemoData.ananya.id));
      final sn = await n.stream.firstWhere((s) => s.hasData);
      expect(sa.data!.map((h) => h.id), isNot(sn.data!.map((h) => h.id)));
      expect(sa.childId, DemoData.aarav.id);
      expect(sn.childId, DemoData.ananya.id);
    });

    test('switching child on one bloc drops the previous child data', () async {
      await setUpTestApp(signedIn: true);
      final bloc = getIt<AttendanceBloc>()
        ..add(LoadChildData(DemoData.aarav.id));
      await bloc.stream.firstWhere(
        (s) => s.hasData && s.childId == DemoData.aarav.id,
      );
      bloc.add(LoadChildData(DemoData.ananya.id));
      final s = await bloc.stream.firstWhere(
        (s) => s.childId == DemoData.ananya.id && s.hasData,
      );
      expect(
        s.data!.on(DateTime.now()),
        isNull,
      ); // Ananya is "not marked yet" today
    });
  });

  group('child switcher UI', () {
    testWidgets('tapping Ananya changes the Today header and class', (t) async {
      await setUpTestApp(signedIn: true);
      await pumpApp(t);
      expect(find.textContaining('for Aarav - Grade 10-B'), findsOneWidget);

      await t.tap(find.byKey(ValueKey('child-chip-${DemoData.ananya.id}')));
      await t.pumpAndSettle();
      expect(find.textContaining('for Ananya - Grade 8-C'), findsOneWidget);
      expect(find.textContaining('for Aarav'), findsNothing);
    });

    testWidgets('selection carries to other tabs', (t) async {
      await setUpTestApp(signedIn: true);
      await pumpApp(t);
      await t.tap(find.byKey(ValueKey('child-chip-${DemoData.ananya.id}')));
      await t.pumpAndSettle();
      await t.tap(find.text('Learn'));
      await t.pumpAndSettle();
      // Ananya's homework, not Aarav's.
      expect(find.text('Linear equations worksheet'), findsOneWidget);
      expect(find.text('Quadratic equations - Exercise 4.2'), findsNothing);
    });
  });
}
