import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../config/app_config.dart';
import '../../config/routes/routes.dart';
import '../../constants/app_constants.dart';
import '../../design_system/design_system.dart';
import '../../di/injection.dart';
import '../../modules/auth/bloc/auth_bloc.dart';
import '../../modules/auth/bloc/auth_events.dart';
import '../../modules/home/bloc/settings_bloc.dart';
import '../../modules/home/bloc/settings_events.dart';
import '../../modules/home/models/home_models.dart';
import '../../modules/home/models/timetable_models.dart';
import '../../modules/home/screens/widgets/edit_account_sheet.dart';
import '../../modules/home/screens/widgets/teacher_tab_header.dart';
import '../../modules/school/bloc/school_bloc.dart';
import '../../modules/school/models/school_models.dart';
import '../../utils/helpers/date_helper.dart' show hhmm, parseTime;
import '../../utils/services/firebase/push_notification_service.dart';
import '../../utils/services/local_storage_service.dart';

/// App-level preferences kept in [LocalStorageService] (theme, first-run walkthrough flag).
class ApplicationSettings {
  final LocalStorageService _storage;

  ApplicationSettings(this._storage);

  ThemeMode get themeMode {
    final saved = _storage.savedThemeMode;
    switch (saved) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    await _storage.setThemeMode(mode.name);
  }

  bool get isOnboardingComplete => _storage.isOnboardingComplete;

  Future<void> completeOnboarding() => _storage.setOnboardingComplete();

  /// Log out: the router sends the user back through the walkthrough.
  Future<void> resetOnboarding() => _storage.remove(AppConstants.onboardingKey);
}

/// "7.1 Notification & Account Settings" (Figma 1153:2156), route RoutePaths.settings.
class ApplicationSettingsScreen extends StatelessWidget {
  const ApplicationSettingsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<SettingsBloc>()..add(const SettingsLoadRequested()),
        child: const _SettingsView(),
      );
}

class _SettingsView extends StatelessWidget {
  const _SettingsView();

  Future<void> _pickQuietHours(BuildContext context, AppSettings st) async {
    final from = await showTimePicker(context: context, initialTime: parseTime(st.dndFrom), helpText: 'Quiet hours start');
    if (from == null || !context.mounted) return;
    final to = await showTimePicker(context: context, initialTime: parseTime(st.dndTo), helpText: 'Quiet hours end');
    if (to == null || !context.mounted) return;
    context.read<SettingsBloc>().add(SettingsChanged(st.copyWith(dndFrom: hhmm(from), dndTo: hhmm(to))));
    AppDialogs.showSnackBar(context, message: 'Quiet hours updated');
  }

  Future<void> _logOut(BuildContext context) async {
    if (AppConfig.isFirebase) {
      // a real sign-out: removes this phone's push token and returns to the login page (router guard)
      final ok = await AppDialogs.showConfirmDialog(context, title: 'Log out?', message: 'You will need your email and password to sign in again.', confirm: 'Log Out', danger: true);
      if (ok && context.mounted) context.read<AuthBloc>().add(const AuthSignOutRequested());
      return;
    }
    final ok = await AppDialogs.showConfirmDialog(context,
        title: 'Log out?', message: 'You will return to the welcome screen. Your data stays on this device.', confirm: 'Log Out', danger: true);
    if (!ok || !context.mounted) return;
    await ApplicationSettings(getIt<LocalStorageService>()).resetOnboarding();
    if (context.mounted) context.go(RoutePaths.onboarding);
  }

