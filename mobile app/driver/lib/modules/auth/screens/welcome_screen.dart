import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';

/// Onboarding 5 (Figma): hero, pitch, Get Started.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: C.bg,
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: kContentMaxWidth),
          // scrolls when the phone is in landscape; Spacers still spread the content on a tall screen
          child: LayoutBuilder(
            builder: (context, box) => SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: box.maxHeight),
                child: IntrinsicHeight(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 24.w),
                    child: Column(
                      children: [
                        const Spacer(),
                        Container(
                          width: 112.r,
                          height: 112.r,
                          decoration: BoxDecoration(
                            color: C.primary,
                            borderRadius: BorderRadius.circular(R.xxl),
                            boxShadow: [
                              BoxShadow(
                                color: C.primary.withValues(alpha: .3),
                                blurRadius: 32,
                                offset: const Offset(0, 16),
                              ),
                            ],
                          ),
                          child: Icon(
                            Icons.directions_bus_rounded,
                            color: Colors.white,
                            size: 64.r,
                          ),
                        ),
                        SizedBox(height: 32.h),
                        Text(
                          'Shift Sync',
                          style: T.title.copyWith(fontSize: 30.sp),
                          textAlign: TextAlign.center,
                        ),
                        SizedBox(height: 10.h),
                        Text(
                          'Driver & Bus Staff',
                          style: T.caps,
                          textAlign: TextAlign.center,
                        ),
                        SizedBox(height: 18.h),
                        Text(
                          'Your trips, pupil roster, boarding attendance and parent contacts in one place. Built for the crew on the bus.',
                          style: T.body,
                          textAlign: TextAlign.center,
                        ),
                        const Spacer(),
                        for (final (icon, text) in const [
                          (
                            Icons.checklist_rounded,
                            'Pre-trip checklist and live trip status',
                          ),
                          (
                            Icons.how_to_reg_rounded,
                            'Mark every pupil boarded, dropped or absent',
                          ),
                          (
                            Icons.call_rounded,
                            'Call a parent from the roster in one tap',
                          ),
                        ])
                          Padding(
                            padding: EdgeInsets.only(bottom: 12.h),
                            child: Row(
                              children: [
                                IconTile(icon, tone: Tone.brand),
                                SizedBox(width: 12.w),
                                Expanded(
                                  child: Text(text, style: T.bodyStrong),
                                ),
                              ],
                            ),
                          ),
                        SizedBox(height: 24.h),
                        AppButton(
                          'Get Started',
                          icon: Icons.arrow_forward_rounded,
                          onPressed: () => context.go(RoutePaths.login),
                        ),
                        SizedBox(height: 16.h),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
