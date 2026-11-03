import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../bloc/auth_bloc.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _email = TextEditingController();
  // kept from initState: dispose() must not look up ancestors (the element is already deactivated)
  late final AuthBloc _auth = context.read<AuthBloc>();

  @override
  void initState() {
    super.initState();
    _auth; // resolve while the element is active
  }

  @override
  void dispose() {
    _email.dispose();
    _auth.add(const PasswordResetCleared());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Reset password',
    fallbackRoute: RoutePaths.login,
    body: BlocBuilder<AuthBloc, AuthState>(
      builder: (context, s) => ListView(
        padding: EdgeInsets.all(16.w),
        children: [
          if (s.reset == ResetStatus.sent)
            AppSurfaceCard(
              color: C.successSoft, borderColor: C.successSoft,
              child: Row(children: [
                Icon(Icons.mark_email_read_rounded, color: C.successDark, size: 28.r),
                SizedBox(width: 12.w),
                Expanded(child: Text('If this email has a login, a reset link is on its way. Open it on this phone to set a new password.', style: T.bodyStrong.copyWith(color: C.successDark))),
              ]),
            )
          else ...[
            Text('Enter the email the transport office registered for you. We send a link to set a new password.', style: T.body),
            SizedBox(height: 16.h),
            AppTextField(label: 'Registered email', controller: _email, keyboard: TextInputType.emailAddress, hint: 'name@school.edu'),
            if (s.resetError != null) Padding(padding: EdgeInsets.only(bottom: 10.h), child: Text(s.resetError!, style: T.small.copyWith(color: C.danger))),
            AppButton('Send reset link', busy: s.reset == ResetStatus.sending, onPressed: () => context.read<AuthBloc>().add(PasswordResetRequested(_email.text))),
          ],
        ],
      ),
    ),
  );
}
