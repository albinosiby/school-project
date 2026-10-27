import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/config/routes/routes.dart';
import 'package:parent_app/core/bloc/child_data_bloc.dart' show LoadStatus;
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/auth/bloc/auth_bloc.dart';
import 'package:parent_app/modules/family/bloc/family_bloc.dart';
import 'package:parent_app/modules/family/models/family_models.dart';
import 'package:parent_app/modules/notices/repositories/notice_repository_interface.dart';
import 'package:parent_app/modules/notifications/bloc/notifications_bloc.dart';
import 'package:parent_app/modules/notifications/models/notification_models.dart';
import 'package:parent_app/modules/notifications/repositories/notification_repository_interface.dart';
import 'package:parent_app/modules/notifications/screens/notification_detail_screen.dart';
import 'package:parent_app/modules/notifications/screens/notifications_screen.dart';
import 'package:parent_app/modules/profile/bloc/profile_bloc.dart';
import 'package:parent_app/modules/profile/repositories/profile_repository_interface.dart';
import 'package:parent_app/modules/profile/screens/edit_profile_screen.dart';
import 'package:parent_app/modules/profile/screens/profile_screen.dart';
import 'package:parent_app/modules/settings/bloc/settings_bloc.dart';
import 'package:parent_app/modules/settings/models/app_settings.dart';
import 'package:parent_app/modules/settings/repositories/local_settings_repository.dart';
import 'package:parent_app/modules/settings/repositories/settings_repository_interface.dart';
import 'package:parent_app/modules/settings/screens/privacy_policy_screen.dart';
import 'package:parent_app/modules/settings/screens/settings_screen.dart';
import 'package:parent_app/utils/services/cache_service.dart';
import 'package:parent_app/utils/services/local_storage_service.dart';
import 'helpers/pump_app.dart';

/// Clipboard is a platform channel: answer it so copy actions work in tests.
void _mockClipboard(WidgetTester t) {
  t.binding.defaultBinaryMessenger.setMockMethodCallHandler(
    SystemChannels.platform,
    (_) async => null,
  );
  addTearDown(
    () => t.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null),
  );
}

Finder get _mainScroll =>
    find.descendant(of: find.byType(ListView).first, matching: find.byType(Scrollable)).first;

/// Brings [f] on screen (lists build a little beyond the viewport, so scrolling alone is not enough).
Future<void> _show(WidgetTester t, Finder f, {double delta = 150}) async {
  await t.scrollUntilVisible(f, delta, scrollable: _mainScroll);
  await t.ensureVisible(f.first);
  await t.pumpAndSettle();
}

Future<void> _tap(WidgetTester t, Finder f) async {
  await _show(t, f);
  await t.tap(f.first);
  await t.pumpAndSettle();
}

Future<void> _open(WidgetTester t, String location) async {
  await setUpTestApp(signedIn: true);
  getIt<FamilyBloc>().add(const LoadFamily());
  await pumpApp(t, location: location);
  _mockClipboard(t);
}

