import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/config/routes/routes.dart';
import 'package:parent_app/design_system/design_system.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/messages/bloc/chat_bloc.dart';
import 'package:parent_app/modules/messages/bloc/messages_bloc.dart';
import 'package:parent_app/modules/messages/bloc/new_message_bloc.dart';
import 'package:parent_app/modules/messages/models/message_models.dart';
import 'package:parent_app/modules/messages/repositories/message_repository_interface.dart';
import 'package:parent_app/modules/messages/repositories/messages_demo_data.dart';
import 'package:parent_app/modules/messages/repositories/mock_message_repository.dart';
import 'package:parent_app/modules/messages/screens/widgets/file_upload_sheet.dart';
import 'package:parent_app/utils/services/cache_service.dart';
import 'package:parent_app/utils/services/mock_latency.dart';
import 'helpers/pump_app.dart';

final _aarav = DemoData.aarav.id;
final _classThread = 'th_${_aarav}_ct';
final _busThread = 'th_${_aarav}_bus';

NewMessageRequest _req({
  String? contactId,
  String subject = 'Math remedial class',
  String body = 'Could Aarav join the remedial class on Friday?',
  String? draftId,
}) => NewMessageRequest(
  childId: _aarav,
  contactId: contactId ?? 'ct_${_aarav}_class',
  category: MessageCategory.academic,
  subject: subject,
  body: body,
  draftId: draftId,
);

Finder _chip(String label) => find.text(label);

/// Horizontal chip rows build lazily: scroll [label] into view.
Future<void> _showChip(WidgetTester t, String label, {double by = 120}) async {
  await t.scrollUntilVisible(
    _chip(label),
    by,
    scrollable: find
        .descendant(
          of: find.byType(AppSolidChips),
          matching: find.byType(Scrollable),
        )
        .first,
  );
  await t.pumpAndSettle();
}

/// The Drafts link sits at the end of the list, behind the dock until scrolled.
Future<void> _openDrafts(WidgetTester t) async {
  await t.drag(find.byKey(const Key('messages-list')), const Offset(0, -600));
  await t.pumpAndSettle();
  await t.tap(find.byKey(const Key('messages-drafts')));
  await t.pumpAndSettle();
}

