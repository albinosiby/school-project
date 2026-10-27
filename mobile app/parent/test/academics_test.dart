import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:parent_app/config/routes/routes.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/modules/fees/bloc/fee_payment_bloc.dart';
import 'package:parent_app/modules/fees/models/fee_models.dart';
import 'package:parent_app/modules/fees/repositories/mock_fee_repository.dart';
import 'package:parent_app/modules/homework/models/homework_models.dart';
import 'package:parent_app/utils/exceptions/app_exception.dart';
import 'package:parent_app/utils/helpers/date_helper.dart';
import 'package:parent_app/utils/services/cache_service.dart';
import 'package:parent_app/utils/services/mock_latency.dart';

import 'helpers/pump_app.dart';

String _location(WidgetTester tester) {
  final config = GoRouter.of(
    tester.element(find.byType(Navigator).first),
  ).routerDelegate.currentConfiguration;
  final last = config.matches.last;
  return last is ImperativeRouteMatch
      ? last.matches.uri.toString()
      : config.uri.toString();
}

final _list = find.byKey(const Key('section-list'));

Future<void> _reveal(WidgetTester tester, Finder f) async {
  await tester.scrollUntilVisible(
    f,
    250,
    scrollable: find
        .descendant(of: _list, matching: find.byType(Scrollable))
        .first,
  );
  await tester.pumpAndSettle();
}