  @override
  Widget build(BuildContext context) {
    final st = context.watch<SettingsBloc>().state.settings;
    final school = context.watch<SchoolBloc>().state;
    final me = school.teacher;
    final classes = school.classes;
    final def = (st.defaultClass == null ? null : school.classById(st.defaultClass!)) ?? classes.firstOrNull;
    void save(AppSettings s) => context.read<SettingsBloc>().add(SettingsChanged(s));
    final chevron = Icon(Icons.chevron_right_rounded, color: C.muted, size: 22.r);

    return DetailScaffold(
      title: 'Settings',
      fallbackRoute: RoutePaths.profile,
      actions: const [TeacherHeaderActions()],
      body: ListView(padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 40.h), children: [
        AppCard(
          radius: R.xl, onTap: () => showEditAccountSheet(context),
          child: Row(children: [
            Avatar(me?.name ?? 'T', size: 56, online: true), SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(me?.name ?? '', style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis),
                SizedBox(height: 4.h),
                const Pill('Verified', tone: Tone.success, dot: true),
                SizedBox(height: 4.h),
                Text('${me?.designation ?? ''} • ${me?.empId ?? ''}', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
              ]),
            ),
            Semantics(label: 'Edit account', child: Icon(Icons.edit_outlined, size: 18.r, color: C.slate)),
          ]),
        ),
        const SectionHeader('Account & security', caps: true),
        AppSettingsGroup([
          AppSettingsRow(icon: Icons.fingerprint_rounded, title: 'Biometric Login', subtitle: 'Face ID / Touch ID recognition', switchValue: st.biometric, onSwitch: (v) => save(st.copyWith(biometric: v))),
        ]),
        const SectionHeader('Notifications & preferences', caps: true),
        if (AppConfig.isFirebase) ...[const _PushPermissionRow(), SizedBox(height: 10.h)],
        AppSettingsGroup([
          AppSettingsRow(title: 'Class & Student Updates', subtitle: 'Attendance alerts & leave requests', switchValue: st.classUpdates, onSwitch: (v) => save(st.copyWith(classUpdates: v))),
          AppSettingsRow(title: 'Parent & Direct Messages', subtitle: 'Instant messages from school channels', switchValue: st.parentMessages, onSwitch: (v) => save(st.copyWith(parentMessages: v))),
          AppSettingsRow(
            title: 'Urgent Broadcasts', subtitle: 'Emergency administrative circulars', tinted: true,
            badge: const Pill('MANDATORY', tone: Tone.warning), switchValue: true, // always on: shown on, cannot be switched off
            onSwitch: (_) => AppDialogs.showSnackBar(context, message: 'Urgent broadcasts are always on'),
          ),
          AppSettingsRow(title: 'Sound & Vibration', subtitle: 'In-app chimes & haptics', switchValue: st.sound, onSwitch: (v) => save(st.copyWith(sound: v))),
        ]),
        const SectionHeader('Teaching & classroom preferences', caps: true),
        AppSettingsGroup([
          AppSettingsRow(
            title: 'Default Academic Class',
            subtitle: def == null ? 'No classes' : 'Class ${def.label} (${def.subject})',
            trailing: Row(mainAxisSize: MainAxisSize.min, children: [Pill(def == null ? 'None' : 'Class ${def.label}'), chevron]),
            onTap: () async {
              final c = await showPickSheet<SchoolClass>(context,
                  title: 'Default academic class', items: classes, selected: def, label: (c) => 'Class ${c.label} (${c.subject})');
              if (c == null || !context.mounted) return;
              save(st.copyWith(defaultClass: c.id));
              AppDialogs.showSnackBar(context, message: 'Default class updated');
            },
          ),
          AppSettingsRow(title: 'Attendance Quick-Mark', subtitle: 'One-tap default all present on start', switchValue: st.quickMark, onSwitch: (v) => save(st.copyWith(quickMark: v))),
        ]),
        const SectionHeader('Focus & quiet hours', caps: true),
        AppSettingsGroup([
          AppSettingsRow(icon: Icons.bedtime_outlined, title: 'Do Not Disturb', subtitle: 'Mutes non-urgent parent chats', switchValue: st.dnd, onSwitch: (v) => save(st.copyWith(dnd: v))),
          AppSettingsRow(
            icon: Icons.schedule_rounded, title: '${t12(st.dndFrom)} – ${t12(st.dndTo)}', subtitle: 'Tap to change quiet hours',
            trailing: chevron, onTap: () => _pickQuietHours(context, st),
          ),
          AppSettingsRow(title: 'Parent Chat Mute', subtitle: 'Silence incoming parent DMs on Sat & Sun', switchValue: st.parentMute, onSwitch: (v) => save(st.copyWith(parentMute: v))),
        ]),
        const SectionHeader('System & storage', caps: true),
        AppSettingsGroup([
          AppSettingsRow(
            icon: Icons.sync_rounded, title: 'Sync Frequency', subtitle: 'Auto-sync on Wi-Fi & cellular',
            trailing: Row(mainAxisSize: MainAxisSize.min, children: [Pill(st.sync, tone: Tone.success), chevron]),
            onTap: () async {
              final f = await showPickSheet<String>(context, title: 'Sync frequency', items: AppSettings.syncOptions, selected: st.sync, label: (f) => f);
              if (f == null || !context.mounted) return;
              save(st.copyWith(sync: f));
              AppDialogs.showSnackBar(context, message: 'Sync set to $f');
            },
          ),
          AppSettingsRow(
            icon: Icons.palette_outlined, title: 'Design System', subtitle: 'Tokens and reusable components',
            trailing: chevron, onTap: () => context.push(RoutePaths.showcase),
          ),
          const AppSettingsRow(icon: Icons.info_outline_rounded, title: 'Application Build', subtitle: 'v3.4.2 (Official)'),
        ]),
        SizedBox(height: 20.h),
        AppButton('Log Out', icon: Icons.logout_rounded, kind: BtnKind.danger, onPressed: () => _logOut(context)),
        SizedBox(height: 10.h),
        Center(
          child: Text('${me?.school ?? ''} Faculty Portal • Session DPS-2026-X89', style: T.small.copyWith(fontSize: 11.sp), textAlign: TextAlign.center),
        ),
      ]),
    );
  }
}

