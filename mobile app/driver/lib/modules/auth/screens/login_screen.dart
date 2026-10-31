import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/app_config.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/demo_data.dart';
import '../bloc/auth_bloc.dart';

/// Onboarding 6 (Figma "Driver Terminal Access"): email + password set from the school's invite.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _form = GlobalKey<FormState>();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    context.read<AuthBloc>().add(LoginSubmitted(_email.text, _password.text));
  }

  void _demo(String email) {
    _email.text = email;
    _password.text = DemoStore.password;
    _submit();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: C.surface,
    appBar: const DetailHeader('Driver Terminal Access', fallbackRoute: RoutePaths.welcome),
    body: BlocConsumer<AuthBloc, AuthState>(
      listenWhen: (a, b) => a.error != b.error && b.error != null,
      listener: (context, s) => ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(behavior: SnackBarBehavior.floating, backgroundColor: C.danger, content: Text(s.error!))),
      builder: (context, state) {
        final busy = state.status == AuthStatus.authenticating;
        return Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: kContentMaxWidth),
            child: ListView(
              padding: EdgeInsets.all(16.w),
              children: [
                AppSurfaceCard(
                  child: Row(children: [
                    IconTile(Icons.directions_bus_rounded, tone: Tone.brand, size: 48),
                    SizedBox(width: 12.w),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Pill('Transport Wing Linked', tone: Tone.success, dot: true),
                        SizedBox(height: 6.h),
                        Text('Driver / Bus Staff Sign In', style: T.h2),
                        SizedBox(height: 4.h),
                        Text('Use the email the transport office registered and the password you set from the invite email.', style: T.small),
                      ]),
                    ),
                  ]),
                ),
                SizedBox(height: 16.h),
                AppSurfaceCard(
                  child: Form(
                    key: _form,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      AppTextField(
                        label: 'Registered email', controller: _email, hint: 'name@school.edu', keyboard: TextInputType.emailAddress,
                        validator: (v) => (v ?? '').contains('@') ? null : 'Enter your registered email',
                      ),
                      AppTextField(
                        label: 'Password', controller: _password, obscure: true, hint: '••••••••',
                        validator: (v) => (v ?? '').length >= 6 ? null : 'Enter your password',
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(onPressed: () => context.push(RoutePaths.forgot), child: Text('Forgot password?', style: T.smallStrong.copyWith(color: C.primary))),
                      ),
                      SizedBox(height: 6.h),
                      AppButton('Sign In', icon: Icons.arrow_forward_rounded, busy: busy, onPressed: busy ? null : _submit),
                    ]),
                  ),
                ),
                if (AppConfig.isLocal) ...[
                  SizedBox(height: 16.h),
                  Text('DEMO LOGINS', style: T.capsMuted),
                  SizedBox(height: 8.h),
                  AppSurfaceCard(
                    padding: EdgeInsets.zero,
                    child: Column(children: [
                      ListTile(
                        leading: const Avatar('Rajesh Kumar', tone: Tone.brand),
                        title: Text('Rajesh Kumar', style: T.bodyStrong), subtitle: Text('Lead Driver · Bus 14', style: T.small),
                        trailing: Icon(Icons.chevron_right_rounded, color: C.muted), onTap: busy ? null : () => _demo(DemoStore.driverEmail),
                      ),
                      const Divider(height: 1, color: C.border),
                      ListTile(
                        leading: const Avatar('Sunita Devi', tone: Tone.purple),
                        title: Text('Sunita Devi', style: T.bodyStrong), subtitle: Text('Bus Attendant · Bus 14', style: T.small),
                        trailing: Icon(Icons.chevron_right_rounded, color: C.muted), onTap: busy ? null : () => _demo(DemoStore.attendantEmail),
                      ),
                    ]),
                  ),
                  SizedBox(height: 8.h),
                  Text('Demo password: ${DemoStore.password}. No real school data.', style: T.small, textAlign: TextAlign.center),
                ],
              ],
            ),
          ),
        );
      },
    ),
  );
}
