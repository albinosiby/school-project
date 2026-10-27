import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../bloc/auth_bloc.dart';

/// Page frame of the onboarding screens: light background, centred phone-width column, scrolling body.
/// When the guardian becomes signed in while this page is on top, it opens "Select Student Profile".
class AuthPage extends StatelessWidget {
  const AuthPage({super.key, required this.children, this.bottom});
  final List<Widget> children;

  /// Sticky footer (e.g. the Continue button).
  final Widget? bottom;

  @override
  Widget build(BuildContext context) => BlocListener<AuthBloc, AuthState>(
    listenWhen: (a, b) => !a.isAuthenticated && b.isAuthenticated,
    listener: (context, auth) {
      if (!(ModalRoute.of(context)?.isCurrent ?? true)) return;
      final p = auth.provider;
      if (p != null) {
        AppDialogs.showSnackBar(
          context,
          message:
              'Signed in with ${p.label} as ${auth.guardian?.name ?? 'guardian'} (demo)',
        );
      }
      context.go(RoutePaths.selectChild);
    },
    child: Scaffold(
      backgroundColor: C.surface,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: kContentMaxWidth),
            child: Column(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(20.w, 8.h, 20.w, 24.h),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: children,
                    ),
                  ),
                ),
                if (bottom != null)
                  Padding(
                    padding: EdgeInsets.fromLTRB(20.w, 8.h, 20.w, 12.h),
                    child: bottom,
                  ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

/// "──── OR QUICK ACCESS ────" divider.
class OrDivider extends StatelessWidget {
  const OrDivider(this.label, {super.key});
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Expanded(child: Divider(color: C.border)),
      Padding(
        padding: EdgeInsets.symmetric(horizontal: 10.w),
        child: Text(
          label.toUpperCase(),
          style: T.capsMuted.copyWith(color: C.muted),
        ),
      ),
      const Expanded(child: Divider(color: C.border)),
    ],
  );
}

/// Google + Apple ID quick access buttons (simulated sign-in as the demo guardian).
class SocialSignInRow extends StatelessWidget {
  const SocialSignInRow({super.key});

  @override
  Widget build(BuildContext context) => BlocBuilder<AuthBloc, AuthState>(
    buildWhen: (a, b) => a.busy != b.busy,
    builder: (context, auth) => Row(
      children: [
        Expanded(
          child: _SocialButton(
            provider: SocialProvider.google,
            leading: Text('G', style: T.h3.copyWith(color: C.googleBlue)),
            enabled: !auth.busy,
          ),
        ),
        SizedBox(width: 12.w),
        Expanded(
          child: _SocialButton(
            provider: SocialProvider.apple,
            leading: Icon(Icons.apple, size: 22.r, color: C.ink),
            enabled: !auth.busy,
          ),
        ),
      ],
    ),
  );
}

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.provider,
    required this.leading,
    required this.enabled,
  });
  final SocialProvider provider;
  final Widget leading;
  final bool enabled;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: 'Continue with ${provider.label}',
    child: OutlinedButton(
      key: ValueKey('social-${provider.name}'),
      onPressed: enabled
          ? () => context.read<AuthBloc>().add(SocialSignInRequested(provider))
          : null,
      style: OutlinedButton.styleFrom(
        backgroundColor: C.bg,
        minimumSize: Size(0, 48.h),
        side: const BorderSide(color: C.border),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(R.md),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          leading,
          SizedBox(width: 8.w),
          Flexible(
            child: Text(
              provider.label,
              overflow: TextOverflow.ellipsis,
              style: T.bodyStrong.copyWith(color: C.slateDark),
            ),
          ),
        ],
      ),
    ),
  );
}