/// Whether this phone shows the app's notifications (the OS permission asked at login), with a way to turn it on.
class _PushPermissionRow extends StatefulWidget {
  const _PushPermissionRow();
  @override
  State<_PushPermissionRow> createState() => _PushPermissionRowState();
}

class _PushPermissionRowState extends State<_PushPermissionRow> with WidgetsBindingObserver {
  bool? granted;

  PushNotificationService get _push => getIt<PushNotificationService>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // back from the phone's Settings app: show the new state
  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    if (s == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _refresh() async {
    final g = await _push.permissionGranted().catchError((_) => null);
    if (mounted) setState(() => granted = g);
  }

  Future<void> _turnOn() async {
    final ok = await _push.enable().catchError((_) => false);
    if (!mounted) return;
    setState(() => granted = ok);
    if (ok == true) {
      AppDialogs.showSnackBar(context, message: 'Notifications are on for this phone');
    } else {
      await AppDialogs.showInfoDialog(context,
          title: 'Notifications are blocked',
          message: 'Turn them on in your phone: Settings > Apps > EduAdmin Teacher > Notifications > Allow notifications. Then come back here.');
    }
  }

  @override
  Widget build(BuildContext context) => AppSettingsGroup([
        AppSettingsRow(
          icon: Icons.notifications_active_outlined,
          title: 'Push notifications',
          subtitle: granted == null ? 'Checking…' : granted! ? 'On: you get alerts even when the app is closed' : 'Off: tap to turn on',
          badge: granted == null ? null : Pill(granted! ? 'ON' : 'OFF', tone: granted! ? Tone.success : Tone.danger),
          switchValue: granted ?? false,
          onSwitch: (v) {
            if (v) {
              _turnOn();
            } else {
              AppDialogs.showInfoDialog(context,
                  title: 'Turn off notifications',
                  message: 'Use the switches below to choose what you get, or turn them all off in your phone: Settings > Apps > EduAdmin Teacher > Notifications.');
            }
          },
        ),
      ]);
}
