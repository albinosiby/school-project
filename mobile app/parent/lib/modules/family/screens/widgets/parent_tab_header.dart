import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../constants/app_constants.dart';
import '../../../../design_system/design_system.dart';
import '../../bloc/family_bloc.dart';
import 'child_switcher.dart';

/// Top of every tab screen: branded header + child switcher.
class ParentTabHeader extends StatelessWidget {
  const ParentTabHeader({super.key, required this.title, this.subtitle});
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) => BlocBuilder<FamilyBloc, FamilyState>(
    buildWhen: (a, b) => a.guardian != b.guardian,
    builder: (context, state) => Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AppTabHeader(
          eyebrow: AppConstants.schoolName.toUpperCase(),
          title: title,
          subtitle: subtitle,
          icon: Icons.family_restroom_rounded,
          userName: state.guardian?.name ?? 'Parent',
          onBell: () => context.go(RoutePaths.inbox),
          onAvatar: () => context.push(RoutePaths.profile),
        ),
        const ChildSwitcher(),
      ],
    ),
  );
}
