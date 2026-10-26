import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../utils/mixins/validation_mixins.dart';
import '../bloc/auth_bloc.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen>
    with ValidationMixin {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<AuthBloc>().add(const PasswordResetCleared());
  }

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => BlocBuilder<AuthBloc, AuthState>(
    builder: (context, auth) {
      final sent = auth.reset == ResetStatus.sent;
      return DetailScaffold(
        title: 'Forgot password',
        fallbackRoute: RoutePaths.login,
        body: SingleChildScrollView(
          padding: EdgeInsets.all(S.page + 4.w),
          child: sent
              ? AppEmptyState(
                  'Check your email',
                  hint:
                      'If ${_email.text.trim()} is registered with the school, a reset link is on its way.',
                  icon: Icons.mark_email_read_outlined,
                )
              : Form(
                  key: _form,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Enter the email registered with the school and we will send you a link to reset your password.',
                        style: T.body,
                      ),
                      SizedBox(height: 20.h),
                      AppTextField(
                        label: 'Email',
                        hint: 'you@example.com',
                        controller: _email,
                        keyboard: TextInputType.emailAddress,
                        validator: validateEmail,
                      ),
                      if (auth.reset == ResetStatus.failed)
                        Padding(
                          padding: EdgeInsets.only(bottom: 12.h),
                          child: Text(
                            auth.resetError ?? 'Could not send the link.',
                            style: T.small.copyWith(color: C.danger),
                          ),
                        ),
                      AppButton(
                        'Send reset link',
                        icon: Icons.send_rounded,
                        busy: auth.reset == ResetStatus.sending,
                        onPressed: () {
                          if (_form.currentState?.validate() ?? false)
                            context.read<AuthBloc>().add(
                              PasswordResetRequested(_email.text),
                            );
                        },
                      ),
                    ],
                  ),
                ),
        ),
      );
    },
  );
}
