import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../design_system/design_system.dart';
import '../../../auth/bloc/auth_bloc.dart';
import '../../../family/bloc/family_bloc.dart';

/// Confirm, then sign out: the auth guard returns the app to the signed-out start screen.
Future<void> confirmSignOut(BuildContext context, {bool allDevices = false}) async {
  final ok = await AppDialogs.showConfirmDialog(
    context,
    title: allDevices ? 'Log out of all devices?' : 'Log out?',
    message: allDevices
        ? 'You will be signed out on this phone and every other device using your account.'
        : 'You will need to sign in again to see your children\'s updates.',
    confirm: 'Log out',
    danger: true,
  );
  if (!ok || !context.mounted) return;
  context.read<FamilyBloc>().add(const ClearFamily());
  context.read<AuthBloc>().add(const LogoutRequested());
}
