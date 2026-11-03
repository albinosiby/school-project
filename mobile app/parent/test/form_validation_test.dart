import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/config/routes/routes.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/family/bloc/family_bloc.dart';
import 'package:parent_app/modules/fees/models/fee_models.dart';
import 'package:parent_app/modules/fees/repositories/fee_repository_interface.dart';
import 'package:parent_app/modules/fees/repositories/mock_fee_repository.dart';
import 'package:parent_app/modules/fees/screens/widgets/bank_transfer_flow.dart';
import 'package:parent_app/modules/leave/models/leave_models.dart';
import 'package:parent_app/modules/leave/repositories/leave_repository_interface.dart';
import 'package:parent_app/modules/messages/models/message_models.dart';
import 'package:parent_app/modules/messages/repositories/message_repository_interface.dart';
import 'package:parent_app/modules/profile/screens/edit_profile_screen.dart';
import 'package:parent_app/utils/helpers/date_helper.dart';
import 'package:parent_app/utils/services/cache_service.dart';
import 'helpers/pump_app.dart';

/// Field validation of the signed-in forms (apply leave, new message, chat, bank-transfer report, PTM booking,
/// certificate request, edit profile), driven on the real screens (mock backend). Every check asserts the exact
/// message the guardian sees, the limits on both sides of each boundary, and that a valid form reaches the repository.

// ---- helpers ------------------------------------------------------------------------------------

Finder _in(Key key) => find.descendant(of: find.byKey(key), matching: find.byType(TextFormField));

Future<void> _type(WidgetTester t, Finder f, String text) async {
  await _reveal(t, f);
  await t.ensureVisible(f);
  await t.pumpAndSettle();
  await t.enterText(f, text);
  await t.pump();
}

/// Builds [f] when a lazy list has not laid it out yet: from the top of the page's list, scroll down to it.
Future<void> _reveal(WidgetTester t, Finder f) async {
  if (f.evaluate().isNotEmpty) return;
  final list = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).first;
  t.state<ScrollableState>(list).position.jumpTo(0);
  await t.pumpAndSettle();
  await t.scrollUntilVisible(f, 250, scrollable: list);
  await t.pumpAndSettle();
}

/// [f] after [_reveal] (for expectations on messages further down a lazy list).
Future<Finder> _seen(WidgetTester t, Finder f) async {
  try {
    await _reveal(t, f);
  } on StateError {
    // not on the page: the expectation reports it
  }
  return f;
}

Future<void> _tap(WidgetTester t, Finder f) async {
  for (final m in t.stateList<ScaffoldMessengerState>(find.byType(ScaffoldMessenger))) {
    m.removeCurrentSnackBar();
  }
  await t.pump();
  await _reveal(t, f);
  await t.ensureVisible(f);
  await t.pumpAndSettle();
  await t.tap(f);
  await t.pumpAndSettle();
}

String _text(WidgetTester t, Finder editable) {
  final w = t.widget(editable);
  return w is TextFormField ? w.controller!.text : (w as TextField).controller!.text;
}

String get _childId => getIt<FamilyBloc>().state.selected!.id;

String _rep(int n, [String s = 'a']) => List.filled(n, s).join();

/// Opens the Material date picker of [box], switches it to text input and types [d] (en_US: MM/DD/YYYY).
/// Returns the picker's inline error, or null when the date was accepted and the dialog closed.
Future<String?> _pickDate(WidgetTester t, Finder box, DateTime d) async {
  await _tap(t, box);
  await t.tap(find.byTooltip('Switch to input'));
  await t.pumpAndSettle();
  final field = find.descendant(of: find.byType(Dialog), matching: find.byType(TextField));
  await t.enterText(field, '${d.month.toString().padLeft(2, '0')}/${d.day.toString().padLeft(2, '0')}/${d.year}');
  await t.tap(find.text('OK'));
  await t.pumpAndSettle();
  if (find.byType(Dialog).evaluate().isEmpty) return null;
  final error = [
    for (final s in ['Out of range.', 'Invalid format.'])
      if (find.text(s).evaluate().isNotEmpty) s,
  ].firstOrNull;
  await t.tap(find.text('Cancel'));
  await t.pumpAndSettle();
  return error ?? 'still open';
}

