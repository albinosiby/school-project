import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../family/bloc/family_bloc.dart';
import '../../profile/bloc/profile_bloc.dart';
import '../../profile/screens/widgets/guardian_avatar.dart';
import '../../profile/screens/widgets/header_actions.dart';
import '../../profile/screens/widgets/sign_out.dart';
import '../bloc/settings_bloc.dart';
import '../models/app_settings.dart';

/// Figma "6.2 Settings": security, notification channels, language, privacy policy, log out everywhere.
/// Every change is persisted on the device (LocalSettingsRepository).
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) => MultiBlocProvider(
    providers: [
      BlocProvider(create: (_) => getIt<SettingsBloc>()..add(const LoadSettings())),
      BlocProvider(create: (_) => getIt<ProfileBloc>()..add(const LoadProfile())),
    ],
    child: DetailScaffold(
      title: 'Settings',
      fallbackRoute: RoutePaths.profile,
      actions: profileHeaderActions(),
      body: BlocBuilder<SettingsBloc, SettingsState>(
        builder: (context, state) {
          if (state.status == LoadStatus.loading) return const AppLoading(rows: 5);
          if (state.status == LoadStatus.error) {
            return AppErrorWidget(
              message: state.error ?? 'Could not load your settings.',
              onRetry: () => context.read<SettingsBloc>().add(const LoadSettings()),
            );
          }
          final s = state.settings;
          void update(AppSettings next) =>
              context.read<SettingsBloc>().add(UpdateSettings(next));
          return ListView(
            padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 24.h),
            children: [
              const _GuardianSummary(),
              SizedBox(height: 12.h),
              AppSettingsGroup([
                const _GroupHeader(
                  icon: Icons.shield_outlined,
                  title: 'Security & authentication',
                  badge: Pill('SECURED', tone: Tone.brand),
                ),
                AppSettingsRow(
                  key: const ValueKey('setting-biometric'),
                  title: 'Biometric / Face ID login',
                  subtitle: 'Instant authorization on app launch',
                  switchValue: s.biometric,
                  onSwitch: (v) => update(s.copyWith(biometric: v)),
                ),
              ]),
              SizedBox(height: 12.h),
              AppSettingsGroup([
                _GroupHeader(
                  icon: Icons.notifications_active_outlined,
                  title: 'Notification channels',
                  badge: Pill(
                    '${s.activeChannels} Active',
                    tone: s.activeChannels == 0 ? Tone.neutral : Tone.success,
                  ),
                ),
                AppSettingsRow(
                  key: const ValueKey('setting-push'),
                  title: 'Instant push notifications',
                  subtitle: 'Urgent school circulars, bus transit & live alerts',
                  switchValue: s.push,
                  onSwitch: (v) => update(s.copyWith(push: v)),
                ),
                AppSettingsRow(
                  key: const ValueKey('setting-whatsapp'),
                  title: 'WhatsApp broadcasts',
                  subtitle: 'Fee reminders, term report cards & receipts',
                  switchValue: s.whatsapp,
                  onSwitch: (v) => update(s.copyWith(whatsapp: v)),
                ),
                AppSettingsRow(
                  key: const ValueKey('setting-sms'),
                  title: 'SMS emergency & transit alerts',
                  subtitle: 'Morning bus pickup and geofence departures',
                  switchValue: s.sms,
                  onSwitch: (v) => update(s.copyWith(sms: v)),
                ),
                AppSettingsRow(
                  key: const ValueKey('setting-digest'),
                  title: 'Weekly academic digest',
                  subtitle: 'Consolidated weekend email performance summary',
                  switchValue: s.digest,
                  onSwitch: (v) => update(s.copyWith(digest: v)),
                ),
              ]),
              SizedBox(height: 12.h),
              AppSettingsGroup([
                const _GroupHeader(icon: Icons.tune_rounded, title: 'App preferences'),
                AppSettingsRow(
                  key: const ValueKey('setting-language'),
                  title: 'App language',
                  trailing: Container(
                    padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
                    decoration: BoxDecoration(
                      color: C.surface,
                      borderRadius: BorderRadius.circular(R.sm),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(s.language.label, style: T.small.copyWith(color: C.ink)),
                        SizedBox(width: 4.w),
                        Icon(Icons.unfold_more_rounded, size: 18.r, color: C.slate),
                      ],
                    ),
                  ),
                  onTap: () async {
                    final lang = await showPickSheet<AppLanguage>(
                      context,
                      title: 'App language',
                      items: AppLanguage.values,
                      label: (l) => l.label,
                      selected: s.language,
                    );
                    if (lang == null || lang == s.language || !context.mounted) return;
                    update(s.copyWith(language: lang));
                    AppDialogs.showSnackBar(context, message: 'Language set to ${lang.label}');
                  },
                ),
              ]),
              SizedBox(height: 12.h),
              AppSettingsGroup([
                AppSettingsRow(
                  title: 'School privacy policy & legal',
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Read', style: T.smallStrong.copyWith(color: C.primary)),
                      SizedBox(width: 4.w),
                      Icon(Icons.open_in_new_rounded, size: 16.r, color: C.primary),
                    ],
                  ),
                  onTap: () => context.push(RoutePaths.privacyPolicy),
                ),
              ]),
              SizedBox(height: 16.h),
              AppButton(
                'Log out of all devices',
                kind: BtnKind.danger,
                icon: Icons.logout_rounded,
                onPressed: () => confirmSignOut(context, allDevices: true),
              ),
              SizedBox(height: 12.h),
              Center(
                child: Text(
                  'EduAdmin Parent Core v4.8.2 - Build 2026.11',
                  style: T.small.copyWith(color: C.muted),
                ),
              ),
            ],
          );
        },
      ),
    ),
  );
}

class _GuardianSummary extends StatelessWidget {
  const _GuardianSummary();

  @override
  Widget build(BuildContext context) {
    final fam = context.watch<FamilyBloc>().state;
    final profile = context.watch<ProfileBloc>().state.profile;
    final name = fam.guardian?.name ?? profile?.guardian.name ?? 'Parent';
    final child = fam.selected;
    return AppCard(
      radius: R.xl,
      onTap: () => context.push(RoutePaths.profile),
      child: Row(
        children: [
          GuardianAvatar(name: name, style: profile?.photoStyle, size: 52),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(name, style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                    SizedBox(width: 4.w),
                    Icon(Icons.verified_rounded, size: 18.r, color: C.primary),
                  ],
                ),
                Text(
                  [
                    if (profile != null) 'Parent ID: #${profile.parentId}',
                    if (child != null) '${child.firstName} (Grade ${child.className})',
                  ].join(' - '),
                  style: T.small,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GroupHeader extends StatelessWidget {
  const _GroupHeader({required this.icon, required this.title, this.badge});
  final IconData icon;
  final String title;
  final Widget? badge;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 12.h),
    child: Row(
      children: [
        IconTile(icon, size: 36),
        SizedBox(width: 12.w),
        Expanded(
          child: Text(title, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
        ?badge,
      ],
    ),
  );
}
