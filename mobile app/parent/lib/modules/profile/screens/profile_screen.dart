import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../../../design_system/design_system.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../family/bloc/family_bloc.dart';
import '../../family/models/family_models.dart';

/// Guardian profile, linked children and simple settings.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _notices = true, _homework = true, _live = true;

  Future<void> _signOut() async {
    final ok = await AppDialogs.showConfirmDialog(
      context,
      title: 'Sign out?',
      message:
          'You will need to sign in again to see your children\'s updates.',
      confirm: 'Sign out',
      danger: true,
    );
    if (!ok || !mounted) return;
    context.read<FamilyBloc>().add(const ClearFamily());
    context.read<AuthBloc>().add(const LogoutRequested());
  }

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Profile and settings',
    fallbackRoute: RoutePaths.more,
    body: BlocBuilder<FamilyBloc, FamilyState>(
      builder: (context, state) {
        if (state.status == LoadStatus.error)
          return AppErrorWidget(
            message: state.error ?? 'Could not load your profile.',
            onRetry: () => context.read<FamilyBloc>().add(const LoadFamily()),
          );
        final g = state.guardian;
        if (g == null)
          return state.status == LoadStatus.loading
              ? const AppLoading(rows: 3)
              : Center(
                  child: AppEmptyState(
                    'No profile',
                    icon: Icons.person_off_outlined,
                  ),
                );
        return ListView(
          padding: EdgeInsets.all(S.page),
          children: [
            PanelCard(
              child: Row(
                children: [
                  Avatar(g.name, size: 60),
                  SizedBox(width: 14.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(g.name, style: T.h1),
                        Text(g.relation, style: T.small),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: 10.h),
            AppInfoTile(
              icon: Icons.mail_outline_rounded,
              label: 'EMAIL',
              value: g.email,
            ),
            SizedBox(height: 8.h),
            AppInfoTile(
              icon: Icons.phone_outlined,
              label: 'PHONE',
              value: g.phone,
            ),
            const SectionHeader('Children'),
            if (state.children.isEmpty)
              AppCard(
                child: Center(
                  child: AppEmptyState(
                    'No children linked',
                    hint: 'Please contact the school office.',
                    icon: Icons.family_restroom_rounded,
                  ),
                ),
              )
            else
              for (final c in state.children)
                _ChildCard(child: c, selected: c.id == state.selected?.id),
            const SectionHeader('Notifications'),
            AppSwitchTile(
              title: 'Notices',
              subtitle: 'School and class announcements',
              value: _notices,
              onChanged: (v) => setState(() => _notices = v),
            ),
            AppSwitchTile(
              title: 'Homework',
              subtitle: 'New homework and due reminders',
              value: _homework,
              onChanged: (v) => setState(() => _homework = v),
            ),
            AppSwitchTile(
              title: 'Live classes',
              subtitle: 'Reminder 10 minutes before a class',
              value: _live,
              onChanged: (v) => setState(() => _live = v),
            ),
            SizedBox(height: 16.h),
            AppButton(
              'Sign out',
              kind: BtnKind.danger,
              icon: Icons.logout_rounded,
              onPressed: _signOut,
            ),
          ],
        );
      },
    ),
  );
}

class _ChildCard extends StatelessWidget {
  const _ChildCard({required this.child, required this.selected});
  final Child child;
  final bool selected;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 10.h),
    child: AppCard(
      key: ValueKey('profile-child-${child.id}'),
      color: selected ? C.primarySoft : C.bg,
      border: selected ? C.primary.withValues(alpha: .4) : C.border,
      onTap: () => context.read<FamilyBloc>().add(SelectChild(child.id)),
      child: Row(
        children: [
          Avatar(child.name, size: 48),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(child.name, style: T.h3),
                Text(
                  'Grade ${child.className} - Roll no. ${child.rollNo}',
                  style: T.small,
                ),
                Text(
                  '${child.admissionNo} - Class teacher: ${child.classTeacher}',
                  style: T.small,
                ),
              ],
            ),
          ),
          if (selected)
            const Pill('Selected', tone: Tone.brand, icon: Icons.check_rounded),
        ],
      ),
    ),
  );
}
