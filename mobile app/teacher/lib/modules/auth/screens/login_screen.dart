import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_events.dart';
import '../bloc/auth_states.dart';
import '../models/auth_models.dart';
import 'widgets/auth_scaffold.dart';

/// The only screen before Home: email + password, or Google with the email the school registered. The router redirect moves to Home as soon as the session is authenticated.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    if (_form.currentState?.validate() != true) return;
    FocusScope.of(context).unfocus();
    context.read<AuthBloc>().add(AuthSignInRequested(_email.text.trim(), _password.text));
  }

  @override
  Widget build(BuildContext context) => AuthScaffold(
        title: 'Welcome back',
        subtitle: 'Sign in with the email your school registered for you.',
        child: BlocBuilder<AuthBloc, AuthState>(
          builder: (context, s) => Form(
            key: _form,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (s.error != null) AuthBanner(s.error!, error: true),
              AppTextField(label: 'School email', hint: 'name@school.edu', controller: _email, keyboard: TextInputType.emailAddress, validator: AuthValidators.email),
              AppTextField(label: 'Password', hint: 'Enter your password', controller: _password, obscure: true, validator: AuthValidators.password),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(onPressed: () => context.push(RoutePaths.forgotPassword), child: Text('Forgot password?', style: T.bodyStrong.copyWith(color: C.primary))),
              ),
              SizedBox(height: 8.h),
              AppButton('Sign in', busy: s.busy, onPressed: _submit),
              SizedBox(height: 16.h),
              Row(children: [
                const Expanded(child: Divider(color: C.panelBorder)),
                Padding(padding: EdgeInsets.symmetric(horizontal: 12.w), child: Text('or', style: T.small)),
                const Expanded(child: Divider(color: C.panelBorder)),
              ]),
              SizedBox(height: 16.h),
              AppButton(
                'Continue with Google',
                key: const Key('google_sign_in'),
                kind: BtnKind.outline,
                icon: Icons.g_mobiledata_rounded,
                onPressed: s.busy ? null : () => context.read<AuthBloc>().add(const AuthGoogleSignInRequested()),
              ),
              SizedBox(height: 8.h),
              Text('Use the Google account of the email your school registered.', style: T.small, textAlign: TextAlign.center),
            ]),
          ),
        ),
      );
}
