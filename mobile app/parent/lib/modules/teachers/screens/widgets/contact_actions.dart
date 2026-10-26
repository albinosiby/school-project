import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../../family/bloc/family_bloc.dart';

/// Phone calls are simulated in the demo build: the snackbar names who would be called.
void simulateCall(BuildContext context, String name, String phone) =>
    AppDialogs.showSnackBar(
      context,
      message: 'Calling $name on $phone (simulated)',
    );

/// Trailing header actions of the student hub screens (bell -> notifications, avatar -> profile).
class HubHeaderActions extends StatelessWidget {
  const HubHeaderActions({super.key});

  @override
  Widget build(BuildContext context) => BlocBuilder<FamilyBloc, FamilyState>(
    buildWhen: (a, b) => a.guardian != b.guardian,
    builder: (context, state) => AppHeaderActions(
      userName: state.guardian?.name ?? 'Parent',
      onBell: () => context.push(RoutePaths.notifications),
      onAvatar: () => context.push(RoutePaths.profile),
    ),
  );
}
