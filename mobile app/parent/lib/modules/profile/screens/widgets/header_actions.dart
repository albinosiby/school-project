import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../../family/bloc/family_bloc.dart';
import '../../../notifications/screens/widgets/notification_bell.dart';

/// Bell + guardian avatar at the right of the profile/settings detail headers (Figma 6.x, 7.x).
List<Widget> profileHeaderActions({bool avatar = true}) => [
  const NotificationBellButton(),
  if (avatar) const _ProfileAvatarButton(),
];

class _ProfileAvatarButton extends StatelessWidget {
  const _ProfileAvatarButton();

  @override
  Widget build(BuildContext context) {
    final name = context.select<FamilyBloc, String>(
      (b) => b.state.guardian?.name ?? 'Parent',
    );
    return Semantics(
      button: true,
      label: 'My profile',
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () => context.push(RoutePaths.profile),
        child: Padding(
          padding: EdgeInsets.all(4.r),
          child: Avatar(name, size: 36, online: true),
        ),
      ),
    );
  }
}
