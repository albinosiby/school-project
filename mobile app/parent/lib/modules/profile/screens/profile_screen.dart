import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../constants/app_constants.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../family/bloc/family_bloc.dart';
import '../../family/models/family_models.dart';
import '../../notifications/screens/widgets/notification_bell.dart';
import '../../settings/bloc/settings_bloc.dart';
import '../bloc/profile_bloc.dart';
import '../models/guardian_profile.dart';
import 'widgets/guardian_avatar.dart';
import 'widgets/header_actions.dart';
import 'widgets/sign_out.dart';

const _schoolPhone = '+91 124 456 7800';
const _supportEmail = 'support@greenfield.edu.in';

/// Figma "6. Profile": guardian card, linked students, contact info and the account menu.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) => MultiBlocProvider(
    providers: [
      BlocProvider(create: (_) => getIt<ProfileBloc>()..add(const LoadProfile())),
      BlocProvider(create: (_) => getIt<SettingsBloc>()..add(const LoadSettings())),
    ],
    child: DetailScaffold(
      title: 'Parent profile',
      fallbackRoute: RoutePaths.more,
      actions: profileHeaderActions(avatar: false),
      body: const _ProfileBody(),
    ),
  );
}

class _ProfileBody extends StatefulWidget {
  const _ProfileBody();
  @override
  State<_ProfileBody> createState() => _ProfileBodyState();
}

class _ProfileBodyState extends State<_ProfileBody> {
  @override
  void initState() {
    super.initState();
    _loadAttendance(context.read<FamilyBloc>().state.children);
  }

  void _loadAttendance(List<Child> children) {
    if (children.isEmpty) return;
    context.read<ProfileBloc>().add(
      LoadChildAttendance([for (final c in children) c.id]),
    );
  }

  @override
  Widget build(BuildContext context) => BlocListener<FamilyBloc, FamilyState>(
    listenWhen: (a, b) => a.children != b.children,
    listener: (context, s) => _loadAttendance(s.children),
    child: BlocBuilder<ProfileBloc, ProfileState>(
      builder: (context, state) {
        final p = state.profile;
        if (p == null) {
          return state.status == LoadStatus.error
              ? AppErrorWidget(
                  message: state.error ?? 'Could not load your profile.',
                  onRetry: () => context.read<ProfileBloc>().add(const LoadProfile()),
                )
              : const AppLoading(rows: 4);
        }
        return ListView(
          padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 24.h),
          children: [
            _GuardianCard(profile: p),
            SizedBox(height: 20.h),
            _LinkedStudents(attendance: state.attendance),
            SizedBox(height: 20.h),
            Text('Contact & guardian info', style: T.h2),
            SizedBox(height: 10.h),
            _ContactCard(profile: p),
            SizedBox(height: 20.h),
            Text('Account', style: T.h2),
            SizedBox(height: 10.h),
            const _AccountMenu(),
            SizedBox(height: 16.h),
            Center(
              child: Text(
                'ISO 27001 Certified - Version 4.8.2',
                style: T.small.copyWith(color: C.muted),
              ),
            ),
          ],
        );
      },
    ),
  );
}

class _GuardianCard extends StatelessWidget {
  const _GuardianCard({required this.profile});
  final GuardianProfile profile;

