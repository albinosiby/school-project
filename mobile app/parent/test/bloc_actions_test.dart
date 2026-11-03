import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/attendance/models/attendance_models.dart';
import 'package:parent_app/modules/attendance/repositories/attendance_repository_interface.dart';
import 'package:parent_app/modules/auth/bloc/registration_bloc.dart' as reg;
import 'package:parent_app/modules/auth/repositories/firebase_registration_repository.dart';
import 'package:parent_app/modules/family/bloc/family_bloc.dart';
import 'package:parent_app/modules/family/models/family_models.dart';
import 'package:parent_app/modules/family/repositories/family_repository_interface.dart';
import 'package:parent_app/modules/fees/bloc/fee_payment_bloc.dart';
import 'package:parent_app/modules/fees/models/fee_models.dart';
import 'package:parent_app/modules/fees/repositories/fee_repository_interface.dart';
import 'package:parent_app/modules/leave/bloc/leave_apply_bloc.dart';
import 'package:parent_app/modules/leave/models/leave_models.dart';
import 'package:parent_app/modules/leave/repositories/leave_repository_interface.dart';
import 'package:parent_app/modules/messages/bloc/chat_bloc.dart';
import 'package:parent_app/modules/messages/bloc/new_message_bloc.dart';
import 'package:parent_app/modules/messages/models/message_models.dart';
import 'package:parent_app/modules/messages/repositories/message_repository_interface.dart';
import 'package:parent_app/modules/notifications/bloc/notifications_bloc.dart';
import 'package:parent_app/modules/notifications/models/notification_models.dart';
import 'package:parent_app/modules/notifications/repositories/notification_repository_interface.dart';
import 'package:parent_app/modules/profile/bloc/profile_bloc.dart';
import 'package:parent_app/modules/profile/models/guardian_profile.dart';
import 'package:parent_app/modules/profile/repositories/profile_repository_interface.dart';
import 'package:parent_app/modules/ptm/bloc/ptm_action_bloc.dart';
import 'package:parent_app/modules/ptm/bloc/ptm_events.dart';
import 'package:parent_app/modules/ptm/bloc/ptm_states.dart';
import 'package:parent_app/modules/ptm/models/ptm_models.dart';
import 'package:parent_app/modules/ptm/repositories/ptm_repository_interface.dart';
import 'package:parent_app/modules/settings/bloc/settings_bloc.dart';
import 'package:parent_app/modules/settings/models/app_settings.dart';
import 'package:parent_app/modules/settings/repositories/settings_repository_interface.dart';
import 'package:parent_app/modules/student/bloc/certificate_action_bloc.dart';
import 'package:parent_app/modules/student/bloc/student_events.dart';
import 'package:parent_app/modules/student/bloc/student_states.dart';
import 'package:parent_app/modules/student/models/certificate_models.dart';
import 'package:parent_app/modules/student/repositories/student_repository_interface.dart';
import 'package:parent_app/utils/exceptions/app_exception.dart';
import 'helpers/pump_app.dart';

/// Module (BLoC-level) tests for the BLoCs that load a single stream (family, profile, settings, notifications,
/// chat, new message) and the write BLoCs (leave, PTM, certificates, fees, registration): loading -> loaded,
/// cache-first then fresh, error only without cache, every write with its arguments, success / failure states and
/// the exact error text. Repositories are hand-written fakes.

Future<void> _tick() => Future<void>.delayed(const Duration(milliseconds: 5));

AppException _err(String m) => AppException(message: m);

/// A school day (Monday) a week from now, so weekday rules are deterministic.
DateTime _monday() {
  var d = DateTime.now().add(const Duration(days: 7));
  while (d.weekday != DateTime.monday) {
    d = d.add(const Duration(days: 1));
  }
  return DateTime(d.year, d.month, d.day);
}

// ---------------------------------------------------------------- fakes

class _Family implements IFamilyRepository {
  final controller = StreamController<Family>();
  @override
  Stream<Family> watchFamily() => controller.stream;
}

class _Settings implements ISettingsRepository {
  final controller = StreamController<AppSettings>();
  final saved = <AppSettings>[];
  Object? failWith;
  @override
  Stream<AppSettings> watchSettings() => controller.stream;
  @override
  Future<void> save(AppSettings settings) async {
    if (failWith != null) throw failWith!;
    saved.add(settings);
  }
}

class _Notifications implements INotificationRepository {
  final controller = StreamController<List<AppNotification>>();
  final log = <String>[];
  Object? deleteFails;
  @override
  Stream<List<AppNotification>> watchNotifications() => controller.stream;
  @override
  Stream<int> watchUnreadCount() => const Stream.empty();
  @override
  Future<void> markRead(String id) async => log.add('read:$id');
  @override
  Future<void> markAllRead() async => log.add('readAll');
  @override
  Future<void> delete(String id) async {
    if (deleteFails != null) throw deleteFails!;
    log.add('delete:$id');
  }

  @override
  Future<void> acknowledge(String id) async => log.add('ack:$id');
}

class _Profile implements IProfileRepository {
  final controller = StreamController<GuardianProfile>();
  final saved = <GuardianProfile>[];
  final photos = <int?>[];
  Object? saveFails;
  @override
  Stream<GuardianProfile> watchProfile() => controller.stream;
  @override
  Future<void> updateProfile(GuardianProfile profile) async {
    if (saveFails != null) throw saveFails!;
    saved.add(profile);
  }

