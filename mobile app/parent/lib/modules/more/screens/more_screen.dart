import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../constants/app_constants.dart';
import '../../../design_system/design_system.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../family/bloc/family_bloc.dart';
import '../../family/screens/widgets/parent_tab_header.dart';

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

  @override
  Widget build(BuildContext context) => Column(
    children: [
      const ParentTabHeader(title: 'More'),
      Expanded(
        child: AppTabBody(
          children: [
            AppSettingsGroup([
              AppSettingsRow(
                icon: Icons.videocam_rounded,
                title: 'Live classes',
                subtitle: 'Join online classes on Google Meet',
                trailing: const Icon(
                  Icons.chevron_right_rounded,
                  color: C.muted,
                ),
                onTap: () => context.push(RoutePaths.liveClasses),
              ),
              AppSettingsRow(
                icon: Icons.beach_access_outlined,
                title: 'Leave',
                subtitle: 'Apply for leave and see history',
                trailing: const Icon(
                  Icons.chevron_right_rounded,
                  color: C.muted,
                ),
                onTap: () => context.push(RoutePaths.leave),
              ),
              AppSettingsRow(
                icon: Icons.account_balance_wallet_outlined,
                title: 'Fees',
                subtitle: 'Summary and invoices',
                trailing: const Icon(
                  Icons.chevron_right_rounded,
                  color: C.muted,
                ),
                onTap: () => context.push(RoutePaths.fees),
              ),
            ]),
            SizedBox(height: 14.h),
            AppSettingsGroup([
              AppSettingsRow(
                icon: Icons.person_outline_rounded,
                title: 'Profile and settings',
                subtitle: 'Children, contact details, notifications',
                trailing: const Icon(
                  Icons.chevron_right_rounded,
                  color: C.muted,
                ),
                onTap: () => context.push(RoutePaths.profile),
              ),
              AppSettingsRow(
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
  );
}
