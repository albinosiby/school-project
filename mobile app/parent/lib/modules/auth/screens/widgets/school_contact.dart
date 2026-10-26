import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../../../di/injection.dart';
import '../../../../utils/services/link_launcher.dart';
import '../../repositories/auth_demo_data.dart';

/// Calls the school desk (`tel:` link). Shows the number when the device cannot place calls.
Future<void> callSchoolDesk(
  BuildContext context, {
  String desk = 'Campus Helpdesk',
}) async {
  final ok = await getIt<LinkLauncher>().open(AuthDemoData.helpdeskTel);
  if (!context.mounted) return;
  AppDialogs.showSnackBar(
    context,
    message: ok
        ? 'Calling $desk (${AuthDemoData.helpdeskPhone})'
        : 'Call $desk at ${AuthDemoData.helpdeskPhone}',
  );
}

/// "Need help? <link>" line used at the bottom of the onboarding screens.
class HelpLink extends StatelessWidget {
  const HelpLink({
    super.key,
    required this.prompt,
    required this.link,
    required this.onTap,
    this.icon = Icons.help_outline_rounded,
  });
  final String prompt, link;
  final VoidCallback onTap;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Wrap(
    alignment: WrapAlignment.center,
    crossAxisAlignment: WrapCrossAlignment.center,
    children: [
      Icon(icon, size: 16.r, color: C.slate),
      SizedBox(width: 6.w),
      Text(prompt, style: T.small.copyWith(fontSize: 13.sp)),
      TextButton(
        onPressed: onTap,
        style: TextButton.styleFrom(
          minimumSize: Size(0, 44.h),
          padding: EdgeInsets.symmetric(horizontal: 6.w),
        ),
        child: Text(
          link,
          style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.sp),
        ),
      ),
    ],
  );
}