DateTime _nextWeekday(int weekday, {required DateTime after}) {
  var d = dateOnly(after).add(const Duration(days: 1));
  while (d.weekday != weekday) {
    d = DateTime(d.year, d.month, d.day + 1);
  }
  return d;
}

/// The date [n] school days (Mon-Fri) into a range that starts on the weekday [from].
DateTime _schoolDaysFrom(DateTime from, int n) {
  var d = from, count = 1;
  while (count < n) {
    d = DateTime(d.year, d.month, d.day + 1);
    if (d.weekday <= DateTime.friday) count++;
  }
  return d;
}

/// Mock fees with the school account published, so Pay Now opens the bank-transfer report form.
class _BankFees implements IFeeRepository {
  _BankFees() : _inner = MockFeeRepository(CacheService());
  final MockFeeRepository _inner;
  final reports = <Map<String, Object>>[];

  static const bank = BankDetails(accountName: 'Greenfield International School', accountNo: '50100123456789', ifsc: 'HDFC0001234', bank: 'HDFC Bank', branch: 'Saket', upiId: 'greenfield@hdfcbank');

  @override
  Stream<FeesData> watchFees(String childId) => _inner.watchFees(childId).map(
    (d) => FeesData(d.invoices, receipts: d.receipts, claims: d.claims, bank: bank),
  );

  @override
  Future<FeeReceipt> pay({required String childId, required List<String> invoiceIds, required PaymentMethod method}) =>
      _inner.pay(childId: childId, invoiceIds: invoiceIds, method: method);

  @override
  Future<PaymentClaim> reportPayment({
    required String childId,
    required String invoiceId,
    required double amount,
    required TransferMode mode,
    required String reference,
    required DateTime paidOn,
    String note = '',
  }) {
    reports.add({'invoiceId': invoiceId, 'amount': amount, 'mode': mode, 'reference': reference, 'paidOn': paidOn, 'note': note});
    return _inner.reportPayment(childId: childId, invoiceId: invoiceId, amount: amount, mode: mode, reference: reference, paidOn: paidOn, note: note);
  }

  @override
  Future<String> downloadReceipt(FeeReceipt receipt) => _inner.downloadReceipt(receipt);
}

