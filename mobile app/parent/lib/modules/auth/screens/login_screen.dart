import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/demo_data.dart';
import '../../../utils/mixins/validation_mixins.dart';
import '../bloc/auth_bloc.dart';
import '../repositories/auth_demo_data.dart';
import 'widgets/auth_page.dart';
import 'widgets/mobile_number_field.dart';
import 'widgets/school_contact.dart';

/// Figma "Onboarding 2": sign in with the registered mobile number or School ID / email + password.
/// Both send a 6-digit passcode (Onboarding 3).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  static const mobileTab = 'Mobile / WhatsApp';
  static const emailTab = 'School ID / Email';

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with ValidationMixin {
  final _form = GlobalKey<FormState>();
  final _mobile = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  String _tab = LoginScreen.mobileTab;

  bool get _byMobile => _tab == LoginScreen.mobileTab;

  @override
  void dispose() {
    _mobile.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_form.currentState?.validate() ?? false)) return;
    final auth = context.read<AuthBloc>();
    auth.add(
      _byMobile
          ? MobileOtpRequested(_mobile.text)
          : LoginSubmitted(_email.text, _password.text),
    );
  }

  void _fillDemo() {
    setState(() {
      _mobile.text = DemoData.guardian.phone
          .replaceAll(RegExp(r'\D'), '')
          .substring(2);
      _email.text = DemoData.demoEmail;
      _password.text = DemoData.demoPassword;
    });
  }

  @override
  Widget build(BuildContext context) => BlocListener<AuthBloc, AuthState>(
    listenWhen: (a, b) =>
        a.status == AuthStatus.authenticating && b.status == AuthStatus.otpSent,
    listener: (context, _) {
      if (ModalRoute.of(context)?.isCurrent ?? true) {
        context.push(RoutePaths.loginOtp);
      }
    },
    child: AuthPage(
      children: [
        AppFlowHeader('Parent sign in', fallbackRoute: RoutePaths.welcome),
        SizedBox(height: 12.h),
        const Align(
          alignment: Alignment.centerLeft,
          child: Pill(AuthDemoData.school, icon: Icons.verified_rounded),
        ),
        SizedBox(height: 14.h),
        Text('Welcome Back', style: T.title),
        SizedBox(height: 6.h),
        Text(
          "Access your ward's academic scores, daily attendance, bus tracking, and fee statements.",
          style: T.body.copyWith(fontSize: 13.sp),
        ),
        SizedBox(height: 18.h),
        AppSegmented(
          track: true,
          items: const [LoginScreen.mobileTab, LoginScreen.emailTab],
          value: _tab,
          onChanged: (t) => setState(() {
            _tab = t;
            context.read<AuthBloc>().add(const OtpCancelled());
          }),
        ),
        SizedBox(height: 14.h),
        Form(
          key: _form,
          child: AppCard(
            padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 6.h),
            child: _byMobile ? _mobileFields() : _emailFields(),
          ),
        ),
        BlocBuilder<AuthBloc, AuthState>(
          buildWhen: (a, b) => a.error != b.error,
          builder: (context, auth) => auth.error == null
              ? const SizedBox.shrink()
              : Padding(
                  padding: EdgeInsets.only(top: 12.h),
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
        ),
        SizedBox(height: 16.h),
        BlocBuilder<AuthBloc, AuthState>(
          buildWhen: (a, b) => a.status != b.status,
          builder: (context, auth) => AppButton(
            'Sign In Securely',
            key: const Key('login-submit'),
            icon: Icons.lock_outline_rounded,
            busy: auth.status == AuthStatus.authenticating,
            onPressed: _submit,
          ),
        ),
        SizedBox(height: 18.h),
        const OrDivider('Or continue with'),
        SizedBox(height: 14.h),
        const SocialSignInRow(),
        SizedBox(height: 16.h),
        AppCard(
          color: C.panel,
          border: C.panelBorder,
          radius: R.lg,
          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 2.h),
          onTap: () => context.push(RoutePaths.register),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('First time here?', style: T.body),
              TextButton.icon(
                key: const Key('login-register'),
                onPressed: () => context.push(RoutePaths.register),
                iconAlignment: IconAlignment.end,
                icon: Icon(Icons.arrow_forward_rounded, size: 16.r),
                label: Text(
                  'Register',
                  style: T.bodyStrong.copyWith(color: C.primary),
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 12.h),
        AppCard(
          color: C.panel,
          border: C.panelBorder,
          radius: R.lg,
          onTap: _fillDemo,
          padding: EdgeInsets.all(12.r),
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
                      'Tap to fill ${DemoData.guardian.phone} / ${DemoData.demoEmail}',
                      style: T.small,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 16.h),
        Text(
          'Need help? Contact School Registrar Desk at',
          textAlign: TextAlign.center,
          style: T.small.copyWith(fontSize: 13.sp),
        ),
        Center(
          child: TextButton(
            onPressed: () =>
                callSchoolDesk(context, desk: 'School Registrar Desk'),
            style: TextButton.styleFrom(minimumSize: Size(0, 44.h)),
            child: Text(
              AuthDemoData.helpdeskPhone,
              style: T.bodyStrong.copyWith(color: C.primary),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _mobileFields() => Column(
    key: const Key('login-mobile-form'),
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'REGISTERED MOBILE NUMBER',
        style: T.capsMuted.copyWith(color: C.slateDark),
      ),
      SizedBox(height: 8.h),
      MobileNumberField(
        controller: _mobile,
        fieldKey: const Key('login-mobile'),
        helper: 'Linked to student portal admission records',
      ),
      SizedBox(height: 10.h),
    ],
  );

  Widget _emailFields() => Column(
    key: const Key('login-email-form'),
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      AppTextField(
        label: 'School ID / Email',
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
      Align(
        alignment: Alignment.centerRight,
        child: TextButton(
          onPressed: () => context.push(RoutePaths.forgotPassword),
          style: TextButton.styleFrom(minimumSize: Size(0, 44.h)),
          child: Text(
            'Forgot password?',
            style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.sp),
          ),
        ),
      ),
    ],
  );
}
