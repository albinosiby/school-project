import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:firebase_auth_mocks/firebase_auth_mocks.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/bloc/child_data_bloc.dart' show LoadStatus;
import 'package:parent_app/design_system/design_system.dart';
import 'package:parent_app/modules/consent/bloc/consent_bloc.dart';
import 'package:parent_app/modules/consent/repositories/firebase_consent_repository.dart';
import 'package:parent_app/modules/consent/repositories/mock_consent_repository.dart';
import 'package:parent_app/modules/consent/screens/widgets/consent_sheet.dart';
import 'package:parent_app/utils/services/firebase/parent_session.dart';

/// Guardian consent (data contract 13.3): `consents/{uid}` written at first sign-in, read by the admin web's consent state.
void main() {
  // a hang in a stream wait should fail fast, not block the suite
  const t30 = Timeout(Duration(seconds: 30));
  group('FirebaseConsentRepository', () {
    late FakeFirebaseFirestore db;
    late ParentSession session;
    const sid = 'sch_1', uid = 'par_1';

    setUp(() async {
      db = FakeFirebaseFirestore();
      session = ParentSession(db: db, auth: MockFirebaseAuth(signedIn: true, mockUser: MockUser(uid: uid, email: 'p@x.com')));
      await db.doc('users/$uid').set({'schoolId': sid, 'role': 'parent', 'studentIds': ['stu_101', 'stu_201'], 'classIds': ['cls_10B'], 'grns': []});
      await session.load();
    });

    test('no doc means no consent yet', () async {
      expect(await FirebaseConsentRepository(session).watch().first, isNull);
    });

    test('save writes the contract shape the admin web reads', () async {
      await FirebaseConsentRepository(session).save(photos: false, notifications: true);
      final d = (await db.doc('schools/$sid/consents/$uid').get()).data()!;
      expect(d['uid'], uid);
      expect(d['studentIds'], ['stu_101', 'stu_201']);
      expect(d['version'], ConsentRecord.currentVersion);
      expect(d['items'], {'dataProcessing': true, 'photos': false, 'notifications': true});
      expect(d['withdrawn'], false);
      expect(d['acceptedAt'], isA<String>());
      final r = await FirebaseConsentRepository(session).watch().first;
      expect(r!.isCurrent, isTrue);
      expect(r.photos, isFalse);
    });

    test('withdraw keeps the record and marks it withdrawn', () async {
      final repo = FirebaseConsentRepository(session);
      await repo.save(photos: true, notifications: true);
      await repo.withdraw();
      final d = (await db.doc('schools/$sid/consents/$uid').get()).data()!;
      expect(d['withdrawn'], true);
      expect(d['uid'], uid);
      expect((await repo.watch().first)!.isCurrent, isFalse);
    });

    test('an older consent version counts as not current', () async {
      await db.doc('schools/$sid/consents/$uid').set({'uid': uid, 'version': '2025-01', 'items': {'dataProcessing': true}});
      expect((await FirebaseConsentRepository(session).watch().first)!.isCurrent, isFalse);
    });
  });

  group('ConsentBloc', () {
    test('loads none -> needsConsent; save -> current; withdraw -> needs again', timeout: t30, () async {
      final bloc = ConsentBloc(MockConsentRepository.none());
      bloc.add(const LoadConsent());
      await bloc.stream.firstWhere((s) => s.status == LoadStatus.loaded);
      expect(bloc.state.needsConsent, isTrue);
      bloc.add(const SaveConsent(photos: true, notifications: false));
      await bloc.stream.firstWhere((s) => !s.saving && s.record != null);
      expect(bloc.state.needsConsent, isFalse);
      expect(bloc.state.record!.notifications, isFalse);
      bloc.add(const WithdrawConsent());
      await bloc.stream.firstWhere((s) => !s.saving && (s.record?.withdrawn ?? false));
      expect(bloc.state.needsConsent, isTrue);
      await bloc.close();
    });

    test('the demo family has given consent, so the demo flow is not interrupted', timeout: t30, () async {
      final bloc = ConsentBloc(MockConsentRepository())..add(const LoadConsent());
      await bloc.stream.firstWhere((s) => s.status == LoadStatus.loaded);
      expect(bloc.state.needsConsent, isFalse);
      await bloc.close();
    });
  });

  group('ConsentGate', () {
    // timed pumps: the sheet's route animation and the busy spinner keep pumpAndSettle from settling
    Future<void> settle(WidgetTester t) async {
      for (var i = 0; i < 20; i++) {
        await t.pump(const Duration(milliseconds: 100));
      }
    }

    Future<ConsentBloc> pump(WidgetTester t, ConsentBloc bloc) async {
      t.view.physicalSize = const Size(402, 874);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final old = FlutterError.onError;
      FlutterError.onError = (d) { if (!d.exceptionAsString().contains('overflowed')) old?.call(d); };
      addTearDown(() => FlutterError.onError = old);
      await t.pumpWidget(ScreenUtilInit(
        designSize: const Size(402, 874),
        builder: (_, _) => MaterialApp(home: BlocProvider.value(value: bloc, child: const ConsentGate(child: Scaffold(body: Text('home'))))),
      ));
      bloc.add(const LoadConsent());
      await settle(t);
      return bloc;
    }

    testWidgets('asks once when there is no consent and saves the optional choices', (t) async {
      final repo = MockConsentRepository.none();
      final bloc = await pump(t, ConsentBloc(repo));
      expect(find.text('Your consent'), findsOneWidget);
      // data processing is required: its switch does not turn off
      await t.tap(find.descendant(of: find.byKey(const Key('consent-data')), matching: find.byType(Switch)));
      await t.pump();
      expect(t.widget<Switch>(find.descendant(of: find.byKey(const Key('consent-data')), matching: find.byType(Switch))).value, isTrue);
      await t.tap(find.descendant(of: find.byKey(const Key('consent-photos')), matching: find.byType(Switch)));
      await t.pump();
      await t.tap(find.byKey(const Key('consent-submit')));
      await settle(t);
      expect(find.text('Your consent'), findsNothing, reason: 'sheet closes after saving');
      expect(bloc.state.record!.photos, isTrue);
      expect(bloc.state.record!.notifications, isTrue);
      // not closed: its demo consent stream never ends and close() would wait on it under the test clock
    });

    testWidgets('does not ask when consent is already recorded', (t) async {
      await pump(t, ConsentBloc(MockConsentRepository()));
      expect(find.text('Your consent'), findsNothing);
      expect(find.text('home'), findsOneWidget);
      // not closed: its demo consent stream never ends and close() would wait on it under the test clock
    });
  });
}