  @override
  Widget build(BuildContext context) {
    final g = profile.guardian;
    return AppCard(
      radius: R.xl,
      padding: EdgeInsets.all(16.r),
      child: Column(
        children: [
          GuardianAvatar(
            name: g.name,
            style: profile.photoStyle,
            badge: Container(
              padding: EdgeInsets.all(3.r),
              decoration: BoxDecoration(
                color: C.primary,
                borderRadius: BorderRadius.circular(R.sm),
                border: Border.all(color: Colors.white, width: 2),
              ),
              child: Icon(Icons.verified_rounded, color: Colors.white, size: 14.r),
            ),
          ),
          SizedBox(height: 10.h),
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8.w,
            runSpacing: 4.h,
            children: [
              Text(g.name, style: T.h1, maxLines: 1, overflow: TextOverflow.ellipsis),
              Pill('Primary guardian - ${g.relation}', tone: Tone.brand),
            ],
          ),
          SizedBox(height: 4.h),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.apartment_rounded, size: 16.r, color: C.slate),
              SizedBox(width: 4.w),
              Flexible(
                child: Text(
                  AppConstants.schoolName,
                  style: T.small,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          Padding(
            padding: EdgeInsets.symmetric(vertical: 12.h),
            child: const Divider(height: 1, color: C.border),
          ),
          Row(
            children: [
              Expanded(
                flex: 3,
                child: AppButton(
                  'Edit profile',
                  kind: BtnKind.soft,
                  icon: Icons.edit_outlined,
                  onPressed: () => context.push(RoutePaths.editProfile),
                ),
              ),
              SizedBox(width: 8.w),
              Expanded(
                flex: 2,
                child: Semantics(
                  button: true,
                  label: 'Copy parent ID ${profile.parentId}',
                  excludeSemantics: true,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(R.md),
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: profile.parentId));
                      AppDialogs.showSnackBar(context, message: 'Parent ID copied');
                    },
                    child: Container(
                      constraints: BoxConstraints(minHeight: 44.h),
                      alignment: Alignment.center,
                      padding: EdgeInsets.symmetric(horizontal: 6.w),
                      decoration: BoxDecoration(
                        color: C.primarySoft,
                        borderRadius: BorderRadius.circular(R.md),
                      ),
                      child: Text(
                        'ID: ${profile.parentId}',
                        style: T.smallStrong.copyWith(color: C.primary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LinkedStudents extends StatelessWidget {
  const _LinkedStudents({required this.attendance});
  final Map<String, double> attendance;

  @override
  Widget build(BuildContext context) => BlocBuilder<FamilyBloc, FamilyState>(
    builder: (context, fam) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text('Linked students', style: T.h2)),
            Text(
              '${fam.children.length} ${fam.children.length == 1 ? 'kid' : 'kids'}',
              style: T.small,
            ),
          ],
        ),
        SizedBox(height: 10.h),
        if (fam.children.isEmpty)
          const AppCard(
            child: AppEmptyState(
              'No children linked',
              hint: 'Please contact the school office.',
              icon: Icons.family_restroom_rounded,
            ),
          )
        else
          for (final c in fam.children)
            _ChildCard(
              child: c,
              selected: c.id == fam.selected?.id,
              attendance: attendance[c.id],
            ),
      ],
    ),
  );
}

class _ChildCard extends StatelessWidget {
  const _ChildCard({required this.child, required this.selected, this.attendance});
  final Child child;
  final bool selected;
  final double? attendance;

  void _switch(BuildContext context) {
    context.read<FamilyBloc>().add(SelectChild(child.id));
    AppDialogs.showSnackBar(context, message: 'Now showing ${child.firstName}\'s updates');
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 10.h),
    child: AppCard(
      key: ValueKey('profile-child-${child.id}'),
      radius: R.lg,
      color: selected ? C.primarySoft : C.bg,
      border: selected ? C.primary.withValues(alpha: .4) : C.border,
      onTap: selected ? null : () => _switch(context),
      child: Row(
        children: [
          Avatar(child.name, size: 48, tone: selected ? Tone.brand : Tone.purple),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        child.name,
                        style: T.h3,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (selected) ...[
                      SizedBox(width: 6.w),
                      const Pill('Active', tone: Tone.brand, dot: true),
                    ],
                  ],
                ),
                Text(
                  'Class ${child.className} - Roll #${child.rollNo}',
                  style: T.small,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (attendance != null)
                  Text(
                    '${attendance!.toStringAsFixed(1)}% Attendance',
                    style: T.small.copyWith(color: selected ? C.primary : C.slate),
                  ),
              ],
            ),
          ),
          if (selected)
            Icon(Icons.check_circle_outline_rounded, color: C.primary, size: 24.r)
          else
            AppButton(
              'Switch',
              small: true,
              expand: false,
              kind: BtnKind.soft,
              icon: Icons.swap_horiz_rounded,
              onPressed: () => _switch(context),
            ),
        ],
      ),
    ),
  );
}

class _ContactCard extends StatelessWidget {
  const _ContactCard({required this.profile});
  final GuardianProfile profile;

