import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../repositories/auth_demo_data.dart';
import 'widgets/auth_page.dart';
import 'widgets/school_contact.dart';

/// Figma "Onboarding 1": first screen for signed-out guardians.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) => AuthPage(
    children: [
      SizedBox(height: 40.h),
      const Align(
        alignment: Alignment.centerLeft,
        child: Pill('OFFICIAL PARENT PORTAL', icon: Icons.shield_rounded),
      ),
      SizedBox(height: 12.h),
      Text('Welcome to Edvio', style: T.title.copyWith(fontSize: 26.sp)),
      SizedBox(height: 8.h),
      Text(
        "Stay connected with your child's academic journey, attendance records, fee settlements, and live bus transit in real-time.",
        style: T.body.copyWith(fontSize: 13.sp),
      ),
      SizedBox(height: 18.h),
      const _CampusHero(),
      SizedBox(height: 14.h),
      const AppInstitutionCard(
        name: AuthDemoData.school,
        subtitle: AuthDemoData.affiliation,
      ),
      SizedBox(height: 16.h),
      AppButton(
        'Sign In with Mobile / School ID',
        key: const Key('welcome-sign-in'),
        icon: Icons.badge_outlined,
        onPressed: () => context.push(RoutePaths.login),
      ),
      SizedBox(height: 4.h),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('New Parent?', style: T.small.copyWith(fontSize: 13.sp)),
          TextButton(
            key: const Key('welcome-register'),
            onPressed: () => context.push(RoutePaths.register),
            style: TextButton.styleFrom(minimumSize: Size(0, 44.h)),
            child: Text(
              'Register',
              style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.sp),
            ),
          ),
        ],
      ),
      const OrDivider('Or quick access'),
      SizedBox(height: 14.h),
      const SocialSignInRow(),
      SizedBox(height: 20.h),
      const Divider(color: C.border),
      HelpLink(
        prompt: 'Need help?',
        link: 'Contact Campus Helpdesk',
        onTap: () => callSchoolDesk(context),
      ),
    ],
  );
}

/// Campus photo placeholder (no image assets): gradient block with a school illustration.
class _CampusHero extends StatelessWidget {
  const _CampusHero();

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Container(
      height: 170.h,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(R.lg),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [C.primaryDark, C.primary, C.heroSky],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -20.w,
            top: -30.h,
            child: Container(
              width: 140.r,
              height: 140.r,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: .08),
              ),
            ),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.account_balance_rounded,
                  size: 64.r,
                  color: Colors.white,
                ),
                SizedBox(height: 8.h),
                Text(
                  AuthDemoData.school.toUpperCase(),
                  textAlign: TextAlign.center,
                  style: T.caps.copyWith(color: Colors.white, fontSize: 12.sp),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