Finder _keyPrefix(String prefix) => find.byWidgetPredicate(
  (w) =>
      w.key is ValueKey<String> &&
      (w.key! as ValueKey<String>).value.startsWith(prefix),
);

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() async => setUpTestApp(signedIn: true));

  group('Academics tab', () {
    testWidgets(
      'defaults to Attendance: summary, calendar, day detail, leave',
      (tester) async {
        await pumpApp(tester, location: RoutePaths.academics);
        expect(find.text('ATTENDANCE STATUS'), findsOneWidget);
        expect(find.byKey(const Key('overall-percent')), findsOneWidget);
        expect(find.byKey(const Key('month-summary')), findsOneWidget);

        // Calendar: pick a day, page months back and forward.
        await _reveal(tester, find.byKey(const Key('day-1')));
        await _tap(tester, find.byKey(const Key('day-1')));
        expect(find.byKey(const Key('day-detail')), findsOneWidget);
        final month = tester
            .widget<Text>(find.byKey(const Key('month-title')))
            .data;
        await _tap(tester, find.byTooltip('Previous month'));
        expect(
          tester.widget<Text>(find.byKey(const Key('month-title'))).data,
          isNot(month),
        );
        expect(find.byKey(const Key('day-detail')), findsNothing);
        await _tap(tester, find.byTooltip('Next month'));
        expect(
          tester.widget<Text>(find.byKey(const Key('month-title'))).data,
          month,
        );

        // Absence log -> Apply leave.
        await _reveal(tester, find.text('Apply leave'));
        await _tap(tester, find.text('Apply leave'));
        expect(_location(tester), RoutePaths.leaveApply);
      },
    );

    testWidgets('segments switch sections through ?section=', (tester) async {
      await pumpApp(tester, location: RoutePaths.academics);
      for (final (label, name) in [
        ('Homework', 'homework'),
        ('Marks', 'marks'),
        ('Timetable', 'timetable'),
        ('Attendance', 'attendance'),
      ]) {
        await _tap(
          tester,
          find.descendant(
            of: find.byKey(const Key('academics-sections')),
            matching: find.text(label),
          ),
        );
        expect(_location(tester), RoutePaths.academicsSection(name));
      }
      expect(find.text('ATTENDANCE STATUS'), findsOneWidget);
    });

    testWidgets('Homework: filters, card -> detail, detail buttons', (
      tester,
    ) async {
      await pumpApp(tester, location: RoutePaths.academicsSection('homework'));
      expect(find.text('HOMEWORK TRACKER'), findsOneWidget);
      final hw = DemoData.homework(DemoData.aarav.id);
      final now = DateTime.now();
      for (final f in ['Pending', 'Overdue', 'Submitted', 'Reviewed', 'All']) {
        final chip = find.textContaining('$f (');
        final label = tester.widget<Text>(chip).data!;
        final n = int.parse(label.substring(f.length + 2, label.length - 1));
        if (f == 'All') expect(n, hw.length);
        await _tap(tester, chip);
        if (n == 0) {
          expect(find.text('No $f homework'), findsOneWidget);
        } else {
          expect(find.text('$n shown'), findsOneWidget);
        }
      }

      final pending = hw.firstWhere(
        (h) => h.statusAt(now).label == 'Pending',
        orElse: () => hw.first,
      );
      final card = find.byKey(Key('homework-${pending.id}'));
      await _reveal(tester, card);
      await _tap(tester, card);
      expect(_location(tester), RoutePaths.homework(pending.id));
      expect(find.text(pending.title), findsWidgets);
      expect(find.text('Instructions'), findsOneWidget);

      if (pending.attachments.isNotEmpty) {
        await _tap(tester, find.text(pending.attachments.first));
        expect(find.textContaining('downloaded'), findsOneWidget);
      }
      if (find.text('Remind me').evaluate().isNotEmpty) {
        await _tap(tester, find.text('Remind me'));
        expect(find.textContaining('Reminder set'), findsOneWidget);
      }
      await _tap(tester, find.text('Message teacher'));
      expect(_location(tester), RoutePaths.messages);
    });

    testWidgets('Homework detail back returns to the Academics tab', (
      tester,
    ) async {
      final id = DemoData.homework(DemoData.aarav.id).first.id;
      await pumpApp(tester, location: RoutePaths.homework(id));
      await _tap(tester, find.byTooltip('Back'));
      expect(_location(tester), RoutePaths.academicsSection('homework'));
    });

    testWidgets('Marks: latest result, report card, download, awaited exam', (
      tester,
    ) async {
      await pumpApp(tester, location: RoutePaths.academicsSection('marks'));
      expect(find.byKey(const Key('latest-percent')), findsOneWidget);
      final exams = DemoData.exams(DemoData.aarav.id);

      final awaited = exams.where((e) => !e.published);
      if (awaited.isNotEmpty) {
        final c = find.byKey(Key('exam-${awaited.first.id}'));
        await _reveal(tester, c);
        await _tap(tester, c);
        expect(
          find.textContaining('results will be published'),
          findsOneWidget,
        );
        for (final m in tester.stateList<ScaffoldMessengerState>(
          find.byType(ScaffoldMessenger),
        )) {
          m.clearSnackBars();
        }
        await tester.pumpAndSettle();
      }

      final done = exams.firstWhere((e) => e.published);
      final card = find.byKey(Key('exam-${done.id}'));
      await _reveal(tester, card);
      await _tap(tester, card);
      expect(_location(tester), RoutePaths.marks(done.id));
      expect(find.byKey(const Key('exam-total')), findsOneWidget);
      expect(find.text('Subject-wise marks'), findsOneWidget);
      await _reveal(tester, find.text('Download report card (PDF)'));
      await _tap(tester, find.text('Download report card (PDF)'));
      expect(find.textContaining('Report card saved'), findsOneWidget);
      await _tap(tester, find.byTooltip('Back'));
      expect(_location(tester), RoutePaths.academicsSection('marks'));

      // The latest-result hero opens its report card too.
      await tester.drag(_list, const Offset(0, 3000));
      await tester.pumpAndSettle();
      await _tap(tester, find.byKey(const Key('latest-percent')));
      expect(_location(tester), startsWith('/academics/marks/'));
    });

    testWidgets('Timetable: day strip switches the day', (tester) async {
      await pumpApp(tester, location: RoutePaths.academicsSection('timetable'));
      const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      for (var d = 1; d <= 5; d++) {
        await _tap(tester, find.byKey(Key('day-tile-$d')));
        expect(
          tester.widget<Text>(find.byKey(const Key('timetable-day'))).data,
          names[d - 1],
        );
        expect(find.textContaining('periods •'), findsOneWidget);
      }
      await _reveal(tester, find.text('Weekly load'));
      expect(find.textContaining('periods / week'), findsOneWidget);
    });
  });

  group('Fees tab', () {
    testWidgets('summary, invoice sheet, receipts, full pay flow', (
      tester,
    ) async {
      await pumpApp(tester, location: RoutePaths.fees);
      final fees = DemoData.fees(DemoData.aarav.id);
      expect(
        find.byTooltip('Back'),
        findsNothing,
      ); // a tab, not a pushed screen
      expect(find.text('TOTAL OUTSTANDING'), findsOneWidget);
      expect(
        _text(tester, find.byKey(const Key('fee-balance'))),
        inr(fees.balance),
      );
      expect(find.text('1 overdue'), findsOneWidget);

      // Invoice breakdown sheet -> pay this instalment -> select sheet preselects only it.
      final t2 = fees.invoices.firstWhere((i) => i.id.endsWith('_t2'));
      final bus = fees.invoices.firstWhere((i) => i.id.endsWith('_bus'));
      await _reveal(tester, find.byKey(Key('invoice-${t2.id}')));
      await _tap(tester, find.byKey(Key('invoice-${t2.id}')));
      expect(find.text('Pay this instalment'), findsOneWidget);
      await _tap(tester, find.byKey(const Key('pay-single')));
      expect(find.text('Select instalments'), findsOneWidget);
      expect(
        _text(tester, find.byKey(const Key('pay-total'))),
        inr(t2.balance),
      );
      // Unselect everything -> Continue disabled; dismiss.
      await _tap(tester, find.byKey(Key('pick-${t2.id}')));
      expect(
        tester
            .widget<FilledButton>(
              find.descendant(
                of: find.byKey(const Key('pay-continue')),
                matching: find.byType(FilledButton),
              ),
            )
            .onPressed,
        isNull,
      );
      await tester.tapAt(const Offset(200, 20));
      await tester.pumpAndSettle();
      expect(find.text('Select instalments'), findsNothing);

      // Receipts history: download icon + open receipt.
      final old = find.byKey(Key('receipt-rcpt_${fees.invoices.first.id}'));
      await _reveal(tester, old);
      await _tap(
        tester,
        find.descendant(of: old, matching: find.byTooltip('Download receipt')),
      );
      expect(find.textContaining('saved to Downloads'), findsOneWidget);
      await _tap(tester, old);
      expect(find.text('Fee receipt'), findsOneWidget);
      await _tap(tester, find.byKey(const Key('receipt-done')));

      // Pay Now: keep only the overdue bus fee, pay by card.
      await tester.drag(_list, const Offset(0, 3000));
      await tester.pumpAndSettle();
      await _tap(tester, find.byKey(const Key('pay-now')));
      expect(find.text('Select instalments'), findsOneWidget);
      expect(
        _text(tester, find.byKey(const Key('pay-total'))),
        inr(t2.balance + bus.balance),
      );
      await _tap(tester, find.byKey(Key('pick-${t2.id}')));
      expect(
        _text(tester, find.byKey(const Key('pay-total'))),
        inr(bus.balance),
      );
      await _tap(tester, find.byKey(const Key('pay-continue')));
      expect(find.text('Choose payment method'), findsOneWidget);
      await _tap(tester, find.byKey(const Key('method-card')));
      await _tap(tester, find.byKey(const Key('pay-confirm')));
      expect(find.text('Payment successful'), findsOneWidget);
      expect(
        _text(tester, find.byKey(const Key('receipt-amount'))),
        inr(bus.balance),
      );
      expect(find.textContaining('Debit / Credit card'), findsWidgets);
      await _tap(tester, find.byKey(const Key('receipt-download')));
      expect(find.textContaining('saved to Downloads'), findsOneWidget);
      await _tap(tester, find.byKey(const Key('receipt-done')));
      expect(find.text('Payment successful'), findsNothing);

      // Dues and history updated from the repository stream.
      expect(
        _text(tester, find.byKey(const Key('fee-balance'))),
        inr(fees.balance - bus.balance),
      );
      expect(find.text('1 overdue'), findsNothing);
      expect(find.byKey(Key('invoice-${bus.id}')), findsNothing);
      await _reveal(tester, find.text('Receipts history'));
      expect(find.text('2 receipts'), findsOneWidget);
      await _reveal(tester, _keyPrefix('receipt-rcpt_${DemoData.aarav.id}_'));
      expect(_keyPrefix('receipt-rcpt_${DemoData.aarav.id}_'), findsOneWidget);
    });
  });

  group('MockFeeRepository', () {
    setUp(() => MockLatency.delay = Duration.zero);

    test('pay settles the balance, adds a receipt and re-emits', () async {
      final repo = MockFeeRepository(CacheService());
      final id = DemoData.aarav.id;
      final before = await repo.watchFees(id).first;
      final bus = before.unpaid.firstWhere((i) => i.id.endsWith('_bus'));
      final r = await repo.pay(
        childId: id,
        invoiceIds: [bus.id],
        method: PaymentMethod.upi,
      );
      // Cached value first, then the fresh one with the payment applied.
      final after = await repo.watchFees(id).take(2).last;
      expect(r.amount, bus.balance);
      expect(after.balance, before.balance - bus.balance);
      expect(after.receipts.length, before.receipts.length + 1);
      expect(after.receipts.first, r);
      expect(await repo.downloadReceipt(r), r.fileName);
    });

    test('paying nothing payable throws', () async {
      final repo = MockFeeRepository(CacheService());
      expect(
        repo.pay(
          childId: DemoData.aarav.id,
          invoiceIds: const [],
          method: PaymentMethod.card,
        ),
        throwsA(isA<AppException>()),
      );
    });
  });

  group('FeePaymentBloc', () {
    setUp(() => MockLatency.delay = Duration.zero);

    test(
      'processing -> success with receipt; download bumps the counter',
      () async {
        final bloc = FeePaymentBloc(MockFeeRepository(CacheService()));
        final id = DemoData.aarav.id;
        final states = <FeePaymentState>[];
        final sub = bloc.stream.listen(states.add);
        bloc.add(
          FeePaymentSubmitted(
            childId: id,
            invoiceIds: ['inv_${id}_bus'],
            method: PaymentMethod.netBanking,
          ),
        );
        await bloc.stream.firstWhere((s) => s.status == PaymentStatus.success);
        expect(states.first.status, PaymentStatus.processing);
        expect(bloc.state.receipt!.method, PaymentMethod.netBanking);
        bloc.add(ReceiptDownloadRequested(bloc.state.receipt!));
        await bloc.stream.firstWhere((s) => s.downloadCount == 1);
        expect(bloc.state.downloaded, bloc.state.receipt!.fileName);
        await sub.cancel();
        await bloc.close();
      },
    );

    test('failure surfaces the message', () async {
      final bloc = FeePaymentBloc(MockFeeRepository(CacheService()));
      bloc.add(
        FeePaymentSubmitted(
          childId: DemoData.aarav.id,
          invoiceIds: const [],
          method: PaymentMethod.upi,
        ),
      );
      final s = await bloc.stream.firstWhere(
        (s) => s.status == PaymentStatus.failure,
      );
      expect(s.error, contains('Select at least one'));
      await bloc.close();
    });
  });
}

String _text(WidgetTester tester, Finder f) => tester.widget<Text>(f).data!;