  @override
  Widget build(BuildContext context) {
    final g = profile.guardian;
    return AppSettingsGroup([
      _ContactRow(
        icon: Icons.phone_outlined,
        label: 'Mobile number',
        value: g.phone,
        trailing: profile.phoneVerified
            ? const Pill('Verified', tone: Tone.brand, icon: Icons.check_circle_outline_rounded)
            : const Pill('Unverified', tone: Tone.warning),
      ),
      _ContactRow(icon: Icons.mail_outline_rounded, label: 'Email address', value: g.email),
      _ContactRow(icon: Icons.location_on_outlined, label: 'Residential address', value: profile.address),
      _ContactRow(
        icon: Icons.contact_emergency_outlined,
        label: 'EMERGENCY CONTACT',
        value: '${profile.emergencyPhone} (${profile.emergencyRelation})',
        caption: profile.emergencyName,
        danger: true,
      ),
    ]);
  }
}

class _ContactRow extends StatelessWidget {
  const _ContactRow({
    required this.icon,
    required this.label,
    required this.value,
    this.caption,
    this.trailing,
    this.danger = false,
  });
  final IconData icon;
  final String label, value;
  final String? caption;
  final Widget? trailing;
  final bool danger;

  @override
  Widget build(BuildContext context) => Container(
    color: danger ? C.dangerSoft.withValues(alpha: .5) : null,
    padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
    child: Row(
      children: [
        IconTile(icon, tone: danger ? Tone.danger : Tone.brand, size: 36),
        SizedBox(width: 12.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: danger ? T.caps.copyWith(color: C.danger) : T.small,
              ),
              Text(value, style: T.bodyStrong, maxLines: 3, overflow: TextOverflow.ellipsis),
              if (caption != null) Text(caption!, style: T.small),
            ],
          ),
        ),
        if (trailing != null) ...[SizedBox(width: 8.w), trailing!],
      ],
    ),
  );
}

class _AccountMenu extends StatelessWidget {
  const _AccountMenu();

  @override
  Widget build(BuildContext context) => AppSettingsGroup([
    BlocBuilder<SettingsBloc, SettingsState>(
      builder: (context, s) => AppSettingsRow(
        key: const ValueKey('profile-biometric'),
        icon: Icons.fingerprint_rounded,
        title: 'Face ID & biometrics',
        subtitle: 'Instant authentication',
        switchValue: s.settings.biometric,
        onSwitch: (v) {
          context.read<SettingsBloc>().add(UpdateSettings(s.settings.copyWith(biometric: v)));
          AppDialogs.showSnackBar(
            context,
            message: v ? 'Biometric login turned on' : 'Biometric login turned off',
          );
        },
      ),
    ),
    UnreadNotificationsBuilder(
      builder: (context, unread) => AppSettingsRow(
        icon: Icons.notifications_none_rounded,
        title: 'Notifications',
        subtitle: unread == 0 ? 'You are all caught up' : '$unread unread',
        trailing: _chevron,
        onTap: () => context.push(RoutePaths.notifications),
      ),
    ),
    AppSettingsRow(
      icon: Icons.settings_outlined,
      title: 'Settings',
      subtitle: 'Push, SMS, WhatsApp',
      trailing: _chevron,
      onTap: () => context.push(RoutePaths.settings),
    ),
    AppSettingsRow(
      icon: Icons.help_outline_rounded,
      title: 'Help & support',
      subtitle: 'Contact the school office',
      trailing: _chevron,
      onTap: () => _showHelp(context),
    ),
    AppSettingsRow(
      icon: Icons.logout_rounded,
      title: 'Log out',
      trailing: _chevron,
      onTap: () => confirmSignOut(context),
    ),
  ]);

  static final Widget _chevron = Builder(
    builder: (_) => Icon(Icons.chevron_right_rounded, color: C.slate, size: 22.r),
  );

  static void _showHelp(BuildContext context) => showAppSheet<void>(
    context,
    title: 'Help & support',
    subtitle: 'The school office is open 08:30 AM - 04:00 PM, Monday to Saturday.',
    builder: (ctx) => Column(
      children: [
        for (final (icon, label, value) in [
          (Icons.call_outlined, 'Call the school office', _schoolPhone),
          (Icons.mail_outline_rounded, 'Email support', _supportEmail),
        ])
          Padding(
            padding: EdgeInsets.only(bottom: 10.h),
            child: AppPickTile(
              icon: icon,
              caption: label,
              label: value,
              trailing: Icon(Icons.copy_rounded, size: 20.r, color: C.slate),
              onTap: () {
                Clipboard.setData(ClipboardData(text: value));
                Navigator.pop(ctx);
                AppDialogs.showSnackBar(context, message: '$value copied');
              },
            ),
          ),
      ],
    ),
  );
}
