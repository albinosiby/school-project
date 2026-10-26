import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';

/// Shared layout of the sign-in screens: app logo, heading and a scrollable form column.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({super.key, required this.title, required this.subtitle, required this.child, this.onBack});
  final String title, subtitle;
  final Widget child;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: C.bg,
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: 440.w),
              child: ListView(padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 16.h), children: [
                if (onBack != null)
                  Align(alignment: Alignment.centerLeft, child: IconButton(tooltip: 'Back', onPressed: onBack, icon: Icon(Icons.arrow_back_rounded, color: C.ink, size: 24.r)))
                else
                  SizedBox(height: 44.h),
                SizedBox(height: 16.h),
                const Align(alignment: Alignment.centerLeft, child: AppLogo(size: 88)),
                SizedBox(height: 20.h),
                Text(title, style: T.title),
                SizedBox(height: 6.h),
                Text(subtitle, style: T.body),
                SizedBox(height: 28.h),
                child,
              ]),
            ),
          ),
        ),
      );
}

/// Inline error / info message above the form fields.
class AuthBanner extends StatelessWidget {
  const AuthBanner(this.message, {super.key, this.error = false});
  final String message;
  final bool error;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        margin: EdgeInsets.only(bottom: 16.h),
        padding: EdgeInsets.all(12.r),
        decoration: BoxDecoration(color: error ? C.dangerSoft : C.successSoft, borderRadius: BorderRadius.circular(R.md)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(error ? Icons.error_outline_rounded : Icons.mark_email_read_outlined, size: 18.r, color: error ? C.danger : C.successDark),
          SizedBox(width: 8.w),
          Expanded(child: Text(message, style: T.small.copyWith(color: error ? C.danger : C.successDark, fontWeight: FontWeight.w600))),
        ]),
      );
}
