import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../constants/app_constants.dart';
import '../../../design_system/design_system.dart';
import '../../../di/demo_data.dart';
import '../../../utils/mixins/validation_mixins.dart';
import '../bloc/auth_bloc.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with ValidationMixin {
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
    if (_form.currentState?.validate() ?? false) {
      context.read<AuthBloc>().add(LoginSubmitted(_email.text, _password.text));
    }
  }

  void _fillDemo() {
    _email.text = DemoData.demoEmail;
    _password.text = DemoData.demoPassword;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: kContentMaxWidth),
          child: BlocBuilder<AuthBloc, AuthState>(
            builder: (context, auth) {
              final busy = auth.status == AuthStatus.authenticating;
              return SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                  S.page + 8.w,
                  32.h,
                  S.page + 8.w,
                  24.h,
                ),
                child: Form(
                  key: _form,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 64.r,
                        height: 64.r,
                        decoration: BoxDecoration(
                          color: C.primaryDark,
                          borderRadius: BorderRadius.circular(R.xl),
                        ),
                        child: Icon(
                          Icons.family_restroom_rounded,
                          color: Colors.white,
                          size: 34.r,
                        ),
                      ),
                      SizedBox(height: 20.h),
                      Text(
                        AppConstants.schoolName.toUpperCase(),
                        style: T.caps,
                      ),
                      SizedBox(height: 4.h),
                      Text('Welcome, parent', style: T.title),
                      SizedBox(height: 6.h),
                      Text(
                        'Sign in to follow attendance, homework, marks and notices for your children.',
                        style: T.body,
                      ),
                      SizedBox(height: 28.h),
                      AppTextField(
                        label: 'Email',
                        hint: 'you@example.com',
                        controller: _email,
                        keyboard: TextInputType.emailAddress,
                        validator: validateEmail,
                      ),
                      AppTextField(
                        label: 'Password',
                        hint: 'Your password',
                        controller: _password,
                        obscure: true,
                        validator: (v) => validateRequired(v, 'Password'),
                      ),
                      if (auth.error != null)
                        Padding(
                          padding: EdgeInsets.only(bottom: 12.h),
                          child: Row(
                            children: [
                              Icon(
                                Icons.error_outline_rounded,
                                color: C.danger,
                                size: 18.r,
                              ),
                              SizedBox(width: 6.w),
                              Expanded(
                                child: Text(
                                  auth.error!,
                                  key: const Key('login-error'),
                                  style: T.small.copyWith(color: C.danger),
                                ),
                              ),
                            ],
                          ),
                        ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () =>
                              context.push(RoutePaths.forgotPassword),
                          child: Text(
                            'Forgot password?',
                            style: T.bodyStrong.copyWith(
                              color: C.primary,
                              fontSize: 13.sp,
                            ),
                          ),
                        ),
                      ),
                      SizedBox(height: 8.h),
                      AppButton(
                        'Sign in',
                        icon: Icons.login_rounded,
                        busy: busy,
                        onPressed: _submit,
                      ),
                      SizedBox(height: 20.h),
                      AppCard(
                        color: C.panel,
                        border: C.panelBorder,
                        radius: R.lg,
                        onTap: _fillDemo,
                        child: Row(
                          children: [
                            const IconTile(Icons.science_outlined, size: 36),
                            SizedBox(width: 12.w),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Demo family', style: T.bodyStrong),
                                  Text(
                                    'Tap to fill ${DemoData.demoEmail}',
                                    style: T.small,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    ),
  );
}