void main() {
  setUp(() async => setUpTestApp(signedIn: true));

  // ---------------------------------------------------------------------------------- apply leave
  group('Apply Leave', () {
    final reason = find.byKey(const Key('leave-reason'));
    final submit = find.text('Submit Leave Application');
    final from = find.byKey(const Key('leave-from')), to = find.byKey(const Key('leave-to'));

    testWidgets('reason: required (blank / spaces), 300-character cap', (t) async {
      await pumpApp(t, location: RoutePaths.leaveApply);
      await _tap(t, submit);
      expect(await _seen(t, find.text('Please give a reason.')), findsOneWidget);

      await _type(t, reason, '   \n  ');
      await _tap(t, submit);
      expect(await _seen(t, find.text('Please give a reason.')), findsOneWidget);

      await _type(t, reason, _rep(301));
      expect(_text(t, reason).length, 300); // the field stops at 300 characters
      expect(find.text('300/300'), findsOneWidget);
    });

    testWidgets('dates: picker range, end before start, weekend only', (t) async {
      await pumpApp(t, location: RoutePaths.leaveApply);
      await _type(t, reason, 'Family function');

      // the picker offers today .. today + 180 days
      expect(await _pickDate(t, from, plusDays(-1)), 'Out of range.');
      expect(await _pickDate(t, from, plusDays(181)), 'Out of range.');
      expect(await _pickDate(t, to, plusDays(180)), isNull);
      expect(find.text(fmtDateShortForTest(plusDays(180))), findsOneWidget);

      // the start is in the future (next school day after tomorrow); an end of today is before it
      expect(await _pickDate(t, to, today()), isNull);
      await _tap(t, submit);
      expect(await _seen(t, find.text('The end date cannot be before the start date.')), findsOneWidget);
      expect(find.text('No school days'), findsOneWidget);

      final sat = _nextWeekday(DateTime.saturday, after: today());
      expect(await _pickDate(t, from, sat), isNull);
      expect(await _pickDate(t, to, sat.add(const Duration(days: 1))), isNull);
      await _tap(t, submit);
      expect(await _seen(t, find.text('Those dates fall on a weekend. Pick at least one school day.')), findsOneWidget);
    });

    testWidgets('balance: one day over the allowance is refused, exactly the allowance is sent', (t) async {
      await pumpApp(t, location: RoutePaths.leaveApply);
      final ov = (await t.runAsync(() => getIt<ILeaveRepository>().watchOverview(_childId).first))!;
      final left = ov.left(LeavePool.medical);
      expect(left, greaterThan(0));
      await _type(t, reason, 'Viral fever, doctor advised rest');

      final monday = _nextWeekday(DateTime.monday, after: today());
      expect(await _pickDate(t, from, monday), isNull);
      expect(await _pickDate(t, to, _schoolDaysFrom(monday, left + 1)), isNull);
      expect(find.text('${left + 1} Working Days'), findsOneWidget);
      await _tap(t, submit);
      expect(await _seen(t, find.text('Only $left medical leave day${left == 1 ? '' : 's'} left this year.')), findsOneWidget);

      expect(await _pickDate(t, to, _schoolDaysFrom(monday, left)), isNull);
      await _tap(t, submit);
      expect(find.text('Leave application sent to Mrs. Anita Sharma'), findsOneWidget);
      final sent = (await t.runAsync(() => getIt<ILeaveRepository>().watchLeaves(_childId).first))!.first;
      expect(dateOnly(sent.from), monday);
      expect(sent.type, LeaveType.medical);
      expect(sent.reason.trim(), 'Viral fever, doctor advised rest');
    });
  });

  // ---------------------------------------------------------------------------------- new message
  group('New message', () {
    final subject = find.byKey(const Key('new-message-subject'));
    final body = find.byKey(const Key('new-message-body'));
    final send = find.byKey(const Key('new-message-send'));

    testWidgets('recipient, subject and body: empty, too short, limits, then sent', (t) async {
      await pumpApp(t, location: RoutePaths.newMessage);
      await _tap(t, send);
      expect(find.text('Choose who to send this to'), findsOneWidget);
      expect(find.text('Add a subject'), findsOneWidget);
      expect(find.text('Write your message'), findsOneWidget);

      await _tap(t, find.byKey(ValueKey('faculty-ct_${_childId}_class')));
      await _type(t, subject, '   ');
      await _type(t, body, '        ');
      await _tap(t, send);
      expect(find.text('Choose who to send this to'), findsNothing);
      expect(find.text('Add a subject'), findsOneWidget);
      expect(find.text('Write your message'), findsOneWidget);

      await _type(t, subject, ' Fee ');  // 3 characters once trimmed
      await _type(t, body, ' 123456789 '); // 9 characters once trimmed
      await _tap(t, send);
      expect(find.text('Subject is too short'), findsOneWidget);
      expect(find.text('Please add a little more detail (10+ characters)'), findsOneWidget);

      await _type(t, subject, _rep(81, 'x'));
      expect(_text(t, subject).length, NewMessageRequest.subjectMax); // the field stops at 80
      await _type(t, body, _rep(NewMessageRequest.bodyMax + 1, 'b'));
      await _tap(t, send);
      expect(find.text('Subject is too short'), findsNothing);
      expect(find.text('Message is limited to 800 characters'), findsOneWidget);

      // minimum lengths are accepted: 4-character subject, 10-character body
      await _type(t, subject, 'Exam');
      await _type(t, body, '0123456789');
      await _tap(t, send);
      expect(find.byKey(const Key('chat-input')), findsOneWidget); // opened the new thread
      expect(find.textContaining('Exam'), findsWidgets);
    });

    test('request model: same rules as the form (max boundaries)', () {
      expect(NewMessageRequest.validateSubject(_rep(80)), isNull);
      expect(NewMessageRequest.validateSubject(_rep(81)), 'Keep the subject under 80 characters');
      expect(NewMessageRequest.validateBody(_rep(800)), isNull);
      expect(NewMessageRequest.validateBody('  ${_rep(800)}  '), isNull); // trimmed first
      expect(NewMessageRequest.validateBody(_rep(801)), 'Message is limited to 800 characters');
    });
  });

  // ---------------------------------------------------------------------------------- chat composer
  testWidgets('Chat composer: blank text is not sent, text is trimmed', (t) async {
    final thread = 'th_${DemoData.aarav.id}_ct';
    await pumpApp(t, location: RoutePaths.chatWith(thread));
    final repo = getIt<IMessageRepository>();
    Future<int> count() async => (await t.runAsync(() => repo.watchConversation(thread).first))!.messages.length;
    final before = await count();

    await t.enterText(find.byKey(const Key('chat-input')), '   ');
    await _tap(t, find.byKey(const Key('chat-send')));
    expect(await count(), before);

    await t.enterText(find.byKey(const Key('chat-input')), '  See you at the PTM  ');
    await _tap(t, find.byKey(const Key('chat-send')));
    expect(await count(), before + 1);
    expect(find.text('See you at the PTM'), findsOneWidget);
    expect(_text(t, find.byKey(const Key('chat-input'))), isEmpty);
  });

  // ---------------------------------------------------------------------------------- fee claim
  group('Bank transfer report (fee claim)', () {
    late _BankFees fees;
    setUp(() {
      fees = _BankFees();
      getIt
        ..unregister<IFeeRepository>()
        ..registerSingleton<IFeeRepository>(fees);
    });

    final amount = _in(const Key('claim-amount'));
    final reference = _in(const Key('claim-reference'));
    final submit = find.byKey(const Key('claim-submit'));

    Future<Invoice> open(WidgetTester t) async {
      await pumpApp(t, location: RoutePaths.fees);
      await _tap(t, find.byKey(const Key('pay-now')));
      expect(find.text('Pay to the school account'), findsOneWidget);
      expect(find.text('greenfield@hdfcbank'), findsOneWidget);
      await _tap(t, find.byKey(const Key('bank-paid')));
      expect(find.text('Enter payment details'), findsOneWidget);
      return DemoData.fees(_childId).unpaid.first;
    }

    testWidgets('amount: required, positive, numeric only, at most the balance', (t) async {
      final inv = await open(t);
      expect(_text(t, amount), inv.balance.toStringAsFixed(0)); // prefilled with the balance
      final due = 'More than the ${inr(inv.balance)} due on this instalment';

      for (final bad in ['', '0', '0.00', '-500', 'abc', '1e3', 'NaN', 'Infinity', '12.345', '₹500']) {
        await _type(t, amount, bad);
        await _tap(t, submit);
        expect(find.text('Enter the amount you paid'), findsOneWidget, reason: bad);
      }
      await _type(t, amount, (inv.balance + 1).toStringAsFixed(0));
      await _tap(t, submit);
      expect(find.text(due), findsOneWidget);
      await _type(t, amount, '${inv.balance.toStringAsFixed(0)}.01');
      await _tap(t, submit);
      expect(find.text(due), findsOneWidget);
      expect(fees.reports, isEmpty);

      // exactly the balance, with Indian digit grouping, is accepted
      await _type(t, amount, NumberFormatHelper.grouped(inv.balance));
      await _type(t, reference, '123456789012');
      await _tap(t, submit);
      expect(find.text('Enter payment details'), findsNothing);
      expect(fees.reports.single['amount'], inv.balance);
      expect(fees.reports.single['invoiceId'], inv.id);
      expect(find.text('${inr(inv.balance)} sent for verification. Your receipt appears here once the school office confirms it.'), findsOneWidget);
    });

    testWidgets('reference per mode: UPI 12 digits, cheque 6 digits, bank UTR 4-30 letters and digits', (t) async {
      await open(t);
      await _type(t, amount, '1');
      await _type(t, reference, '');
      await _tap(t, submit);
      expect(find.text('Enter the UPI transaction ID (UTR)'), findsOneWidget);
      for (final bad in ['12345678901', '1234567890123', 'ABCD12345678', '12345678901X']) {
        await _type(t, reference, bad);
        await _tap(t, submit);
        expect(find.text('A UPI transaction ID (UTR) has 12 digits'), findsOneWidget, reason: bad);
      }

      await _tap(t, find.text('Cheque').last);
      await _type(t, reference, '   ');
      await _tap(t, submit);
      expect(find.text('Enter the Cheque number'), findsOneWidget);
      for (final bad in ['12345', '1234567', '12345A']) {
        await _type(t, reference, bad);
        await _tap(t, submit);
        expect(find.text('A cheque number has 6 digits'), findsOneWidget, reason: bad);
      }

      await _tap(t, find.text('NEFT / IMPS / RTGS').last);
      await _type(t, reference, 'AB1');
      await _tap(t, submit);
      expect(find.text('Enter the UTR / transaction reference (4-30 characters)'), findsOneWidget);
      await _type(t, reference, _rep(31, '9'));
      await _tap(t, submit);
      expect(find.text('Enter the UTR / transaction reference (4-30 characters)'), findsOneWidget);
      await _type(t, reference, 'UTR#2026/11');
      await _tap(t, submit);
      expect(find.text('Use letters and numbers only'), findsOneWidget);
      expect(fees.reports, isEmpty);

      // 29 characters once spaces and dashes are removed: accepted, sent as the bank shows it
      await _type(t, reference, 'hdfc-r520 2611 0312 3456 7890 12345');
      await _tap(t, submit);
      expect(find.text('Enter payment details'), findsNothing);
      expect(fees.reports.single['mode'], TransferMode.bankTransfer);
      expect(fees.reports.single['reference'], 'HDFCR520261103123456789012345');
    });

    testWidgets('UPI reference with spaces, cash slip at the minimum length, note capped at 200', (t) async {
      await open(t);
      await _type(t, amount, '1,000');
      await _type(t, reference, '1234 5678 9012');
      final note = find.byWidgetPredicate((w) => w is TextField && w.maxLength == 200);
      await _type(t, note, _rep(201, 'n'));
      expect(_text(t, note).length, 200);
      await _tap(t, submit);
      expect(fees.reports.single['reference'], '123456789012');
      expect(fees.reports.single['amount'], 1000.0);
      expect(fees.reports.single['note'], _rep(200, 'n'));
      expect(dateOnly(fees.reports.single['paidOn']! as DateTime), today());

      await _tap(t, find.byKey(const Key('pay-now')));
      await _tap(t, find.byKey(const Key('bank-paid')));
      await _type(t, amount, '1');
      await _tap(t, find.text('Cash deposit at bank').last);
      await _type(t, reference, 'sl12');
      await _tap(t, submit);
      expect(fees.reports.last['reference'], 'SL12');
      expect(fees.reports.last['mode'], TransferMode.cashDeposit);
    });

    test('rupee parser and reference rules (unit)', () {
      expect(parseRupees('12,500'), 12500);
      expect(parseRupees(' 100.5 '), 100.5);
      expect(parseRupees('100.50'), 100.5);
      for (final bad in ['', '1e3', 'NaN', 'Infinity', '-1', '12.345', '1.2.3', '.5']) {
        expect(parseRupees(bad), isNull, reason: bad);
      }
      expect(validateReference(TransferMode.upi, '123456789012'), isNull);
      expect(validateReference(TransferMode.cheque, '000123'), isNull);
      expect(validateReference(TransferMode.cashDeposit, 'SL1'), 'Enter the Deposit slip number (4-30 characters)');
      expect(validateReference(TransferMode.cashDeposit, _rep(30, 'A')), isNull);
    });
  });

  // ---------------------------------------------------------------------------------- PTM booking
  group('PTM booking', () {
    final agenda = _in(const Key('ptm-agenda'));
    final confirm = find.text('Confirm Booking');
    const tooShort = 'Describe what you want to discuss (at least 10 characters).';

    testWidgets('teacher, slot and agenda: required, booked slots, 10-200 characters', (t) async {
      await pumpApp(t, location: RoutePaths.ptm);
      await _tap(t, find.text('Book a Meeting'));
      await _tap(t, confirm);
      expect(find.text('Choose a teacher.'), findsOneWidget);
      expect(find.text(tooShort), findsOneWidget);

      await _tap(t, find.byKey(const Key('ptm-teacher')));
      await _tap(t, find.text('Mr. Imran Khan').last);
      await _tap(t, confirm);
      expect(find.text('Choose a teacher.'), findsNothing);
      expect(find.text('Choose a time slot.'), findsOneWidget);

      // a slot another parent booked cannot be chosen
      await t.tap(find.text('Booked').first, warnIfMissed: false);
      await t.pumpAndSettle();
      expect(find.text('SUMMARY'), findsNothing);
      final free = find.byWidgetPredicate((w) => w is Semantics && w.properties.enabled == true && w.properties.button == true && (w.properties.label ?? '').endsWith('PM'));
      await _tap(t, free.first);
      expect(find.text('SUMMARY'), findsOneWidget);

      await _type(t, agenda, '          ');
      await _tap(t, confirm);
      expect(find.text('Choose a time slot.'), findsNothing);
      expect(find.text(tooShort), findsOneWidget);
      await _type(t, agenda, '  Marks?? ');  // 8 characters once trimmed
      await _tap(t, confirm);
      expect(find.text(tooShort), findsOneWidget);
      await _type(t, agenda, '123456789'); // 9
      await _tap(t, confirm);
      expect(find.text(tooShort), findsOneWidget);

      await _type(t, agenda, _rep(201, 'p'));
      expect(_text(t, agenda).length, 200);

      await _type(t, agenda, 'Fee review'); // exactly 10
      await _tap(t, confirm);
      expect(find.textContaining('Meeting booked with Mr. Imran Khan'), findsOneWidget);
    });
  });

  // ---------------------------------------------------------------------------------- certificates
  group('Certificate request', () {
    final purpose = _in(const Key('cert-purpose'));
    final submit = find.text('Submit Request');
    const short = 'Tell the office what it is for (at least 5 characters).';

    testWidgets('type required, purpose 5-120 characters (trimmed), then requested', (t) async {
      await pumpApp(t, location: RoutePaths.certificates);
      await _tap(t, find.text('Request a Certificate'));
      await _tap(t, submit);
      expect(find.text('Choose the certificate you need.'), findsOneWidget);
      expect(find.text(short), findsOneWidget);

      await _tap(t, find.byKey(const Key('cert-type')));
      await _tap(t, find.text('Bonafide Certificate').last);
      await _type(t, purpose, '     ');
      await _tap(t, submit);
      expect(find.text('Choose the certificate you need.'), findsNothing);
      expect(find.text(short), findsOneWidget);

      await _type(t, purpose, '  Visa  '); // 4 once trimmed
      await _tap(t, submit);
      expect(find.text(short), findsOneWidget);

      await _type(t, purpose, _rep(121, 'q'));
      expect(_text(t, purpose).length, 120);

      await _type(t, purpose, 'Visas'); // exactly 5
      await _tap(t, submit);
      expect(find.textContaining('Bonafide Certificate requested'), findsOneWidget);
    });
  });

  // ---------------------------------------------------------------------------------- edit profile
  group('Edit profile', () {
    final name = _in(const ValueKey('edit-name'));
    final phone = _in(const ValueKey('edit-phone'));
    final email = _in(const ValueKey('edit-email'));
    final address = _in(const ValueKey('edit-address'));
    final eName = _in(const ValueKey('edit-emergency-name'));
    final ePhone = _in(const ValueKey('edit-emergency-phone'));
    final save = find.text('Save profile changes');

    testWidgets('required fields, lengths, letters, mobile formats, email, emergency number', (t) async {
      await pumpApp(t, location: RoutePaths.editProfile);

      for (final f in [name, phone, email, address, eName, ePhone]) {
        await _type(t, f, '  ');
      }
      await _tap(t, save);
      expect(find.text('Please fix the highlighted fields'), findsOneWidget);
      await t.ensureVisible(name);
      expect(find.text('Full name is required'), findsNWidgets(2)); // guardian + emergency contact
      expect(find.text('Mobile number is required'), findsNWidgets(2));
      expect(find.text('Email is required'), findsOneWidget);
      expect(find.text('Address is required'), findsOneWidget);

      await _type(t, name, 'Al');
      await _type(t, eName, 'R2-D2');
      await _type(t, phone, '98765 4321'); // 9 digits
      await _type(t, email, 'rajesh@example');
      await _type(t, address, 'Sector 14'); // 9 characters
      await _type(t, ePhone, '5876543210'); // not a mobile prefix
      await _tap(t, save);
      expect(find.text('Enter your full name'), findsOneWidget);
      expect(find.text('Use letters only'), findsOneWidget);
      expect(find.text('Enter a valid 10-digit mobile number'), findsNWidgets(2));
      expect(find.text('Enter a valid email address'), findsOneWidget);
      expect(find.text('Enter your full address'), findsOneWidget);

      await _type(t, name, 'Ali'); // 3: the minimum
      await _type(t, eName, "Mrs. Priya D'Souza-Sharma");
      await _type(t, phone, '+91 98765 432101'); // 11 digits
      await _type(t, address, 'Sector 14A'); // 10: the minimum
      await _type(t, email, 'rajesh.sharma@example.com');
      await _type(t, ePhone, '0 98765 43210'); // same number as the guardian, written differently
      await _tap(t, save);
      expect(find.text('Enter your full name'), findsNothing);
      expect(find.text('Use letters only'), findsNothing);
      expect(find.text('Enter your full address'), findsNothing);
      expect(find.text('Enter a valid email address'), findsNothing);
      expect(find.text('Enter a valid 10-digit mobile number'), findsOneWidget);

      await _type(t, phone, '098765-43210');
      await _tap(t, save);
      expect(find.text('Enter a valid 10-digit mobile number'), findsNothing);
      expect(find.text('Use a different number from your own'), findsOneWidget);

      await _type(t, ePhone, '6000000000'); // lowest valid mobile number
      await _tap(t, save);
      expect(find.text('Profile updated'), findsOneWidget);
      final g = getIt<FamilyBloc>().state.guardian!;
      expect(g.name, 'Ali');
      expect(g.phone, '+91 98765 43210'); // normalised
      expect(g.email, 'rajesh.sharma@example.com');
    });

    test('mobile normaliser', () {
      expect(normalizeIndianMobile('9876543210'), '+91 98765 43210');
      expect(normalizeIndianMobile('+91 98765-43210'), '+91 98765 43210');
      expect(normalizeIndianMobile('(0)9876543210'), '+91 98765 43210');
      expect(normalizeIndianMobile('5876543210'), isNull);
      expect(normalizeIndianMobile('987654321'), isNull);
      expect(normalizeIndianMobile('+1 9876543210'), isNull);
    });
  });
}

String fmtDateShortForTest(DateTime d) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${days[d.weekday - 1]}, ${d.day.toString().padLeft(2, '0')} ${months[d.month - 1]}';
}

/// "12,500" style grouping (en_IN) without the currency symbol.
class NumberFormatHelper {
  static String grouped(double v) => inr(v).replaceAll('₹', '').trim();
}