  @override
  Future<void> setPhoto(int? style) async => photos.add(style);
}

class _Attendance implements IAttendanceRepository {
  final Map<String, Object> byChild = {}; // AttendanceData or an error
  @override
  Stream<AttendanceData> watchAttendance(String childId) {
    final v = byChild[childId];
    return v is AttendanceData ? Stream.value(v) : Stream.error(v ?? _err('none'));
  }
}

class _Messages implements IMessageRepository {
  final conversations = <String, StreamController<Conversation>>{};
  final contacts = StreamController<List<MessageContact>>();
  final log = <String>[];
  final sent = <(String, String, List<MessageAttachment>)>[];
  final started = <NewMessageRequest>[];
  final drafts = <String, MessageDraft>{};
  Object? sendFails, startFails, draftFails;

  @override
  Stream<Conversation> watchConversation(String threadId) =>
      (conversations[threadId] ??= StreamController<Conversation>()).stream;
  @override
  Stream<List<MessageContact>> watchContacts(String childId) {
    log.add('contacts:$childId');
    return contacts.stream;
  }

  @override
  Future<void> markRead(String threadId) async => log.add('read:$threadId');
  @override
  Future<void> send(String threadId, String text, {List<MessageAttachment> attachments = const []}) async {
    if (sendFails != null) throw sendFails!;
    sent.add((threadId, text, attachments));
  }

  @override
  Future<MessageThread> startThread(NewMessageRequest request) async {
    if (startFails != null) throw startFails!;
    started.add(request);
    return _thread('thr_${request.childId}_${request.contactId}');
  }