void main() {
  // ---------------------------------------------------------------- repositories / BLoCs
  group('notification repository', () {
    setUp(() => setUpTestApp(signedIn: true));

    test('merges demo notifications with school notices, newest first, 4 unread', () async {
      final repo = getIt<INotificationRepository>();
      final list = await repo.watchNotifications().first;
      expect(list.any((n) => n.id == 'nf_bus'), isTrue);
      expect(list.where((n) => n.noticeId != null).length, 6);
      for (var i = 1; i < list.length; i++) {
        expect(list[i - 1].time.isAfter(list[i].time) || list[i - 1].time == list[i].time, isTrue);
      }
      expect(await repo.watchUnreadCount().first, 4);
    });

    test('mark read, mark all read and delete push fresh data (cache-first)', () async {
      final repo = getIt<INotificationRepository>();
      final updates = <List<AppNotification>>[];
      final sub = repo.watchNotifications().listen(updates.add);
      await pumpEventQueue();
      await repo.markRead('nf_bus');
      await pumpEventQueue();
      expect(updates.last.firstWhere((n) => n.id == 'nf_bus').read, isTrue);
      await repo.delete('nf_exam');
      await pumpEventQueue();
      expect(updates.last.any((n) => n.id == 'nf_exam'), isFalse);
      await repo.markAllRead();
      await pumpEventQueue();
      expect(updates.last.where((n) => !n.read), isEmpty);
      // An async* stream parked in `await for` only finishes cancelling on its next event: don't wait.
      unawaited(sub.cancel());
      // A new subscriber sees the cached value first.
      expect((await repo.watchNotifications().first).where((n) => !n.read), isEmpty);
    });

    test('acknowledging a notice writes through the notice repository', () async {
      final repo = getIt<INotificationRepository>();
      final sub = repo.watchNotifications().listen((_) {});
      await pumpEventQueue();
      await repo.acknowledge('notice_nt_1');
      await pumpEventQueue();
      final notices = await getIt<INoticeRepository>().watchNotices(DemoData.aarav.id).first;
      expect(notices.firstWhere((n) => n.id == 'nt_1').acknowledged, isTrue);
      final n = (await repo.watchNotifications().first).firstWhere((n) => n.id == 'notice_nt_1');
      expect(n.acknowledged && n.read, isTrue);
      // An async* stream parked in `await for` only finishes cancelling on its next event: don't wait.
      unawaited(sub.cancel());
    });
  });

  group('NotificationsBloc', () {
    setUp(() => setUpTestApp(signedIn: true));

    test('loads on creation, filters and counts', () async {
      final bloc = getIt<NotificationsBloc>();
      final s = await bloc.stream.firstWhere((s) => s.status == LoadStatus.loaded);
      expect(s.unread, 4);
      expect(s.countFor(NotificationFilter.notices), 6);
      bloc.add(const ChangeNotificationFilter(NotificationFilter.unread));
      final f = await bloc.stream.firstWhere((s) => s.filter == NotificationFilter.unread);
      expect(f.visible.length, 4);
      expect(f.visible.every((n) => !n.read), isTrue);
      bloc.add(const MarkAllNotificationsRead());
      final r = await bloc.stream.firstWhere((s) => s.unread == 0);
      expect(r.visible, isEmpty);
    });

    test('delete removes the item at once', () async {
      final bloc = getIt<NotificationsBloc>();
      await bloc.stream.firstWhere((s) => s.status == LoadStatus.loaded);
      bloc.add(const DeleteNotification('nf_fee'));
      final s = await bloc.stream.firstWhere((s) => s.byId('nf_fee') == null);
      expect(s.items.any((n) => n.id == 'nf_fee'), isFalse);
    });
  });

  group('settings repository', () {
    setUp(() => setUpTestApp(signedIn: true));

    test('defaults, then persists every change in local storage', () async {
      final repo = getIt<ISettingsRepository>();
      final first = await repo.watchSettings().first;
      expect(first, const AppSettings());
      expect(first.activeChannels, 3);
      await repo.save(first.copyWith(sms: false, digest: true, language: AppLanguage.hindi));
      // A fresh repository (as after a restart) reads the saved values.
      final again = await LocalSettingsRepository(getIt<LocalStorageService>(), CacheService())
          .watchSettings()
          .first;
      expect(again.sms, isFalse);
      expect(again.digest, isTrue);
      expect(again.language, AppLanguage.hindi);
    });

    test('SettingsBloc updates optimistically', () async {
      final bloc = getIt<SettingsBloc>()..add(const LoadSettings());
      await bloc.stream.firstWhere((s) => s.status == LoadStatus.loaded);
      bloc.add(UpdateSettings(bloc.state.settings.copyWith(push: false)));
      final s = await bloc.stream.firstWhere((s) => !s.settings.push);
      expect(s.settings.activeChannels, 2);
      await bloc.close();
    });
  });

  group('profile repository + bloc', () {
    setUp(() => setUpTestApp(signedIn: true));

    test('a saved guardian flows into FamilyBloc', () async {
      final family = getIt<FamilyBloc>()..add(const LoadFamily());
      await family.stream.firstWhere((s) => s.status == LoadStatus.loaded);
      final repo = getIt<IProfileRepository>();
      final p = await repo.watchProfile().first;
      final g = p.guardian;
      await repo.updateProfile(
        p.copyWith(
          guardian: Guardian(id: g.id, name: 'Mr. Rajesh K Sharma', email: g.email, phone: g.phone),
        ),
      );
      final s = await family.stream.firstWhere((s) => s.guardian?.name == 'Mr. Rajesh K Sharma');
      expect(s.children.length, 2);
    });

    test('changing the mobile number clears verification; photo can be removed', () async {
      final repo = getIt<IProfileRepository>();
      final p = await repo.watchProfile().first;
      final g = p.guardian;
      await repo.updateProfile(
        p.copyWith(
          guardian: Guardian(
            id: g.id,
            name: g.name,
            email: g.email,
            phone: '+91 91234 56789',
            relation: g.relation,
          ),
        ),
      );
      await repo.setPhoto(null);
      // Cache-first: the first value is the cached one, the second the fresh one.
      final after = await repo.watchProfile().skip(1).first;
      expect(after.phoneVerified, isFalse);
      expect(after.photoStyle, isNull);
    });

    test('ProfileBloc save reports a failure for another account', () async {
      final bloc = getIt<ProfileBloc>()..add(const LoadProfile());
      final s = await bloc.stream.firstWhere((s) => s.profile != null);
      final g = s.profile!.guardian;
      bloc.add(
        SaveProfile(
          s.profile!.copyWith(
            guardian: Guardian(id: 'other', name: g.name, email: g.email, phone: g.phone),
          ),
        ),
      );
      final f = await bloc.stream.firstWhere((s) => s.save == SaveStatus.failed);
      expect(f.error, contains('another account'));
      await bloc.close();
    });

    test('normalizeIndianMobile', () {
      expect(normalizeIndianMobile('9876543210'), '+91 98765 43210');
      expect(normalizeIndianMobile('+91 98765-43210'), '+91 98765 43210');
      expect(normalizeIndianMobile('09876543210'), '+91 98765 43210');
      expect(normalizeIndianMobile('12345'), isNull);
      expect(normalizeIndianMobile('5876543210'), isNull);
    });
  });

  // ---------------------------------------------------------------- screens
  group('6. Profile', () {
    testWidgets('guardian card, students, contact info and menu', (t) async {
      await _open(t, RoutePaths.profile);
      expect(find.byType(ProfileScreen), findsOneWidget);
      expect(find.text('Mr. Rajesh Sharma'), findsWidgets);
      expect(find.text('Primary guardian - Father'), findsOneWidget);
      expect(find.text('Aarav Sharma'), findsOneWidget);
      expect(find.text('Ananya Sharma'), findsOneWidget);
      expect(find.textContaining('% Attendance'), findsNWidgets(2));

      // Copy parent ID.
      await t.tap(find.text('ID: GIS-PAR-0001'));
      await t.pumpAndSettle();
      expect(find.text('Parent ID copied'), findsOneWidget);

      // Switch child.
      await _tap(t, find.text('Switch'));
      expect(find.text('Now showing Ananya\'s updates'), findsOneWidget);
      expect(getIt<FamilyBloc>().state.selected?.id, DemoData.ananya.id);

      // Contact info.
      await _show(t, find.text('EMERGENCY CONTACT'));
      expect(find.text('+91 98765 43210'), findsOneWidget);
      expect(find.text('Verified'), findsOneWidget);
      expect(find.text('+91 98110 33819 (Spouse)'), findsOneWidget);

      // Biometric toggle persists through SettingsBloc.
      await _tap(t, find.byKey(const ValueKey('profile-biometric')));
      expect(find.text('Biometric login turned off'), findsOneWidget);
      expect(getIt<LocalStorageService>().getBool('settings_biometric'), isFalse);

      // Help sheet.
      await _tap(t, find.text('Help & support'));
      expect(find.text('Call the school office'), findsOneWidget);
      await t.tap(find.text('support@greenfield.edu.in'));
      await t.pumpAndSettle();
      expect(find.text('support@greenfield.edu.in copied'), findsOneWidget);
    });

    testWidgets('menu rows open edit profile, settings and notifications', (t) async {
      await _open(t, RoutePaths.profile);
      await t.tap(find.text('Edit profile').first);
      await t.pumpAndSettle();
      expect(find.byType(EditProfileScreen), findsOneWidget);
      await t.tap(find.text('Cancel'));
      await t.pumpAndSettle();
      expect(find.byType(ProfileScreen), findsOneWidget);

      await _tap(t, find.text('Settings'));
      expect(find.byType(SettingsScreen), findsOneWidget);
      await t.tap(find.byTooltip('Back'));
      await t.pumpAndSettle();

      await _tap(t, find.text('Notifications'));
      expect(find.byType(NotificationsScreen), findsOneWidget);
      await t.tap(find.byTooltip('Back'));
      await t.pumpAndSettle();

      // Header bell.
      await t.tap(find.byKey(const ValueKey('notification-bell')));
      await t.pumpAndSettle();
      expect(find.byType(NotificationsScreen), findsOneWidget);
    });

    testWidgets('log out asks for confirmation, then signs out', (t) async {
      await _open(t, RoutePaths.profile);
      await _tap(t, find.text('Log out'));
      expect(find.text('Log out?'), findsOneWidget);
      await t.tap(find.text('Cancel'));
      await t.pumpAndSettle();
      expect(getIt<AuthBloc>().state.isAuthenticated, isTrue);

      await _tap(t, find.text('Log out'));
      await t.tap(find.widgetWithText(TextButton, 'Log out'));
      await t.pumpAndSettle();
      expect(getIt<AuthBloc>().state.isAuthenticated, isFalse);
      expect(find.byType(ProfileScreen), findsNothing);
    });
  });

  group('6.1 Edit Profile', () {
    testWidgets('validates inline', (t) async {
      await _open(t, RoutePaths.editProfile);
      await t.enterText(find.byKey(const ValueKey('edit-name')).last, 'A');
      await t.enterText(find.byKey(const ValueKey('edit-phone')).last, '12345');
      await t.enterText(find.byKey(const ValueKey('edit-email')).last, 'not-an-email');
      await t.tap(find.text('Save profile changes'));
      await t.pumpAndSettle();
      expect(find.text('Enter your full name'), findsOneWidget);
      expect(find.text('Enter a valid 10-digit mobile number'), findsOneWidget);
      expect(find.text('Enter a valid email address'), findsOneWidget);
      expect(find.text('Please fix the highlighted fields'), findsOneWidget);

      // Emergency number must differ from the guardian's own.
      await t.enterText(find.byKey(const ValueKey('edit-phone')).last, '9876543210');
      await _show(t, find.byKey(const ValueKey('edit-emergency-phone')));
      await t.enterText(find.byKey(const ValueKey('edit-emergency-phone')).last, '+91 98765 43210');
      await t.tap(find.text('Save profile changes'));
      await t.pumpAndSettle();
      expect(find.text('Use a different number from your own'), findsOneWidget);
    });

    testWidgets('saves and updates the guardian everywhere', (t) async {
      await _open(t, RoutePaths.profile);
      await t.tap(find.text('Edit profile').first);
      await t.pumpAndSettle();
      await t.tap(find.text('Mother'));
      await t.enterText(find.byKey(const ValueKey('edit-name')).last, 'Mrs. Priya Sharma');
      await t.enterText(find.byKey(const ValueKey('edit-email')).last, 'priya.sharma@example.com');
      await _show(t, find.byKey(const ValueKey('edit-emergency-name')));
      await t.enterText(find.byKey(const ValueKey('edit-emergency-name')).last, 'Mr. Rajesh Sharma');
      await t.tap(find.text('Save profile changes'));
      await t.pumpAndSettle();
      expect(find.text('Profile updated'), findsOneWidget);
      expect(find.byType(ProfileScreen), findsOneWidget);
      expect(find.text('Mrs. Priya Sharma'), findsWidgets);
      expect(find.text('Primary guardian - Mother'), findsOneWidget);
      expect(getIt<FamilyBloc>().state.guardian?.name, 'Mrs. Priya Sharma');
      expect(getIt<FamilyBloc>().state.guardian?.email, 'priya.sharma@example.com');
    });

    testWidgets('no changes, and cancel with changes asks to discard', (t) async {
      await _open(t, RoutePaths.profile);
      await t.tap(find.text('Edit profile').first);
      await t.pumpAndSettle();
      await t.tap(find.text('Save profile changes'));
      await t.pumpAndSettle();
      expect(find.text('No changes to save'), findsOneWidget);

      await t.enterText(find.byKey(const ValueKey('edit-name')).last, 'Mr. Rajesh Kumar Sharma');
      await t.tap(find.text('Cancel'));
      await t.pumpAndSettle();
      expect(find.text('Discard changes?'), findsOneWidget);
      await t.tap(find.text('Discard'));
      await t.pumpAndSettle();
      expect(find.byType(ProfileScreen), findsOneWidget);
      expect(getIt<FamilyBloc>().state.guardian?.name, 'Mr. Rajesh Sharma');
    });

    testWidgets('6.1.1 change picture: camera, gallery, remove, cancel', (t) async {
      await _open(t, RoutePaths.editProfile);
      Future<int?> photo() async => (await getIt<IProfileRepository>().watchProfile().first).photoStyle;

      await t.tap(find.byKey(const ValueKey('edit-photo')));
      await t.pumpAndSettle();
      expect(find.text('Update profile picture'), findsOneWidget);
      await t.tap(find.text('Take photo'));
      await t.pumpAndSettle();
      expect(find.text('Profile photo updated'), findsOneWidget);
      expect(await photo(), 1);

      await t.tap(find.byKey(const ValueKey('edit-photo')));
      await t.pumpAndSettle();
      await t.tap(find.text('Upload from gallery'));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('gallery-photo-3')));
      await t.pumpAndSettle();
      expect(await photo(), 3);

      await t.tap(find.byKey(const ValueKey('edit-photo')));
      await t.pumpAndSettle();
      await t.tap(find.text('Remove photo'));
      await t.pumpAndSettle();
      expect(find.text('Profile photo removed'), findsOneWidget);
      expect(await photo(), isNull);

      await t.tap(find.byKey(const ValueKey('edit-photo')));
      await t.pumpAndSettle();
      expect(find.text('Remove photo'), findsNothing);
      await t.tap(find.text('Cancel').last);
      await t.pumpAndSettle();
      expect(find.text('Update profile picture'), findsNothing);
    });
  });

  group('6.2 Settings', () {
    testWidgets('toggles persist, language picker, privacy link', (t) async {
      await _open(t, RoutePaths.settings);
      final storage = getIt<LocalStorageService>();
      expect(find.text('3 Active'), findsOneWidget);
      expect(find.textContaining('Parent ID: #GIS-PAR-0001'), findsOneWidget);

      await _tap(t, find.byKey(const ValueKey('setting-digest')));
      expect(find.text('4 Active'), findsOneWidget);
      expect(storage.getBool('settings_digest'), isTrue);
      await _tap(t, find.byKey(const ValueKey('setting-push')));
      await _tap(t, find.byKey(const ValueKey('setting-whatsapp')));
      await _tap(t, find.byKey(const ValueKey('setting-sms')));
      expect(find.text('1 Active'), findsOneWidget);
      expect(storage.getBool('settings_sms'), isFalse);
      await _tap(t, find.byKey(const ValueKey('setting-biometric')));
      expect(storage.getBool('settings_biometric'), isFalse);

      await _tap(t, find.byKey(const ValueKey('setting-language')));
      await t.tap(find.text('Hindi'));
      await t.pumpAndSettle();
      expect(find.text('Language set to Hindi'), findsOneWidget);
      expect(storage.getString('settings_language'), 'hindi');

      await _tap(t, find.text('School privacy policy & legal'));
      expect(find.byType(PrivacyPolicyScreen), findsOneWidget);
    });

    testWidgets('log out of all devices', (t) async {
      await _open(t, RoutePaths.settings);
      await _tap(t, find.text('Log out of all devices'));
      expect(find.text('Log out of all devices?'), findsOneWidget);
      await t.tap(find.widgetWithText(TextButton, 'Log out'));
      await t.pumpAndSettle();
      expect(getIt<AuthBloc>().state.isAuthenticated, isFalse);
      expect(find.byType(SettingsScreen), findsNothing);
    });
  });

  group('6.2.1 Privacy Policy', () {
    testWidgets('sections, DPO email and download', (t) async {
      await _open(t, RoutePaths.privacyPolicy);
      expect(find.text('1. Information we collect'), findsOneWidget);
      await t.tap(find.text('Download full policy (PDF - 1.2 MB)'));
      await t.pumpAndSettle();
      expect(find.text('Privacy policy saved to Downloads (PDF, 1.2 MB)'), findsOneWidget);
      await _tap(t, find.text('Email'));
      expect(find.text('DPO email copied: dpo@greenfield.edu.in'), findsOneWidget);
    });
  });

  group('7. Notifications', () {
    testWidgets('filters, counts and grouping', (t) async {
      await _open(t, RoutePaths.notifications);
      expect(find.text('Today'), findsOneWidget);
      expect(find.text('Yesterday'), findsOneWidget);
      expect(find.text('Bus #14 departed campus'), findsOneWidget);

      await t.tap(find.byKey(const ValueKey('notification-filter-unread')));
      await t.pumpAndSettle();
      expect(find.text('Q3 tuition fee invoice ready'), findsNothing);
      expect(find.text('Bus #14 departed campus'), findsOneWidget);

      await t.ensureVisible(find.byKey(const ValueKey('notification-filter-transit')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('notification-filter-transit')));
      await t.pumpAndSettle();
      expect(find.text('Term 2 Math pre-board schedule released'), findsNothing);

      await t.ensureVisible(find.byKey(const ValueKey('notification-filter-fees')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('notification-filter-fees')));
      await t.pumpAndSettle();
      expect(find.text('Q3 tuition fee invoice ready'), findsOneWidget);
      expect(find.text('Bus #14 departed campus'), findsNothing);
    });

    testWidgets('mark all read, X and swipe delete, acknowledge, quick action', (t) async {
      await _open(t, RoutePaths.notifications);
      final bloc = getIt<NotificationsBloc>();

      // Quick action on an unread card deep-links and marks it read.
      await t.tap(find.text('Track live bus'));
      await t.pumpAndSettle();
      expect(find.byType(NotificationsScreen), findsNothing);
      expect(bloc.state.byId('nf_bus')?.read, isTrue);
      await t.tap(find.byTooltip('Back').first);
      await t.pumpAndSettle();
      expect(find.byType(NotificationsScreen), findsOneWidget);

      // Acknowledge the school notice.
      await _tap(t, find.text('Acknowledge').first);
      expect(find.text('Notice acknowledged'), findsOneWidget);
      expect(bloc.state.byId('notice_nt_1')?.acknowledged, isTrue);

      // X delete.
      await _show(t, find.byKey(const ValueKey('notification-nf_merit')));
      await t.tap(find.descendant(
        of: find.byKey(const ValueKey('notification-nf_merit')),
        matching: find.byTooltip('Delete notification'),
      ));
      await t.pumpAndSettle();
      expect(find.text('Notification deleted'), findsOneWidget);
      expect(bloc.state.byId('nf_merit'), isNull);

      // Swipe delete.
      await _show(t, find.byKey(const ValueKey('notification-nf_fee')), delta: -150);
      await t.drag(find.byKey(const ValueKey('notification-nf_fee')), const Offset(-500, 0));
      await t.pumpAndSettle();
      expect(bloc.state.byId('nf_fee'), isNull);

      // Mark all read.
      await _show(t, find.byKey(const ValueKey('mark-all-read')), delta: -300);
      await t.tap(find.byKey(const ValueKey('mark-all-read')));
      await t.pumpAndSettle();
      expect(bloc.state.unread, 0);
      await t.tap(find.byKey(const ValueKey('notification-filter-unread')));
      await t.pumpAndSettle();
      expect(find.text('You are all caught up'), findsOneWidget);
    });
  });

  group('7.1 Notification Detail', () {
    testWidgets('opens from the list, marks read, acknowledge and delete', (t) async {
      await _open(t, RoutePaths.notifications);
      final bloc = getIt<NotificationsBloc>();
      expect(bloc.state.byId('notice_nt_1')?.read, isFalse);
      await _tap(t, find.text('Parent-teacher meeting this Saturday'));
      expect(find.byType(NotificationDetailScreen), findsOneWidget);
      expect(bloc.state.byId('notice_nt_1')?.read, isTrue);
      expect(find.text('The school has asked you to acknowledge this notice.'), findsOneWidget);
      await t.tap(find.text('Acknowledge'));
      await t.pumpAndSettle();
      expect(find.text('Acknowledged'), findsOneWidget);

      await t.tap(find.byTooltip('Delete notification'));
      await t.pumpAndSettle();
      await t.tap(find.widgetWithText(TextButton, 'Delete'));
      await t.pumpAndSettle();
      expect(find.byType(NotificationDetailScreen), findsNothing);
      expect(bloc.state.byId('notice_nt_1'), isNull);
    });

    testWidgets('deep link opens directly, action button navigates', (t) async {
      await _open(t, RoutePaths.notification('nf_fee'));
      expect(find.text('Q3 tuition fee invoice ready'), findsOneWidget);
      expect(find.textContaining('Ref: INV-Q3'), findsOneWidget);
      await t.tap(find.text('View fees'));
      await t.pumpAndSettle();
      expect(find.byType(NotificationDetailScreen), findsNothing);
    });

    testWidgets('unknown id shows not found', (t) async {
      await _open(t, RoutePaths.notification('missing'));
      expect(find.text('Notification not found'), findsOneWidget);
    });
  });
}