void main() {
  setUp(() {
    MockLatency.delay = Duration.zero;
    SimulatedPicker.reset();
  });

  group('models', () {
    final threads = MessagesDemoData.seed(_aarav).threads;

    test('filterThreads: tabs, unread and search', () {
      expect(filterThreads(threads).length, 5);
      expect(filterThreads(threads, filter: MessageFilter.teachers).length, 2);
      expect(
        filterThreads(threads, filter: MessageFilter.administration).length,
        2,
      );
      expect(
        filterThreads(threads, filter: MessageFilter.transport).single.id,
        _busThread,
      );
      expect(
        filterThreads(threads, filter: MessageFilter.unread).map((t) => t.id),
        containsAll([_classThread, _busThread]),
      );
      expect(
        filterThreads(threads, query: 'rao').single.teacher,
        'Dr. K.V. Rao',
      );
      expect(filterThreads(threads, query: 'robotics').length, 1);
      expect(
        filterThreads(threads, query: 'anita', filter: MessageFilter.transport),
        isEmpty,
      );
    });

    test('sortThreads puts pinned first then newest', () {
      final sorted = sortThreads(threads.reversed.toList());
      expect(sorted.first.id, _classThread);
      for (var i = 2; i < sorted.length; i++) {
        expect(sorted[i - 1].lastAt.isAfter(sorted[i].lastAt), isTrue);
      }
    });

    test('NewMessageRequest validation', () {
      expect(_req().error, isNull);
      expect(_req(contactId: '').error, 'Choose who to send this to');
      expect(_req(subject: ' ').error, 'Add a subject');
      expect(_req(body: 'short').error, contains('10+'));
      expect(_req(body: 'x' * 801).error, contains('800'));
    });
  });

  group('MockMessageRepository', () {
    late MockMessageRepository repo;
    late CacheService cache;
    setUp(() {
      cache = CacheService();
      repo = MockMessageRepository(cache);
    });

    test('overview is cache-first and counts unread conversations', () async {
      final first = await repo.watchOverview(_aarav).first;
      expect(first.threads.length, 5);
      expect(first.unreadThreads, 2);
      expect(first.drafts.length, 2);
      expect(first.threads.first.pinned, isTrue);
      MockLatency.delay = const Duration(seconds: 1);
      // Cached value arrives before the (slow) refresh.
      final cached = await repo
          .watchOverview(_aarav)
          .first
          .timeout(const Duration(milliseconds: 100));
      expect(cached, first);
    });

    test('markRead, markAllRead and unread count stream', () async {
      final counts = <int>[];
      final sub = repo.watchUnreadCount(_aarav).listen(counts.add);
      await pumpEventQueue();
      expect(counts, [2]);
      await repo.markRead(_classThread);
      await pumpEventQueue();
      expect(counts.last, 1);
      await repo.markAllRead(_aarav);
      await pumpEventQueue();
      expect(counts.last, 0);
      // cacheFirst's async* generator only completes a cancel at its next event, so don't await it.
      unawaited(sub.cancel());
    });

    test('send appends a message, updates the thread, needs content', () async {
      await repo.send(
        _busThread,
        '',
        attachments: const [MessageAttachment(name: 'Pass.pdf', sizeKb: 20)],
      );
      final c = await repo.watchConversation(_busThread).first;
      expect(c.messages.last.attachments.single.name, 'Pass.pdf');
      expect(c.messages.last.fromParent, isTrue);
      expect(c.thread.unread, 0);
      expect(c.thread.lastMessage, contains('Pass.pdf'));
      expect(() => repo.send(_busThread, '  '), throwsA(anything));
    });

    test('setPinned re-sorts the list', () async {
      await repo.setPinned(_busThread, true);
      final o = await repo.watchOverview(_aarav).first;
      expect(o.threads.take(2).map((t) => t.id), contains(_busThread));
      expect(o.threads.where((t) => t.pinned).length, 2);
    });

    test('startThread creates a thread and removes its draft', () async {
      final draftId = 'dr_${_aarav}_1';
      final t = await repo.startThread(_req(draftId: draftId));
      expect(t.teacher, DemoData.aarav.classTeacher);
      expect(t.subject, 'Math remedial class');
      final o = await repo.watchOverview(_aarav).first;
      expect(o.threads.first.id, isNot(t.id)); // pinned stays first
      expect(o.threads.any((e) => e.id == t.id), isTrue);
      expect(o.drafts.any((d) => d.id == draftId), isFalse);
      final c = await repo.watchConversation(t.id).first;
      expect(c.messages.single.text, startsWith('Math remedial class'));
      expect(() => repo.startThread(_req(contactId: '')), throwsA(anything));
    });

    test('drafts: save, update, delete', () async {
      final d = await repo.saveDraft(
        MessageDraft(
          id: '',
          childId: _aarav,
          subject: 'Bus pass',
          updatedAt: DateTime.now(),
        ),
      );
      expect(d.id, isNotEmpty);
      expect((await repo.draft(d.id))?.subject, 'Bus pass');
      await repo.deleteDraft(d.id);
      expect(await repo.draft(d.id), isNull);
      expect((await repo.watchOverview(_aarav).first).drafts.length, 2);
    });
  });

  group('BLoCs', () {
    setUp(() async => setUpTestApp(signedIn: true));

    test('MessagesBloc loads, pins and marks all read', () async {
      final bloc = getIt<MessagesBloc>()..add(LoadChildData(_aarav));
      final s = await bloc.stream.firstWhere((s) => s.hasData);
      expect(s.data!.unreadThreads, 2);
      bloc.add(PinThread(_busThread, pinned: true));
      await bloc.stream.firstWhere(
        (s) => s.data!.threads.any((t) => t.id == _busThread && t.pinned),
      );
      bloc.add(const MarkAllThreadsRead());
      await bloc.stream.firstWhere((s) => s.data!.unreadThreads == 0);
      await bloc.close();
    });

    test('UnreadCountBloc follows reads', () async {
      final bloc = getIt<UnreadCountBloc>()..add(LoadChildData(_aarav));
      await bloc.stream.firstWhere((s) => s.data == 2);
      await getIt<IMessageRepository>().markRead(_busThread);
      await bloc.stream.firstWhere((s) => s.data == 1);
      await bloc.close();
    });

    test('ChatBloc opens (marks read) and sends with attachments', () async {
      final bloc = getIt<ChatBloc>()..add(OpenChat(_classThread));
      await bloc.stream.firstWhere((s) => s.thread?.unread == 0);
      final before = bloc.state.messages.length;
      bloc.add(
        const SendChatMessage(
          'See attached',
          attachments: [MessageAttachment(name: 'a.pdf', sizeKb: 1)],
        ),
      );
      final s = await bloc.stream.firstWhere(
        (s) => s.messages.length == before + 1,
      );
      expect(s.messages.last.attachments.single.name, 'a.pdf');
      await bloc.close();
    });

    test('NewMessageBloc validates, prefills drafts and sends', () async {
      final bloc = getIt<NewMessageBloc>()
        ..add(NewMessageStarted(_aarav, draftId: 'dr_${_aarav}_1'));
      final loaded = await bloc.stream.firstWhere(
        (s) => s.status == LoadStatus.loaded,
      );
      expect(loaded.contacts.length, 7);
      expect(loaded.draft?.subject, 'Physics practical notebook');
      expect(loaded.contactId, 'ct_${_aarav}_sub2');

      bloc.add(NewMessageSubmitted(_req(subject: '')));
      final failed = await bloc.stream.firstWhere(
        (s) => s.submit == SubmitStatus.failed,
      );
      expect(failed.error, 'Add a subject');

      bloc.add(NewMessageSubmitted(_req()));
      final sent = await bloc.stream.firstWhere(
        (s) => s.submit == SubmitStatus.sent,
      );
      expect(sent.thread?.subject, 'Math remedial class');
      await bloc.close();
    });
  });

  group('screens', () {
    testWidgets('Messages tab: list, unread, search and filter tabs', (
      t,
    ) async {
      await setUpTestApp(signedIn: true);
      await pumpApp(t, location: RoutePaths.messages);

      expect(find.text('Mrs. Anita Sharma'), findsOneWidget);
      expect(find.text('Dr. K.V. Rao'), findsOneWidget);
      expect(find.text('Class Teacher'), findsOneWidget);
      expect(find.byKey(ValueKey('unread-$_classThread')), findsOneWidget);
      expect(find.text('Drafts (2)'), findsOneWidget);
      await _showChip(t, 'Unread  2');
      await t.tap(find.text('Unread  2'));
      await t.pumpAndSettle();
      expect(find.text('Dr. K.V. Rao'), findsNothing);
      expect(find.text('Transport Helpdesk (Route #14)'), findsOneWidget);

      await _showChip(t, 'Transport');
      await t.tap(find.text('Transport'));
      await t.pumpAndSettle();
      expect(find.text('Transport Helpdesk (Route #14)'), findsOneWidget);
      expect(find.text('Mrs. Anita Sharma'), findsNothing);

      await _showChip(t, 'All Messages', by: -120);
      await t.tap(find.text('All Messages'));
      await t.pumpAndSettle();
      await t.enterText(find.byType(TextField).first, 'robotics');
      await t.pumpAndSettle();
      expect(find.text('Mr. Imran Khan'), findsOneWidget);
      expect(find.text('Dr. K.V. Rao'), findsNothing);
      await t.enterText(find.byType(TextField).first, 'zzz');
      await t.pumpAndSettle();
      expect(find.text('No matches for "zzz"'), findsOneWidget);
      await t.enterText(find.byType(TextField).first, '');
      await t.pumpAndSettle();

      // Options sheet: mark all read clears the badges.
      await t.tap(find.byKey(const Key('messages-options')));
      await t.pumpAndSettle();
      await t.tap(find.text('Mark all as read (2)'));
      await t.pumpAndSettle();
      expect(find.byKey(ValueKey('unread-$_classThread')), findsNothing);
      await _showChip(t, 'Unread');
      await _showChip(t, 'All Messages', by: -120);

      // Long press: pin the transport thread.
      await t.longPress(find.byKey(ValueKey('thread-$_busThread')));
      await t.pumpAndSettle();
      await t.tap(find.text('Pin to top'));
      await t.pumpAndSettle();
      expect(find.text('Pinned to top'), findsOneWidget);

      // Drafts sheet: delete one.
      await _openDrafts(t);
      expect(find.text('Sibling fee concession'), findsOneWidget);
      await t.tap(find.byTooltip('Delete draft').last);
      await t.pumpAndSettle();
      expect(find.text('Drafts (1)'), findsOneWidget);
    });

    testWidgets('Thread: marks read, send, quick reply, upload sheet', (
      t,
    ) async {
      await setUpTestApp(signedIn: true);
      await pumpApp(t, location: RoutePaths.messages);
      await t.tap(find.text('Mrs. Anita Sharma'));
      await t.pumpAndSettle();

      expect(find.textContaining('truly deserved it'), findsOneWidget);
      expect(find.textContaining('Mrs. Anita Sharma'), findsWidgets);

      await t.enterText(
        find.byKey(const Key('chat-input')),
        'See you Saturday',
      );
      await t.tap(find.byKey(const Key('chat-send')));
      await t.pumpAndSettle();
      expect(find.text('See you Saturday'), findsOneWidget);

      await t.tap(find.byKey(const ValueKey('quick-reply-0')));
      await t.pumpAndSettle();
      expect(find.text("Thank you Ma'am 🙏"), findsNWidgets(2));

      // 4.3 upload sheet: progress, size validation, remove, attach & send.
      await t.tap(find.byKey(const Key('chat-attach')));
      await t.pumpAndSettle();
      expect(find.text('Share Document'), findsOneWidget);
      await t.tap(find.text('Device Files'));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.textContaining('Uploading'), findsOneWidget);
      await t.pumpAndSettle();
      expect(find.textContaining('Ready to send'), findsOneWidget);
      await t.tap(find.text('Device Files')); // 48 MB sample is rejected
      await t.pumpAndSettle();
      expect(find.textContaining('larger than 15MB'), findsOneWidget);
      await t.tap(find.text('Photo Library'));
      await t.pumpAndSettle();
      await t.tap(find.byTooltip('Remove Science_Model_Photo.png'));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const Key('upload-confirm')));
      await t.pumpAndSettle();
      expect(find.text('Share Document'), findsNothing);
      expect(find.text('Quadratic_Equation_Homework.pdf'), findsOneWidget);

      await t.tap(find.byKey(const Key('chat-call')));
      await t.pump();
      expect(find.textContaining('Calling Mrs. Anita Sharma'), findsOneWidget);
      await t.pumpAndSettle();

      await t.tap(find.byTooltip('Back'));
      await t.pumpAndSettle();
      expect(find.byKey(ValueKey('unread-$_classThread')), findsNothing);
      expect(find.text('Unread  1'), findsOneWidget);
      expect(find.text('See attached'), findsNothing);
    });

    testWidgets(
      'New message: validation, recipient, attach, send opens thread',
      (t) async {
        await setUpTestApp(signedIn: true);
        await pumpApp(t, location: RoutePaths.messages);
        await t.tap(find.byKey(const Key('messages-new-chat')));
        await t.pumpAndSettle();
        expect(find.text('QUICK SELECT FACULTY'), findsOneWidget);

        await t.tap(find.byKey(const Key('new-message-send')));
        await t.pumpAndSettle();
        expect(find.text('Choose who to send this to'), findsOneWidget);
        expect(find.text('Add a subject'), findsOneWidget);
        expect(find.text('Write your message'), findsOneWidget);

        // Search recipient by role.
        await t.enterText(find.byKey(const Key('new-message-to')), 'vice');
        await t.pumpAndSettle();
        await t.tap(find.byKey(ValueKey('suggest-ct_${_aarav}_vp')));
        await t.pumpAndSettle();
        expect(find.byKey(const Key('new-message-recipient')), findsOneWidget);
        // Quick select replaces it.
        await t.tap(find.byKey(ValueKey('faculty-ct_${_aarav}_class')));
        await t.pumpAndSettle();
        expect(
          find.descendant(
            of: find.byKey(const Key('new-message-recipient')),
            matching: find.text('Mrs. Anita Sharma'),
          ),
          findsOneWidget,
        );

        await _showChip(t, 'PTM Request');
        await t.tap(find.text('PTM Request'));
        await t.enterText(
          find.byKey(const Key('new-message-subject')),
          'Progress review',
        );
        await t.enterText(
          find.byKey(const Key('new-message-body')),
          'Namaste Ma\'am, could we meet before Friday\'s review session?',
        );
        await t.pumpAndSettle();
        expect(find.text('60/800'), findsOneWidget);

        await t.tap(find.byKey(const Key('new-message-tone')));
        await t.pumpAndSettle();
        await t.tap(find.text('Formal'));
        await t.pumpAndSettle();
        expect(find.text('Tone: Formal'), findsOneWidget);

        await t.ensureVisible(find.byKey(const Key('new-message-attach')));
        await t.tap(find.byKey(const Key('new-message-attach')));
        await t.pumpAndSettle();
        await t.tap(find.text('Leave / Medical'));
        await t.pumpAndSettle();
        await t.tap(find.byKey(const Key('upload-confirm')));
        await t.pumpAndSettle();
        expect(find.text('Medical_Certificate.pdf'), findsOneWidget);
        await t.tap(find.byKey(const Key('new-message-voice')));
        await t.pumpAndSettle();
        expect(find.text('Voice_note.m4a'), findsOneWidget);

        await t.tap(find.byKey(const Key('new-message-send')));
        await t.pumpAndSettle();
        // Opened the new thread.
        expect(find.byKey(const Key('chat-input')), findsOneWidget);
        expect(find.textContaining('Progress review'), findsOneWidget);
        expect(find.text('Medical_Certificate.pdf'), findsOneWidget);

        await t.tap(find.byTooltip('Back'));
        await t.pumpAndSettle();
        expect(find.textContaining('Progress review'), findsOneWidget);
      },
    );

    testWidgets('New message: leaving saves a draft, drafts reopen', (t) async {
      await setUpTestApp(signedIn: true);
      await pumpApp(t, location: RoutePaths.messages);
      await _openDrafts(t);
      await t.tap(find.text('Physics practical notebook'));
      await t.pumpAndSettle();
      expect(find.text('Physics practical notebook'), findsOneWidget);
      expect(find.text('Mrs. Sunita Iyer'), findsOneWidget);

      await t.enterText(
        find.byKey(const Key('new-message-subject')),
        'Physics practical (updated)',
      );
      await t.tap(find.byKey(const Key('new-message-back')));
      await t.pumpAndSettle();
      expect(find.text('Keep this message?'), findsOneWidget);
      await t.tap(find.text('Save draft'));
      await t.pumpAndSettle();
      expect(find.text('Drafts (2)'), findsOneWidget);
      await _openDrafts(t);
      expect(find.text('Physics practical (updated)'), findsOneWidget);
    });

    testWidgets('Contact sheet starts a new topic with the recipient', (
      t,
    ) async {
      await setUpTestApp(signedIn: true);
      await pumpApp(t, location: RoutePaths.chatWith(_busThread));
      await t.tap(find.byKey(const Key('chat-contact')));
      await t.pumpAndSettle();
      await t.tap(find.text('New topic'));
      await t.pumpAndSettle();
      expect(
        find.descendant(
          of: find.byKey(const Key('new-message-recipient')),
          matching: find.text('Transport Helpdesk (Route #14)'),
        ),
        findsOneWidget,
      );
      expect(find.byType(AppDock), findsNothing);
    });
  });
}
