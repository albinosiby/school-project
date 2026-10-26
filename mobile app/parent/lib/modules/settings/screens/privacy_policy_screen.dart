import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../config/routes/routes.dart';
import '../../../constants/app_constants.dart';
import '../../../design_system/design_system.dart';

const _dpoEmail = 'dpo@greenfield.edu.in';

const _sections = <(IconData, Tone, String, String)>[
  (
    Icons.badge_outlined,
    Tone.brand,
    '1. Information we collect',
    'We collect necessary student profile records including names, dates of birth, academic evaluations and '
        'emergency contact details. Guardian phone numbers are used only for multi-factor authentication, fee '
        'confirmations and urgent campus alerts.',
  ),
  (
    Icons.directions_bus_outlined,
    Tone.warning,
    '2. Transit & telematics',
    'School bus GPS telemetry and turnstile RFID pings are tracked only during scheduled transit windows '
        '(06:30 AM - 05:30 PM) on school days. Real-time telemetry sleeps automatically on weekends and school holidays.',
  ),
  (
    Icons.lock_outline_rounded,
    Tone.success,
    '3. Security & AES-256 vault',
    'All academic, biometric hashes and administrative records are protected with industry-standard AES-256 '
        'encryption at rest and TLS 1.3 in transit. Data is hosted on certified Indian servers and is never sold, '
        'shared or used for commercial advertising.',
  ),
  (
    Icons.gavel_rounded,
    Tone.purple,
    '4. Guardian statutory rights',
    'In accordance with the DPDP Act 2023, parents and legal guardians have full rights to access their ward\'s '
        'digital records, request correction of clerical inaccuracies, or revoke consent for optional ancillary activities.',
  ),
];

/// Figma "6.2.1 Privacy Policy": summary, numbered sections, grievance contact and a (simulated) PDF download.
class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Privacy policy',
    fallbackRoute: RoutePaths.settings,
    bottom: AppButton(
      'Download full policy (PDF - 1.2 MB)',
      icon: Icons.download_rounded,
      onPressed: () => AppDialogs.showSnackBar(
        context,
        message: 'Privacy policy saved to Downloads (PDF, 1.2 MB)',
      ),
    ),
    body: ListView(
      padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 24.h),
      children: [
        PanelCard(
          padding: EdgeInsets.all(16.r),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8.w,
                runSpacing: 6.h,
                children: [
                  const Pill('Official document', tone: Tone.brand, icon: Icons.verified_outlined),
                  Text('Effective: Oct 2025 - v4.2', style: T.small),
                ],
              ),
              SizedBox(height: 12.h),
              Text(
                'This policy outlines how ${AppConstants.schoolName} manages, safeguards and respects student and '
                'guardian information. Personal data is gathered strictly for academic management, transit safety and '
                'verified parent communications, with zero third-party commercial monetization.',
                style: T.body.copyWith(color: C.ink, height: 1.6),
              ),
            ],
          ),
        ),
        for (final (icon, tone, title, body) in _sections)
          Padding(
            padding: EdgeInsets.only(top: 12.h),
            child: AppCard(
              radius: R.xl,
              padding: EdgeInsets.all(16.r),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      IconTile(icon, tone: tone, size: 32),
                      SizedBox(width: 10.w),
                      Expanded(child: Text(title, style: T.h3)),
                    ],
                  ),
                  SizedBox(height: 10.h),
                  Text(body, style: T.body.copyWith(color: C.ink, height: 1.6)),
                ],
              ),
            ),
          ),
        Padding(
          padding: EdgeInsets.only(top: 12.h),
          child: AppCard(
            radius: R.xl,
            padding: EdgeInsets.all(16.r),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const IconTile(Icons.support_agent_rounded, tone: Tone.neutral, size: 32),
                    SizedBox(width: 10.w),
                    Expanded(child: Text('5. Contact & grievance', style: T.h3)),
                  ],
                ),
                SizedBox(height: 10.h),
                Text(
                  'For questions, clarification or statutory rights enforcement, our Data Protection Officer is '
                  'available during standard campus office hours.',
                  style: T.body.copyWith(color: C.ink, height: 1.6),
                ),
                SizedBox(height: 10.h),
                Row(
                  children: [
                    Icon(Icons.mail_outline_rounded, size: 18.r, color: C.primary),
                    SizedBox(width: 6.w),
                    Expanded(
                      child: Text(
                        _dpoEmail,
                        style: T.bodyStrong.copyWith(color: C.primary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    AppButton(
                      'Email',
                      small: true,
                      expand: false,
                      kind: BtnKind.soft,
                      icon: Icons.copy_rounded,
                      onPressed: () {
                        Clipboard.setData(const ClipboardData(text: _dpoEmail));
                        AppDialogs.showSnackBar(context, message: 'DPO email copied: $_dpoEmail');
                      },
                    ),
                  ],
                ),
                SizedBox(height: 6.h),
                Text('Administrative office, Block B - 08:30 AM - 04:00 PM', style: T.small),
              ],
            ),
          ),
        ),
        SizedBox(height: 16.h),
        Center(
          child: Text(
            'Protected under DPDP Act 2023 - MeitY institutional guidelines',
            style: T.small.copyWith(color: C.muted),
            textAlign: TextAlign.center,
          ),
        ),
      ],
    ),
  );
}
