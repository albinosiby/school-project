import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../config/app_config.dart';
import '../../../../design_system/design_system.dart';
import '../../bloc/auth_bloc.dart';
import '../../bloc/auth_events.dart';

/// "Sign out" row for the profile / More screens. Hidden on the local backend (it has no login).
/// After confirming, the auth guard in the router sends the teacher back to the sign-in screen.
class SignOutTile extends StatelessWidget {
  const SignOutTile({super.key, this.visible});

  /// Overrides the backend check (tests).
  final bool? visible;

  @override
  Widget build(BuildContext context) {
    if (!(visible ?? AppConfig.isFirebase)) return const SizedBox.shrink();
    final email = context.watch<AuthBloc>().state.user?.email ?? '';
    return Padding(
      padding: EdgeInsets.only(top: 14.h),
      child: AppCard(
        radius: R.lg, padding: EdgeInsets.all(14.r),
        onTap: () async {
          final ok = await AppDialogs.showConfirmDialog(context, title: 'Sign out?', message: 'You will need your email and password to sign in again.', confirm: 'Sign out', danger: true);
          if (ok && context.mounted) context.read<AuthBloc>().add(const AuthSignOutRequested());
        },
        child: Row(children: [
          Container(
            width: 38.r, height: 38.r,
            decoration: BoxDecoration(color: C.dangerSoft, borderRadius: BorderRadius.circular(R.md)),
            child: Icon(Icons.logout_rounded, color: C.danger, size: 20.r),
          ),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Sign out', style: T.bodyStrong.copyWith(color: C.danger)),
              if (email.isNotEmpty) Text(email, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
        ]),
      ),
    );
  }
}
