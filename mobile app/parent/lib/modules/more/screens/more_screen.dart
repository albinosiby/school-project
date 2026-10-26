import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../constants/app_constants.dart';
import '../../../design_system/design_system.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../family/bloc/family_bloc.dart';
import '../../family/screens/widgets/parent_tab_header.dart';
import 'widgets/more_hub_tile.dart';

/// One link of the More hub.
class MoreLink {
  const MoreLink(
    this.icon,
    this.title,
    this.subtitle,
    this.route, {
    this.tone = Tone.brand,
  });
  final IconData icon;
  final String title, subtitle, route;
  final Tone tone;
}

/// Student hub tiles (Figma 5.x screens + home module screens without a tab).
const moreStudentLinks = [
  MoreLink(
    Icons.badge_outlined,
    'Student Profile',
    'Identity & records',
    RoutePaths.studentProfile,
  ),
  MoreLink(
    Icons.workspace_premium_outlined,
    'Certificates',
    'Awards & bonafide',
    RoutePaths.certificates,
    tone: Tone.warning,
  ),
  MoreLink(
    Icons.groups_2_outlined,
    'Meetings',
    'Parent-teacher',
    RoutePaths.ptm,
    tone: Tone.purple,
  ),
  MoreLink(
    Icons.co_present_outlined,
    'Teachers',
    'Faculty list',
    RoutePaths.teachers,
    tone: Tone.success,
  ),
  MoreLink(
    Icons.emoji_events_outlined,
    'Behaviour',
    'Merits & notes',
    RoutePaths.behaviour,
    tone: Tone.danger,
  ),
  MoreLink(
    Icons.directions_bus_outlined,
    'Track Live',
    'School bus',
    RoutePaths.trackLive,
  ),
];

const moreClassLinks = [
  MoreLink(
    Icons.edit_calendar_outlined,
    'Apply Leave',
    'Send a leave request to the class teacher',
    RoutePaths.leaveApply,
  ),
  MoreLink(
    Icons.beach_access_outlined,
    'Leave History',
    'Applications and their status',
    RoutePaths.leave,
  ),
  MoreLink(
    Icons.videocam_outlined,
    'Live Classes',
    'Join online classes on Google Meet',
    RoutePaths.liveClasses,
  ),
];

const moreAccountLinks = [
  MoreLink(
    Icons.notifications_none_rounded,
    'Notifications',
    'Circulars, alerts and reminders',
    RoutePaths.notifications,
  ),
  MoreLink(
    Icons.person_outline_rounded,
    'My Profile',
    'Guardian details and children',
    RoutePaths.profile,
  ),
  MoreLink(
    Icons.settings_outlined,
    'Settings',
    'Notifications, language and security',
    RoutePaths.settings,
  ),
  MoreLink(
    Icons.privacy_tip_outlined,
    'Privacy Policy',
    'How the school uses your data',
    RoutePaths.privacyPolicy,
  ),
];

/// More tab: hub linking to every screen that has no tab of its own, plus sign out.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  Future<void> signOut(BuildContext context) async {
    final ok = await AppDialogs.showConfirmDialog(
      context,
      title: 'Sign out?',
      message:
          'You will need to sign in again to see your children\'s updates.',
      confirm: 'Sign out',
      danger: true,
    );
    if (!ok || !context.mounted) return;
    context.read<FamilyBloc>().add(const ClearFamily());
    context.read<AuthBloc>().add(const LogoutRequested());
  }

  Widget _group(BuildContext context, List<MoreLink> links) =>
      AppSettingsGroup([
        for (final l in links)
          AppSettingsRow(
            key: Key('more-${l.route}'),
            icon: l.icon,
            title: l.title,
            subtitle: l.subtitle,
            trailing: Icon(
              Icons.chevron_right_rounded,
              color: C.muted,
              size: 22.r,
            ),
            onTap: () => context.push(l.route),
          ),
      ]);

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: C.surface,
    child: Column(
      children: [
        const ParentTabHeader(title: 'More'),
        Expanded(
          child: AppTabBody(
            children: [
              const _ChildCard(),
              const SectionHeader('Student', caps: true),
              LayoutBuilder(
                builder: (context, box) {
                  final gap = 10.w;
                  final w = (box.maxWidth - gap * 2) / 3;
                  return Wrap(
                    spacing: gap,
                    runSpacing: gap,
                    children: [
                      for (final l in moreStudentLinks)
                        SizedBox(
                          width: w,
                          child: MoreHubTile(
                            key: Key('more-${l.route}'),
                            icon: l.icon,
                            title: l.title,
                            subtitle: l.subtitle,
                            tone: l.tone,
                            onTap: () => context.push(l.route),
                          ),
                        ),
                    ],
                  );
                },
              ),
              const SectionHeader('Attendance & Classes', caps: true),
              _group(context, moreClassLinks),
              const SectionHeader('Account', caps: true),
              _group(context, moreAccountLinks),
              SizedBox(height: 14.h),
              AppSettingsGroup([
                AppSettingsRow(
                  key: const Key('more-sign-out'),
                  icon: Icons.logout_rounded,
                  title: 'Sign out',
                  subtitle: 'Leave this device',
                  onTap: () => signOut(context),
                ),
              ]),
              SizedBox(height: 20.h),
              Center(
                child: Text(
                  '${AppConstants.schoolName}\nParent app - demo build with sample data',
                  textAlign: TextAlign.center,
                  style: T.small,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

/// Selected child summary; opens the student profile.
class _ChildCard extends StatelessWidget {
  const _ChildCard();

  @override
  Widget build(BuildContext context) => BlocBuilder<FamilyBloc, FamilyState>(
    buildWhen: (a, b) => a.selected != b.selected,
    builder: (context, state) {
      final c = state.selected;
      if (c == null) return const SizedBox.shrink();
      return AppSurfaceCard(
        hero: true,
        semanticLabel: 'Open ${c.name}\'s profile',
        onTap: () => context.push(RoutePaths.studentProfile),
        child: Row(
          children: [
            Container(
              padding: EdgeInsets.all(2.r),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(colors: [C.primary, C.primaryDark]),
              ),
              child: Avatar(c.name, size: 56),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('VIEWING', style: T.caps.copyWith(fontSize: 10.sp)),
                  Text(
                    c.name,
                    style: T.h2.copyWith(color: C.onSurface),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    'Class ${c.className} • Roll #${c.rollNo}',
                    style: T.small.copyWith(color: C.onSurfaceVariant),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: C.muted, size: 24.r),
          ],
        ),
      );
    },
  );
}
