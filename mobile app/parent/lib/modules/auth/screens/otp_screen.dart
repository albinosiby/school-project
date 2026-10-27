import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../bloc/auth_bloc.dart';
import '../repositories/auth_demo_data.dart';
import 'widgets/auth_page.dart';
import 'widgets/otp_input.dart';

/// Figma "Onboarding 3": verify the 6-digit passcode sent to the guardian's registered mobile.
class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _code = TextEditingController();
  late final AuthBloc _auth = context.read<AuthBloc>();
  Timer? _timer;
  int _secondsLeft = 0;
  String? _challengeId;
  bool _showLengthError = false;

  @override
  void initState() {
    super.initState();
    _startCountdown(_auth.state.challenge);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    // Leaving the step without signing in drops the pending passcode.
    if (!_auth.state.isAuthenticated && !_auth.isClosed) {
      _auth.add(const OtpCancelled());
    }
    super.dispose();
  }

  void _startCountdown(OtpChallenge? c) {
    _timer?.cancel();
    _challengeId = c?.id;
    if (c == null) return;
    _secondsLeft = OtpChallenge.resendAfter.inSeconds;
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => _secondsLeft--);
      if (_secondsLeft <= 0) t.cancel();
    });
  }

  void _verify() {
    if (_code.text.length != OtpChallenge.codeLength) {
      setState(() => _showLengthError = true);
      return;
    }
    setState(() => _showLengthError = false);
    _auth.add(OtpSubmitted(_code.text));
  }

  void _resend(OtpChannel channel) => _auth.add(OtpResendRequested(channel));

  @override
  Widget build(BuildContext context) => BlocConsumer<AuthBloc, AuthState>(
    listenWhen: (a, b) =>
        a.challenge?.id != b.challenge?.id ||
        (a.attempts != b.attempts && b.error != null),
    listener: (context, auth) {
      final c = auth.challenge;
      if (c != null && c.id != _challengeId) {
        _code.clear();
        _startCountdown(c);
        AppDialogs.showSnackBar(
          context,
          message: switch (c.channel) {
            OtpChannel.sms => 'A new passcode was sent by SMS',
            OtpChannel.whatsapp => 'A new passcode was sent on WhatsApp',
            OtpChannel.voice => 'You will get a voice call with the passcode',
          },
        );
      } else if (auth.error != null) {
        _code.clear();
      }
    },
    builder: (context, auth) {
      final c = auth.challenge;
      if (c == null && !auth.isAuthenticated) return _noChallenge(context);
      return AuthPage(
        children: [
          AppFlowHeader('OTP verification', fallbackRoute: RoutePaths.login),
          SizedBox(height: 10.h),
          const AppInstitutionCard(
            name: AuthDemoData.school,
            subtitle: AuthDemoData.verification,
            badge: AuthDemoData.board,
            icon: Icons.school_rounded,
            tinted: true,
          ),
          SizedBox(height: 14.h),
          AppCard(
            padding: EdgeInsets.all(18.r),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.phonelink_lock_rounded,
                      size: 14.r,
                      color: C.primary,
                    ),
                    SizedBox(width: 6.w),
                    Text(
                      'SECURE ACCESS VERIFICATION',
                      style: T.caps.copyWith(fontSize: 10.sp),
                    ),
                  ],
                ),
                SizedBox(height: 8.h),
                Text('Verify Mobile Number', style: T.h2),
                SizedBox(height: 6.h),
                Text(
                  'We have dispatched a 6-digit one-time verification passcode to your registered guardian contact.',
                  style: T.small,
                ),
                SizedBox(height: 14.h),
                _phonePanel(context, c),
                SizedBox(height: 16.h),
                Row(
                  children: [
                    Expanded(
                      child: Text('Enter 6-Digit Passcode', style: T.h3),
                    ),
                    Icon(Icons.schedule_rounded, size: 14.r, color: C.slate),
                    SizedBox(width: 4.w),
                    Text('Valid for 10 mins', style: T.small),
                  ],
                ),
                SizedBox(height: 10.h),
                OtpInput(
                  controller: _code,
                  enabled: !auth.busy && !auth.attemptsExhausted,
                  hasError: auth.error != null || _showLengthError,
                  onCompleted: (_) => _verify(),
                ),
                SizedBox(height: 8.h),
                Row(
                  children: [
                    Icon(
                      Icons.keyboard_alt_outlined,
                      size: 14.r,
                      color: C.slate,
                    ),
                    SizedBox(width: 6.w),
                    Expanded(
                      child: Text(
                        'Numeric keypad active • Auto-advances across inputs',
                        style: T.small.copyWith(fontSize: 11.sp),
                      ),
                    ),
                  ],
                ),
                if (_showLengthError || auth.error != null)
                  Padding(
                    padding: EdgeInsets.only(top: 8.h),
                    child: Text(
                      _showLengthError ? 'Enter all 6 digits.' : auth.error!,
                      key: const Key('otp-error'),
                      style: T.small.copyWith(color: C.danger),
                    ),
                  ),
                SizedBox(height: 8.h),
                Align(
                  alignment: Alignment.centerLeft,
                  child: ActionChip(
                    key: const Key('otp-demo-hint'),
                    avatar: Icon(
                      Icons.science_outlined,
                      size: 16.r,
                      color: C.primary,
                    ),
                    label: Text(
                      'Demo passcode ${AuthDemoData.demoOtp} · tap to fill',
                      style: T.small.copyWith(color: C.primary),
                    ),
                    backgroundColor: C.primarySoft,
                    side: BorderSide.none,
                    onPressed: auth.attemptsExhausted
                        ? null
                        : () => _code.text = AuthDemoData.demoOtp,
                  ),
                ),
                SizedBox(height: 12.h),
                _resendPanel(auth),
                SizedBox(height: 18.h),
                AppButton(
                  'Verify & Continue',
                  key: const Key('otp-verify'),
                  icon: Icons.verified_user_outlined,
                  busy: auth.status == AuthStatus.verifying,
                  onPressed: auth.attemptsExhausted ? null : _verify,
                ),
              ],
            ),
          ),
          SizedBox(height: 16.h),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 12.w,
            runSpacing: 4.h,
            children: [
              _trust(Icons.lock_outline_rounded, '256-bit SSL'),
              _trust(Icons.shield_outlined, 'ISO 27001'),
              _trust(Icons.verified_user_outlined, 'CBSE DPEP Compliant'),
            ],
          ),
          SizedBox(height: 6.h),
          Text(
            'EduAdmin Core v4.2 • Secured Institutional Guardian Gateway',
            textAlign: TextAlign.center,
            style: T.small.copyWith(color: C.muted, fontSize: 11.sp),
          ),
        ],
      );
    },
  );

  Widget _noChallenge(BuildContext context) => AuthPage(
    children: [
      AppFlowHeader('OTP verification', fallbackRoute: RoutePaths.login),
      SizedBox(height: 40.h),
      const AppEmptyState(
        'No passcode requested',
        hint: 'Sign in with your registered mobile number or School ID first.',
        icon: Icons.sms_failed_outlined,
      ),
      SizedBox(height: 16.h),
      AppButton('Go to sign in', onPressed: () => context.go(RoutePaths.login)),
    ],
  );

  Widget _phonePanel(BuildContext context, OtpChallenge? c) => Container(
    padding: EdgeInsets.all(12.r),
    decoration: BoxDecoration(
      color: C.surface,
      borderRadius: BorderRadius.circular(R.md),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 36.r,
              height: 36.r,
              decoration: const BoxDecoration(
                color: C.border,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.smartphone_rounded, size: 18.r, color: C.ink),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(c?.phone ?? '', style: T.h3),
                  SizedBox(height: 4.h),
                  const Pill(
                    'Verified Admission Record',
                    icon: Icons.verified_rounded,
                    tone: Tone.neutral,
                  ),
                ],
              ),
            ),
            OutlinedButton.icon(
              key: const Key('otp-edit'),
              onPressed: () => context.canPop()
                  ? context.pop()
                  : context.go(RoutePaths.login),
              style: OutlinedButton.styleFrom(
                backgroundColor: C.bg,
                minimumSize: Size(0, 40.h),
                side: const BorderSide(color: C.border),
              ),
              icon: Icon(Icons.edit_outlined, size: 16.r),
              label: Text(
                'Edit',
                style: T.smallStrong.copyWith(color: C.primary),
              ),
            ),
          ],
        ),
        SizedBox(height: 10.h),
        Row(
          children: [
            Container(
              width: 7.r,
              height: 7.r,
              decoration: const BoxDecoration(
                color: C.primary,
                shape: BoxShape.circle,
              ),
            ),
            SizedBox(width: 8.w),
            Expanded(
              child: Text(switch (c?.channel) {
                OtpChannel.whatsapp => 'Dispatched via WhatsApp',
                OtpChannel.voice => 'Voice call placed to this number',
                _ => 'Dispatched simultaneously via SMS & WhatsApp',
              }, style: T.small),
            ),
          ],
        ),
      ],
    ),
  );

  Widget _resendPanel(AuthState auth) {
    final wait = _secondsLeft > 0;
    final mm = (_secondsLeft ~/ 60).toString().padLeft(2, '0');
    final ss = (_secondsLeft % 60).toString().padLeft(2, '0');
    final canResend = !wait && !auth.resending && !auth.busy;
    return Container(
      padding: EdgeInsets.all(12.r),
      decoration: BoxDecoration(
        color: C.surface,
        borderRadius: BorderRadius.circular(R.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.timer_outlined, size: 18.r, color: C.primary),
              SizedBox(width: 8.w),
              Expanded(
                child: wait
                    ? Text.rich(
                        TextSpan(
                          text: 'Resend Code in ',
                          style: T.bodyStrong.copyWith(fontSize: 13.sp),
                          children: [
                            TextSpan(
                              text: '$mm:${ss}s',
                              style: T.bodyStrong.copyWith(
                                color: C.primary,
                                fontSize: 13.sp,
                              ),
                            ),
                          ],
                        ),
                        key: const Key('otp-countdown'),
                      )
                    : Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton(
                          key: const Key('otp-resend'),
                          onPressed: canResend
                              ? () => _resend(OtpChannel.sms)
                              : null,
                          style: TextButton.styleFrom(
                            minimumSize: Size(0, 36.h),
                            padding: EdgeInsets.zero,
                          ),
                          child: Text(
                            'Resend Code',
                            style: T.bodyStrong.copyWith(color: C.primary),
                          ),
                        ),
                      ),
              ),
              Text(
                'Attempt ${(auth.attempts + 1).clamp(1, OtpChallenge.maxAttempts)} of ${OtpChallenge.maxAttempts}',
                style: T.small,
              ),
            ],
          ),
          const Divider(color: C.border),
          Text("DIDN'T RECEIVE PASSCODE?", style: T.capsMuted),
          SizedBox(height: 8.h),
          Row(
            children: [
              Expanded(
                child: _altButton(
                  'Via WhatsApp',
                  Icons.chat_rounded,
                  C.success,
                  auth.resending ? null : () => _resend(OtpChannel.whatsapp),
                ),
              ),
              SizedBox(width: 10.w),
              Expanded(
                child: _altButton(
                  'Get Voice Call',
                  Icons.phone_in_talk_rounded,
                  C.primary,
                  auth.resending ? null : () => _resend(OtpChannel.voice),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _altButton(
    String label,
    IconData icon,
    Color color,
    VoidCallback? onTap,
  ) => OutlinedButton.icon(
    onPressed: onTap,
    style: OutlinedButton.styleFrom(
      backgroundColor: C.bg,
      minimumSize: Size(0, 44.h),
      padding: EdgeInsets.symmetric(horizontal: 8.w),
      side: const BorderSide(color: C.border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.md)),
    ),
    icon: Icon(icon, size: 18.r, color: color),
    label: FittedBox(
      fit: BoxFit.scaleDown,
      child: Text(label, style: T.smallStrong.copyWith(fontSize: 13.sp)),
    ),
  );

  Widget _trust(IconData icon, String label) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 13.r, color: C.slate),
      SizedBox(width: 4.w),
      Text(label, style: T.small.copyWith(fontSize: 11.sp)),
    ],
  );
}