  @override
  Future<MessageDraft?> draft(String draftId) async => drafts[draftId];
  @override
  Future<MessageDraft> saveDraft(MessageDraft draft) async {
    if (draftFails != null) throw draftFails!;
    final d = MessageDraft(id: 'dr_saved', childId: draft.childId, updatedAt: draft.updatedAt, body: draft.body);
    drafts[d.id] = d;
    return d;
  }

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Leave implements ILeaveRepository {
  final applied = <Map<String, Object?>>[];
  Object? fails;
  @override
  Future<LeaveRequest> apply({
    required String childId,
    required DateTime from,
    required DateTime to,
    required String reason,
    LeaveType type = LeaveType.other,
    String? attachment,
  }) async {
    if (fails != null) throw fails!;
    applied.add({'childId': childId, 'from': from, 'to': to, 'reason': reason, 'type': type, 'attachment': attachment});
    return LeaveRequest(id: 'lv_1', childId: childId, from: from, to: to, reason: reason, appliedOn: DateTime.now(), type: type);
  }

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Ptm implements IPtmRepository {
  _Ptm(this.meeting);
  final Meeting meeting;
  final log = <String>[];
  Object? fails;
  @override
  Future<Meeting> book({
    required String childId,
    required String teacherId,
    required String slotId,
    required MeetingMode mode,
    required String agenda,
  }) async {
    if (fails != null) throw fails!;
    log.add('book:$childId:$teacherId:$slotId:${mode.name}:$agenda');
    return meeting;
  }

  @override
  Future<Meeting> reschedule({required String childId, required String meetingId, required String slotId}) async {
    if (fails != null) throw fails!;
    log.add('reschedule:$childId:$meetingId:$slotId');
    return meeting;
  }

  @override
  Future<void> cancel({required String childId, required String meetingId}) async {
    if (fails != null) throw fails!;
    log.add('cancel:$childId:$meetingId');
  }

  @override
  Future<void> recordJoin({required String childId, required String meetingId}) async {
    log.add('join:$childId:$meetingId');
    if (fails != null) throw fails!;
  }

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Student implements IStudentRepository {
  _Student(this.certificate);
  final Certificate certificate;
  final log = <String>[];
  Object? fails;
  @override
  Future<Certificate> recordDownload({required String childId, required String certificateId}) async {
    if (fails != null) throw fails!;
    log.add('download:$childId:$certificateId');
    return certificate;
  }

  @override
  Future<Certificate> requestCertificate({
    required String childId,
    required CertificateRequestType type,
    required String purpose,
  }) async {
    if (fails != null) throw fails!;
    log.add('request:$childId:${type.name}:$purpose');
    return certificate;
  }

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Fees implements IFeeRepository {
  final log = <String>[];
  Object? fails, downloadFails;
  @override
  Future<FeeReceipt> pay({required String childId, required List<String> invoiceIds, required PaymentMethod method}) async {
    if (fails != null) throw fails!;
    log.add('pay:$childId:${invoiceIds.join(',')}:${method.name}');
    return _receipt;
  }

  @override
  Future<PaymentClaim> reportPayment({
    required String childId,
    required String invoiceId,
    required double amount,
    required TransferMode mode,
    required String reference,
    required DateTime paidOn,
    String note = '',
  }) async {
    if (fails != null) throw fails!;
    log.add('report:$childId:$invoiceId:$amount:${mode.name}:$reference:${paidOn.day}:$note');
    return PaymentClaim(
      id: 'clm_1',
      invoiceId: invoiceId,
      invoiceTitle: 'Term 2 Fees',
      amount: amount,
      mode: mode,
      reference: reference,
      paidOn: paidOn,
      submittedAt: DateTime.now(),
    );
  }

  @override
  Future<String> downloadReceipt(FeeReceipt receipt) async {
    if (downloadFails != null) throw downloadFails!;
    return 'Receipt_${receipt.number}.pdf';
  }

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

final _receipt = FeeReceipt(
  id: 'rc_1',
  number: 'RC-001',
  date: DateTime(2026, 10, 1),
  method: PaymentMethod.upi,
  lines: const [FeeItem('Tuition', 1000)],
);

MessageThread _thread(String id, {int unread = 0}) => MessageThread(
  id: id,
  childId: 'stu_1',
  teacher: 'Mrs. Anita Sharma',
  role: 'Class Teacher',
  lastMessage: 'Hello',
  lastAt: DateTime(2026, 10, 1),
  unread: unread,
);

Conversation _conv(String id, {int unread = 0, int messages = 1}) => Conversation(
  thread: _thread(id, unread: unread),
  messages: [
    for (var i = 0; i < messages; i++)
      ChatMessage(id: 'm$i', threadId: id, fromParent: i.isEven, text: 'Message $i', at: DateTime(2026, 10, 1, 9, i)),
  ],
);

Family _family(List<String> childIds) => Family(
  guardian: const Guardian(id: 'par_1', name: 'Mr. Rajesh Sharma', email: 'r@example.com', phone: '9876543210', relation: 'Father'),
  children: [
    for (final id in childIds)
      Child(id: id, name: 'Child $id', grade: '10', section: 'B', rollNo: 1, admissionNo: 'GIS-$id', classTeacher: 'Mrs. Anita Sharma'),
  ],
);

void main() {
  setUp(() => setUpTestApp(signedIn: true));

  group('FamilyBloc', () {
    test('loading -> loaded with the first child selected; a fresh value keeps the selection', () async {
      final repo = _Family();
      final bloc = FamilyBloc(repo)..add(const LoadFamily());
      expect(bloc.state.status, LoadStatus.loading);
      repo.controller.add(_family(['a', 'b']));
      await _tick();
      expect(bloc.state.status, LoadStatus.loaded);
      expect(bloc.state.selected?.id, 'a');
      bloc.add(const SelectChild('b'));
      await _tick();
      repo.controller.add(_family(['a', 'b', 'c'])); // fresh value (a child was linked)
      await _tick();
      expect(bloc.state.children, hasLength(3));
      expect(bloc.state.selected?.id, 'b');
      await bloc.close();
    });

    test('selecting a child that is not linked is ignored', () async {
      final repo = _Family();
      final bloc = FamilyBloc(repo)..add(const LoadFamily());
      repo.controller.add(_family(['a']));
      await _tick();
      bloc.add(const SelectChild('zzz'));
      await _tick();
      expect(bloc.state.selectedId, 'a');
      await bloc.close();
    });

    test('an error with nothing loaded shows the message', () async {
      final repo = _Family();
      final bloc = FamilyBloc(repo)..add(const LoadFamily());
      repo.controller.addError(_err('This account is not a parent login.'));
      await _tick();
      expect(bloc.state.status, LoadStatus.error);
      expect(bloc.state.error, 'This account is not a parent login.');
      await bloc.close();
    });

    test('a failed refresh keeps the loaded family and the selection (no error screen)', () async {
      final repo = _Family();
      final bloc = FamilyBloc(repo)..add(const LoadFamily());
      repo.controller.add(_family(['a', 'b']));
      await _tick();
      bloc.add(const SelectChild('b'));
      await _tick();
      repo.controller.addError(_err('Offline'));
      await _tick();
      expect(bloc.state.status, LoadStatus.loaded);
      expect(bloc.state.children, hasLength(2));
      expect(bloc.state.selected?.id, 'b');
      await bloc.close();
    });
  });

  group('SettingsBloc', () {
    test('loading -> loaded -> fresh value; update is optimistic and saved', () async {
      final repo = _Settings();
      final bloc = SettingsBloc(repo)..add(const LoadSettings());
      expect(bloc.state.status, LoadStatus.loading);
      repo.controller.add(const AppSettings());
      await _tick();
      expect(bloc.state.status, LoadStatus.loaded);
      repo.controller.add(const AppSettings(sms: false));
      await _tick();
      expect(bloc.state.settings.sms, isFalse);
      const next = AppSettings(sms: false, digest: true, language: AppLanguage.hindi);
      bloc.add(const UpdateSettings(next));
      await _tick();
      expect(bloc.state.settings, next);
      expect(repo.saved, [next]);
      await bloc.close();
    });

    test('error only without loaded settings', () async {
      final repo = _Settings();
      final bloc = SettingsBloc(repo)..add(const LoadSettings());
      repo.controller.addError(_err('Storage unavailable'));
      await _tick();
      expect(bloc.state.status, LoadStatus.error);
      expect(bloc.state.error, 'Storage unavailable');
      await bloc.close();

      final repo2 = _Settings();
      final bloc2 = SettingsBloc(repo2)..add(const LoadSettings());
      repo2.controller
        ..add(const AppSettings(push: false))
        ..addError(_err('Storage unavailable'));
      await _tick();
      expect(bloc2.state.status, LoadStatus.loaded);
      expect(bloc2.state.settings.push, isFalse);
      await bloc2.close();
    });

    test('a failed save puts the previous settings back and says why', () async {
      final repo = _Settings()..failWith = _err('Could not save your settings.');
      final bloc = SettingsBloc(repo)..add(const LoadSettings());
      repo.controller.add(const AppSettings());
      await _tick();
      bloc.add(const UpdateSettings(AppSettings(push: false)));
      await _tick();
      expect(bloc.state.settings, const AppSettings());
      expect(bloc.state.error, 'Could not save your settings.');
      await bloc.close();
    });
  });

  group('NotificationsBloc', () {
    late List<AppNotification> items;
    setUp(() async => items = await getIt<INotificationRepository>().watchNotifications().first);

    test('loads on creation, cache-first then fresh, error only without data', () async {
      final repo = _Notifications();
      final bloc = NotificationsBloc(repo);
      expect(bloc.state.status, LoadStatus.loading);
      repo.controller.add(items.take(2).toList());
      await _tick();
      expect(bloc.state.items, hasLength(2));
      repo.controller.add(items);
      await _tick();
      expect(bloc.state.items, items);
      repo.controller.addError(_err('Offline'));
      await _tick();
      expect(bloc.state.status, LoadStatus.loaded);
      await bloc.close();

      final repo2 = _Notifications();
      final bloc2 = NotificationsBloc(repo2);
      repo2.controller.addError(_err('Offline'));
      await _tick();
      expect(bloc2.state.status, LoadStatus.error);
      expect(bloc2.state.error, 'Offline');
      await bloc2.close();
    });

    test('mark read (only unread), read all, acknowledge, filter and delete', () async {
      final repo = _Notifications();
      final bloc = NotificationsBloc(repo);
      repo.controller.add(items);
      await _tick();
      final unread = items.firstWhere((n) => !n.read);
      final read = items.where((n) => n.read).firstOrNull;
      bloc.add(MarkNotificationRead(unread.id));
      if (read != null) bloc.add(MarkNotificationRead(read.id));
      bloc
        ..add(const MarkNotificationRead('missing'))
        ..add(const MarkAllNotificationsRead())
        ..add(AcknowledgeNotification(unread.id))
        ..add(const ChangeNotificationFilter(NotificationFilter.unread));
      await _tick();
      expect(repo.log, unorderedEquals(['read:${unread.id}', 'readAll', 'ack:${unread.id}']));
      expect(bloc.state.filter, NotificationFilter.unread);
      expect(bloc.state.visible.every((n) => !n.read), isTrue);
      bloc.add(DeleteNotification(unread.id));
      await _tick();
      expect(bloc.state.byId(unread.id), isNull);
      expect(repo.log.last, 'delete:${unread.id}');
      await bloc.close();
    });

    test('a failed delete brings the notification back', () async {
      final repo = _Notifications()..deleteFails = _err('Could not delete it.');
      final bloc = NotificationsBloc(repo);
      repo.controller.add(items);
      await _tick();
      bloc.add(DeleteNotification(items.first.id));
      await _tick();
      expect(bloc.state.items, items);
      expect(bloc.state.error, 'Could not delete it.');
      await bloc.close();
    });
  });

  group('ProfileBloc', () {
    late GuardianProfile profile;
    setUp(() async => profile = await getIt<IProfileRepository>().watchProfile().first);

    test('loading -> loaded -> fresh; error only without a profile', () async {
      final repo = _Profile();
      final bloc = ProfileBloc(repo, _Attendance())..add(const LoadProfile());
      expect(bloc.state.status, LoadStatus.loading);
      repo.controller.add(profile);
      await _tick();
      expect(bloc.state.profile, profile);
      final fresh = profile.copyWith(photoStyle: () => 2);
      repo.controller.add(fresh);
      await _tick();
      expect(bloc.state.profile, fresh);
      repo.controller.addError(_err('Offline'));
      await _tick();
      expect(bloc.state.status, LoadStatus.loaded);
      expect(bloc.state.profile, fresh);
      await bloc.close();

      final repo2 = _Profile();
      final bloc2 = ProfileBloc(repo2, _Attendance())..add(const LoadProfile());
      repo2.controller.addError(_err('Not signed in.'));
      await _tick();
      expect(bloc2.state.status, LoadStatus.error);
      expect(bloc2.state.error, 'Not signed in.');
      await bloc2.close();
    });

    test('save: saving -> saved; failure keeps the message; photo goes to the repository', () async {
      final repo = _Profile();
      final bloc = ProfileBloc(repo, _Attendance());
      final states = <ProfileState>[];
      final sub = bloc.stream.listen(states.add);
      bloc.add(SaveProfile(profile));
      await _tick();
      expect(states.map((s) => s.save), [SaveStatus.saving, SaveStatus.saved]);
      expect(repo.saved, [profile]);
      repo.saveFails = _err("Your contact details are the school's record. Ask the school office to update them.");
      bloc.add(SaveProfile(profile));
      await _tick();
      expect(bloc.state.save, SaveStatus.failed);
      expect(bloc.state.error, "Your contact details are the school's record. Ask the school office to update them.");
      bloc
        ..add(const ChangePhoto(3))
        ..add(const ChangePhoto(null));
      await _tick();
      expect(repo.photos, [3, null]);
      await sub.cancel();
      await bloc.close();
    });

    test('child attendance: percentages per child; a failing child is skipped', () async {
      final att = _Attendance();
      final data = await getIt<IAttendanceRepository>().watchAttendance(DemoData.aarav.id).first;
      att.byChild['a'] = data;
      att.byChild['b'] = _err('Offline');
      final bloc = ProfileBloc(_Profile(), att)..add(const LoadChildAttendance(['a', 'b']));
      await _tick();
      expect(bloc.state.attendance, {'a': data.overall.percentage});
      await bloc.close();
    });
  });

  group('ChatBloc', () {
    test('open: loading -> loaded; a fresh value replaces the cached one; unread is marked read', () async {
      final repo = _Messages();
      final bloc = ChatBloc(repo)..add(const OpenChat('t1'));
      await _tick();
      expect(bloc.state.status, LoadStatus.loading);
      expect(bloc.state.threadId, 't1');
      repo.conversations['t1']!.add(_conv('t1'));
      await _tick();
      expect(bloc.state.status, LoadStatus.loaded);
      expect(bloc.state.messages, hasLength(1));
      expect(repo.log, isEmpty, reason: 'nothing unread');
      repo.conversations['t1']!.add(_conv('t1', unread: 1, messages: 2));
      await _tick();
      expect(bloc.state.messages, hasLength(2));
      expect(repo.log, ['read:t1']);
      await bloc.close();
    });

    test('error only without a loaded conversation', () async {
      final repo = _Messages();
      final bloc = ChatBloc(repo)..add(const OpenChat('t1'));
      await _tick();
      repo.conversations['t1']!.addError(_err('Conversation not found'));
      await _tick();
      expect(bloc.state.status, LoadStatus.error);
      expect(bloc.state.error, 'Conversation not found');
      bloc.add(const OpenChat('t2'));
      await _tick();
      repo.conversations['t2']!
        ..add(_conv('t2'))
        ..addError(_err('Offline'));
      await _tick();
      expect(bloc.state.status, LoadStatus.loaded);
      expect(bloc.state.thread?.id, 't2');
      await bloc.close();
    });

    test('send trims the text, ignores empty messages and reports a failed send', () async {
      final repo = _Messages();
      final bloc = ChatBloc(repo)..add(const SendChatMessage('before open'));
      await _tick();
      expect(repo.sent, isEmpty, reason: 'no conversation open');
      bloc.add(const OpenChat('t1'));
      await _tick();
      repo.conversations['t1']!.add(_conv('t1'));
      bloc
        ..add(const SendChatMessage('   '))
        ..add(const SendChatMessage('  See you at 4  '));
      await _tick();
      expect(repo.sent.single.$1, 't1');
      expect(repo.sent.single.$2, 'See you at 4');
      const file = MessageAttachment(name: 'note.pdf', sizeKb: 12);
      bloc.add(const SendChatMessage('', attachments: [file]));
      await _tick();
      expect(repo.sent.last.$3, [file]);
      expect(bloc.state.sending, isFalse);
      repo.sendFails = _err('Message not sent. Check your connection.');
      bloc.add(const SendChatMessage('again'));
      await _tick();
      expect(bloc.state.sending, isFalse);
      expect(bloc.state.error, 'Message not sent. Check your connection.');
      expect(bloc.state.status, LoadStatus.loaded, reason: 'a failed send keeps the conversation');
      await bloc.close();
    });
  });

  group('NewMessageBloc', () {
    const contact = MessageContact(
      id: 'stf_025',
      name: 'Mrs. Anita Sharma',
      shortName: 'Mrs. Sharma',
      role: 'Class Teacher',
      badge: 'Class Teacher',
      kind: ContactKind.classTeacher,
    );
    NewMessageRequest req({String contactId = 'stf_025', String subject = 'Calculator', String body = 'Will Aarav need a calculator?', String? draftId}) =>
        NewMessageRequest(childId: 'stu_1', contactId: contactId, category: MessageCategory.academic, subject: subject, body: body, draftId: draftId);

    test('start: contacts load (cache-first then fresh), error only without contacts, draft and contact prefill', () async {
      final repo = _Messages();
      repo.drafts['dr_1'] = MessageDraft(id: 'dr_1', childId: 'stu_1', updatedAt: DateTime(2026), contactId: 'stf_010', body: 'later');
      final bloc = NewMessageBloc(repo)..add(const NewMessageStarted('stu_1', draftId: 'dr_1'));
      await _tick();
      expect(repo.log, ['contacts:stu_1']);
      expect(bloc.state.status, LoadStatus.loading);
      expect(bloc.state.draft?.body, 'later');
      expect(bloc.state.contactId, 'stf_010');
      repo.contacts.add(const [contact]);
      await _tick();
      expect(bloc.state.status, LoadStatus.loaded);
      expect(bloc.state.contacts, [contact]);
      repo.contacts.addError(_err('Offline'));
      await _tick();
      expect(bloc.state.status, LoadStatus.loaded);
      await bloc.close();

      final repo2 = _Messages();
      final bloc2 = NewMessageBloc(repo2)..add(const NewMessageStarted('stu_1', contactId: 'stf_025'));
      await _tick();
      expect(bloc2.state.contactId, 'stf_025');
      repo2.contacts.addError(_err('Could not load your child\'s teachers.'));
      await _tick();
      expect(bloc2.state.status, LoadStatus.error);
      expect(bloc2.state.error, 'Could not load your child\'s teachers.');
      await bloc2.close();
    });

    test('submit validates first, with the exact message, and never reaches the repository', () async {
      final repo = _Messages();
      final bloc = NewMessageBloc(repo);
      for (final (r, msg) in [
        (req(contactId: ''), 'Choose who to send this to'),
        (req(subject: ''), 'Add a subject'),
        (req(subject: 'abc'), 'Subject is too short'),
        (req(subject: 'x' * 81), 'Keep the subject under 80 characters'),
        (req(body: ''), 'Write your message'),
        (req(body: 'too short'), 'Please add a little more detail (10+ characters)'),
        (req(body: 'x' * 801), 'Message is limited to 800 characters'),
      ]) {
        bloc.add(NewMessageSubmitted(r));
        await _tick();
        expect(bloc.state.submit, SubmitStatus.failed);
        expect(bloc.state.error, msg);
      }
      expect(repo.started, isEmpty);
      await bloc.close();
    });

    test('boundaries: 4-character subject, 80-character subject, 10- and 800-character body are accepted', () async {
      for (final r in [req(subject: 'abcd'), req(subject: 'x' * 80), req(body: 'x' * 10), req(body: 'x' * 800)]) {
        expect(r.error, isNull);
      }
    });

    test('submit: sending -> sent with the thread; repository failure shows its message; draft saved', () async {
      final repo = _Messages();
      final bloc = NewMessageBloc(repo);
      final states = <NewMessageState>[];
      final sub = bloc.stream.listen(states.add);
      bloc.add(NewMessageSubmitted(req(draftId: 'dr_9')));
      await _tick();
      expect(states.map((s) => s.submit), [SubmitStatus.sending, SubmitStatus.sent]);
      expect(bloc.state.thread?.id, 'thr_stu_1_stf_025');
      expect(repo.started.single.draftId, 'dr_9');
      repo.startFails = _err('This teacher is not available for messages.');
      bloc.add(NewMessageSubmitted(req()));
      await _tick();
      expect(bloc.state.submit, SubmitStatus.failed);
      expect(bloc.state.error, 'This teacher is not available for messages.');
      bloc.add(NewMessageDraftSaved(MessageDraft(id: '', childId: 'stu_1', updatedAt: DateTime(2026), body: 'later')));
      await _tick();
      expect(bloc.state.submit, SubmitStatus.draftSaved);
      expect(bloc.state.draft?.id, 'dr_saved');
      await sub.cancel();
      await bloc.close();
    });

    test('a failed draft save says so instead of failing silently', () async {
      final repo = _Messages()..draftFails = _err('Could not save the draft.');
      final bloc = NewMessageBloc(repo)
        ..add(NewMessageDraftSaved(MessageDraft(id: '', childId: 'stu_1', updatedAt: DateTime(2026), body: 'later')));
      await _tick();
      expect(bloc.state.submit, SubmitStatus.failed);
      expect(bloc.state.error, 'Could not save the draft.');
      await bloc.close();
    });
  });

  group('LeaveApplyBloc', () {
    LeaveApplyEvent ev({String reason = 'Family function in Jaipur', DateTime? from, DateTime? to, int? daysLeft, LeaveType type = LeaveType.familyEvent}) {
      final f = from ?? _monday();
      return LeaveApplyEvent(childId: 'stu_1', from: f, to: to ?? f, reason: reason, type: type, attachment: 'invite.pdf', daysLeft: daysLeft);
    }

    test('validation: reason, date order, weekend-only, balance (exact messages and fields)', () async {
      final repo = _Leave();
      final bloc = LeaveApplyBloc(repo);
      final mon = _monday();
      final sat = mon.subtract(const Duration(days: 2));
      for (final (e, field, msg) in [
        (ev(reason: '   '), LeaveField.reason, 'Please give a reason.'),
        (ev(from: mon, to: mon.subtract(const Duration(days: 1))), LeaveField.dates, 'The end date cannot be before the start date.'),
        (ev(from: sat, to: sat.add(const Duration(days: 1))), LeaveField.dates, 'Those dates fall on a weekend. Pick at least one school day.'),
        (ev(from: mon, to: mon.add(const Duration(days: 2)), daysLeft: 2), LeaveField.balance, 'Only 2 casual leave days left this year.'),
        (ev(from: mon, to: mon.add(const Duration(days: 1)), daysLeft: 1, type: LeaveType.medical), LeaveField.balance, 'Only 1 medical leave day left this year.'),
      ]) {
        bloc.add(e);
        await _tick();
        expect(bloc.state.status, ApplyStatus.failure);
        expect(bloc.state.field, field);
        expect(bloc.state.errorFor(field), msg);
      }
      expect(repo.applied, isEmpty);
      await bloc.close();
    });

    test('boundary: exactly the days left is accepted; submitting -> success with every field passed on', () async {
      final repo = _Leave();
      final bloc = LeaveApplyBloc(repo);
      final states = <LeaveApplyState>[];
      final sub = bloc.stream.listen(states.add);
      final mon = _monday();
      bloc.add(ev(from: mon, to: mon.add(const Duration(days: 1)), daysLeft: 2));
      await _tick();
      expect(states.map((s) => s.status), [ApplyStatus.submitting, ApplyStatus.success]);
      expect(repo.applied.single, {
        'childId': 'stu_1',
        'from': mon,
        'to': mon.add(const Duration(days: 1)),
        'reason': 'Family function in Jaipur',
        'type': LeaveType.familyEvent,
        'attachment': 'invite.pdf',
      });
      await sub.cancel();
      await bloc.close();
    });

    test('a repository failure is shown on the submit field', () async {
      final repo = _Leave()..fails = _err('Leave for these dates was already requested.');
      final bloc = LeaveApplyBloc(repo)..add(ev());
      await _tick();
      expect(bloc.state.errorFor(LeaveField.submit), 'Leave for these dates was already requested.');
      expect(bloc.state.errorFor(LeaveField.reason), isNull);
      await bloc.close();
    });
  });

  group('PtmActionBloc', () {
    late _Ptm repo;
    late PtmActionBloc bloc;
    setUp(() async {
      final data = await getIt<IPtmRepository>().watchPtm(DemoData.aarav.id).first;
      repo = _Ptm(data.meetings.first);
      bloc = PtmActionBloc(repo);
    });
    tearDown(() => bloc.close());

    test('book: every missing field is reported at once, with the exact text', () async {
      bloc.add(const BookPtm(childId: 'stu_1', agenda: 'too short'));
      await _tick();
      expect(bloc.state.status, PtmActionStatus.failure);
      expect(bloc.state.action, PtmAction.book);
      expect(bloc.state.errors, {
        'teacher': 'Choose a teacher.',
        'slot': 'Choose a time slot.',
        'agenda': 'Describe what you want to discuss (at least 10 characters).',
      });
      expect(repo.log, isEmpty);
    });

    test('book: a 10-character agenda is enough; submitting -> success with the meeting', () async {
      final states = <PtmActionState>[];
      final sub = bloc.stream.listen(states.add);
      bloc.add(const BookPtm(childId: 'stu_1', teacherId: 'stf_025', slotId: 'pts_1', mode: MeetingMode.virtual, agenda: '0123456789'));
      await _tick();
      expect(states.map((s) => s.status), [PtmActionStatus.submitting, PtmActionStatus.success]);
      expect(bloc.state.meeting, repo.meeting);
      expect(repo.log, ['book:stu_1:stf_025:pts_1:virtual:0123456789']);
      await sub.cancel();
    });

    test('book failure: the repository reason', () async {
      repo.fails = _err('This slot was just taken. Pick another time.');
      bloc.add(const BookPtm(childId: 'stu_1', teacherId: 't', slotId: 's', agenda: 'Progress in maths'));
      await _tick();
      expect(bloc.state.status, PtmActionStatus.failure);
      expect(bloc.state.error, 'This slot was just taken. Pick another time.');
    });

    test('reschedule needs a slot, then moves the meeting; cancel; reset', () async {
      bloc.add(const ReschedulePtm(childId: 'stu_1', meetingId: 'm1'));
      await _tick();
      expect(bloc.state.errors, {'slot': 'Choose a new time slot.'});
      bloc.add(const ReschedulePtm(childId: 'stu_1', meetingId: 'm1', slotId: 'pts_2'));
      await _tick();
      expect(bloc.state.status, PtmActionStatus.success);
      expect(bloc.state.action, PtmAction.reschedule);
      bloc.add(const CancelPtm(childId: 'stu_1', meetingId: 'm1'));
      await _tick();
      expect(bloc.state.status, PtmActionStatus.success);
      expect(bloc.state.action, PtmAction.cancel);
      expect(repo.log, ['reschedule:stu_1:m1:pts_2', 'cancel:stu_1:m1']);
      bloc.add(const ResetPtmAction());
      await _tick();
      expect(bloc.state, const PtmActionState());
    });

    test('reschedule and cancel failures; a failing join record never surfaces', () async {
      repo.fails = _err('This meeting can no longer be changed.');
      bloc.add(const ReschedulePtm(childId: 'stu_1', meetingId: 'm1', slotId: 'pts_2'));
      await _tick();
      expect(bloc.state.error, 'This meeting can no longer be changed.');
      bloc.add(const CancelPtm(childId: 'stu_1', meetingId: 'm1'));
      await _tick();
      expect(bloc.state.action, PtmAction.cancel);
      expect(bloc.state.error, 'This meeting can no longer be changed.');
      bloc.add(const ResetPtmAction());
      await _tick();
      bloc.add(const JoinPtm(childId: 'stu_1', meetingId: 'm1'));
      await _tick();
      expect(repo.log, ['join:stu_1:m1']);
      expect(bloc.state, const PtmActionState());
    });
  });

  group('CertificateActionBloc', () {
    late _Student repo;
    late CertificateActionBloc bloc;
    setUp(() async {
      final certs = await getIt<IStudentRepository>().watchCertificates(DemoData.aarav.id).first;
      repo = _Student(certs.first);
      bloc = CertificateActionBloc(repo);
    });
    tearDown(() => bloc.close());

    test('request: type and purpose are required (exact messages); 5 characters is the minimum', () async {
      bloc.add(const RequestCertificate(childId: 'stu_1', purpose: ' abc '));
      await _tick();
      expect(bloc.state.errors, {
        'type': 'Choose the certificate you need.',
        'purpose': 'Tell the office what it is for (at least 5 characters).',
      });
      bloc.add(const RequestCertificate(childId: 'stu_1', type: CertificateRequestType.bonafide, purpose: 'abcd'));
      await _tick();
      expect(bloc.state.errors.keys, ['purpose']);
      expect(repo.log, isEmpty);
      final states = <CertificateActionState>[];
      final sub = bloc.stream.listen(states.add);
      bloc.add(const RequestCertificate(childId: 'stu_1', type: CertificateRequestType.bonafide, purpose: 'Visa'));
      await _tick();
      expect(bloc.state.errors.keys, ['purpose'], reason: '"Visa" is 4 characters');
      bloc.add(const RequestCertificate(childId: 'stu_1', type: CertificateRequestType.character, purpose: 'Passport'));
      await _tick();
      expect(states.map((s) => s.status), [CertificateActionStatus.submitting, CertificateActionStatus.success]);
      expect(bloc.state.certificate, repo.certificate);
      expect(repo.log, ['request:stu_1:character:Passport']);
      await sub.cancel();
    });

    test('download success and the failure reason; request failure; reset', () async {
      bloc.add(const DownloadCertificate(childId: 'stu_1', certificateId: 'c1'));
      await _tick();
      expect(bloc.state.status, CertificateActionStatus.success);
      expect(bloc.state.action, CertificateAction.download);
      expect(repo.log, ['download:stu_1:c1']);
      repo.fails = _err('This certificate is still being prepared.');
      bloc.add(const DownloadCertificate(childId: 'stu_1', certificateId: 'c1'));
      await _tick();
      expect(bloc.state.status, CertificateActionStatus.failure);
      expect(bloc.state.error, 'This certificate is still being prepared.');
      bloc.add(const RequestCertificate(childId: 'stu_1', type: CertificateRequestType.transfer, purpose: 'School change'));
      await _tick();
      expect(bloc.state.action, CertificateAction.request);
      expect(bloc.state.error, 'This certificate is still being prepared.');
      bloc.add(const ResetCertificateAction());
      await _tick();
      expect(bloc.state, const CertificateActionState());
    });
  });

  group('FeePaymentBloc', () {
    test('report: processing -> reported with the claim and every field passed on; failure text', () async {
      final repo = _Fees();
      final bloc = FeePaymentBloc(repo);
      final states = <FeePaymentState>[];
      final sub = bloc.stream.listen(states.add);
      bloc.add(PaymentReported(
        childId: 'stu_1',
        invoiceId: 'inv_1',
        amount: 12500,
        mode: TransferMode.bankTransfer,
        reference: 'UTR123456',
        paidOn: DateTime(2026, 10, 20),
        note: 'Paid from SBI',
      ));
      await _tick();
      expect(states.map((s) => s.status), [PaymentStatus.processing, PaymentStatus.reported]);
      expect(bloc.state.claim?.amount, 12500);
      expect(repo.log, ['report:stu_1:inv_1:12500.0:bankTransfer:UTR123456:20:Paid from SBI']);
      repo.fails = _err('This reference was already reported. The office is checking it.');
      bloc.add(PaymentReported(childId: 'stu_1', invoiceId: 'inv_1', amount: 1, mode: TransferMode.upi, reference: 'UTR123456', paidOn: DateTime(2026, 10, 20)));
      await _tick();
      expect(bloc.state.status, PaymentStatus.failure);
      expect(bloc.state.error, 'This reference was already reported. The office is checking it.');
      await sub.cancel();
      await bloc.close();
    });

    test('pay passes the invoices and method; receipt download counts every download', () async {
      final repo = _Fees();
      final bloc = FeePaymentBloc(repo)
        ..add(const FeePaymentSubmitted(childId: 'stu_1', invoiceIds: ['inv_1', 'inv_2'], method: PaymentMethod.card));
      await _tick();
      expect(bloc.state.status, PaymentStatus.success);
      expect(repo.log, ['pay:stu_1:inv_1,inv_2:card']);
      bloc
        ..add(ReceiptDownloadRequested(_receipt))
        ..add(ReceiptDownloadRequested(_receipt));
      await _tick();
      expect(bloc.state.downloaded, 'Receipt_RC-001.pdf');
      expect(bloc.state.downloadCount, 2);
      await bloc.close();
    });

    test('a failed receipt download reports the error instead of failing silently', () async {
      final repo = _Fees()..downloadFails = _err('Could not save the receipt.');
      final bloc = FeePaymentBloc(repo)..add(ReceiptDownloadRequested(_receipt));
      await _tick();
      expect(bloc.state.status, PaymentStatus.failure);
      expect(bloc.state.error, 'Could not save the receipt.');
      expect(bloc.state.downloadCount, 0);
      await bloc.close();
    });
  });

  group('RegistrationBloc on the Firebase backend', () {
    test('lookup and submit point the guardian to the school office', () async {
      final bloc = reg.RegistrationBloc(FirebaseRegistrationRepository())
        ..add(reg.StudentLookupRequested('GIS-2021-0142', DateTime(2010, 8, 14)));
      await _tick();
      expect(bloc.state.lookup, reg.LookupStatus.failed);
      expect(bloc.state.lookupError, startsWith('Parent logins are created by the school.'));
      expect(bloc.state.students, isEmpty);
      bloc.add(const reg.RegistrationSubmitted(guardianName: 'Mrs. Priya Sharma', relation: 'Mother', phone: '9876543210'));
      await _tick();
      expect(bloc.state.submit, reg.SubmitStatus.failed);
      expect(bloc.state.submitError, 'Verify at least one student first.');
      await bloc.close();
    });
  });
}
