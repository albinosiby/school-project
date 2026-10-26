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

/// Sends a Firebase password-reset email (also how a new teacher sets the first password).
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AuthScaffold(
        title: 'Reset password',
        subtitle: 'Enter your school email and we will send you a link to choose a new password.',
        onBack: () {
          context.read<AuthBloc>().add(const AuthMessageCleared());
          context.canPop() ? context.pop() : context.go(RoutePaths.login);
        },
        child: BlocBuilder<AuthBloc, AuthState>(
          builder: (context, s) => Form(
            key: _form,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (s.error != null) AuthBanner(s.error!, error: true),
              if (s.notice != null) AuthBanner(s.notice!),
              AppTextField(label: 'School email', hint: 'name@school.edu', controller: _email, keyboard: TextInputType.emailAddress, validator: AuthValidators.email),
              SizedBox(height: 8.h),
              AppButton('Send reset link', busy: s.busy, onPressed: () {
                if (_form.currentState?.validate() != true) return;
                FocusScope.of(context).unfocus();
                context.read<AuthBloc>().add(AuthPasswordResetRequested(_email.text.trim()));
              }),
            ]),
          ),
        ),
      );
}
