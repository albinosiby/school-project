import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../models/certificate_models.dart';

Color templateColor(CertTemplate? tpl) => Color(tpl?.color ?? 0xFF2F4FD8);

Widget certStatusPill(bool issued) => issued ? const Pill('Signed & Issued', tone: Tone.success, dot: true) : const Pill('Sign Pending', tone: Tone.warning, dot: true);

/// "Student Awards | My Certifications" switch at the top of both certificate lists.
class CertTabs extends StatelessWidget {
  const CertTabs({super.key, required this.value});
  final String value;
  @override
  Widget build(BuildContext context) => AppSegmented(
        track: true,
        items: const ['Student Awards', 'My Certifications'],
        value: value,
        onChanged: (v) {
          if (v == value) return;
          context.pushReplacement(v == 'Student Awards' ? RoutePaths.certificates : RoutePaths.certificatesMine);
        },
      );
}

/// Rendered certificate built from the chosen data.
class CertificateView extends StatelessWidget {
  const CertificateView({
    super.key, required this.title, required this.student, required this.citation, required this.accent, this.meta = '', this.date = '', this.code = '',
    this.authority = '', this.mentor = 'Mrs. Anita Sharma', this.principal = 'Dr. K. V. Rao', this.signed = true, this.seal = true,
    this.heading = 'CERTIFICATE OF EXCELLENCE & MERIT', this.school = 'DELHI PUBLIC SCHOOL',
  });
  final String title, student, citation, meta, date, code, authority, mentor, principal, heading, school;
  final Color accent;
  final bool signed, seal;

  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.all(12.r),
        decoration: BoxDecoration(color: const Color(0xFFFFFBEB), borderRadius: BorderRadius.circular(R.md), border: Border.all(color: accent.withValues(alpha: .5), width: 3)),
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 14.h),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(R.sm), border: Border.all(color: accent.withValues(alpha: .25))),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 40.r, height: 40.r,
              decoration: BoxDecoration(color: accent.withValues(alpha: .12), shape: BoxShape.circle),
              child: Icon(Icons.school_rounded, color: accent, size: 22.r),
            ),
            SizedBox(height: 6.h),
            Text(school.toUpperCase(), textAlign: TextAlign.center, style: T.smallStrong.copyWith(letterSpacing: 1, fontSize: 12.sp)),
            Text('AFFILIATED TO CBSE, NEW DELHI', style: T.small.copyWith(fontSize: 9.sp)),
            SizedBox(height: 10.h),
            Text(heading.toUpperCase(), textAlign: TextAlign.center, style: T.h3.copyWith(color: accent, fontSize: 15.sp)),
            SizedBox(height: 8.h),
            Container(
              padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 4.h),
              decoration: BoxDecoration(color: C.warningSoft, borderRadius: BorderRadius.circular(R.pill)),
              child: Text(title, textAlign: TextAlign.center, style: T.smallStrong.copyWith(color: C.warningDark)),
            ),
            SizedBox(height: 10.h),
            Text('This prestigious certificate is proudly conferred upon', style: T.small.copyWith(fontSize: 10.sp), textAlign: TextAlign.center),
            Text(student.isEmpty ? 'Student Name' : student, textAlign: TextAlign.center, style: T.h1.copyWith(fontSize: 22.sp, letterSpacing: .3)),
            if (meta.isNotEmpty) Text(meta, textAlign: TextAlign.center, style: T.small.copyWith(fontSize: 10.sp)),
            SizedBox(height: 8.h),
            if (citation.isNotEmpty) Text('“$citation”', textAlign: TextAlign.center, style: T.small.copyWith(fontSize: 11.sp, fontStyle: FontStyle.italic, color: C.ink)),
            SizedBox(height: 12.h),
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Expanded(child: _Sig(signed ? mentor : '', 'CLASS MENTOR')),
              if (seal)
                Container(
                  width: 42.r, height: 42.r, alignment: Alignment.center,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: accent),
                  child: Text('SEAL', style: T.small.copyWith(color: Colors.white, fontSize: 9.sp, fontWeight: FontWeight.w800)),
                )
              else
                SizedBox(width: 42.r),
              Expanded(child: _Sig(signed ? principal : '', 'PRINCIPAL')),
            ]),
            if (date.isNotEmpty || code.isNotEmpty) ...[
              SizedBox(height: 8.h),
              Text([if (date.isNotEmpty) date, if (code.isNotEmpty) code, if (authority.isNotEmpty) authority].join(' • '),
                  textAlign: TextAlign.center, style: T.small.copyWith(fontSize: 9.sp)),
            ],
          ]),
        ),
      );
}

class _Sig extends StatelessWidget {
  const _Sig(this.name, this.role);
  final String name, role;
  @override
  Widget build(BuildContext context) => Column(children: [
        Text(name.isEmpty ? ' ' : name.replaceAll(RegExp(r'^(Mrs|Mr|Ms|Dr)\.?\s*'), ''),
            style: T.smallStrong.copyWith(fontStyle: FontStyle.italic, color: C.primary), maxLines: 1, overflow: TextOverflow.ellipsis),
        Container(height: 1, color: C.border, margin: EdgeInsets.symmetric(horizontal: 12.w)),
        Text(name.isEmpty ? 'UNSIGNED' : name.toUpperCase(), style: T.small.copyWith(fontSize: 8.5.sp, fontWeight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
        Text(role, style: T.small.copyWith(fontSize: 8.sp)),
      ]);
}

/// Mini certificate thumbnail used in template pickers.
class TemplateThumb extends StatelessWidget {
  const TemplateThumb(this.tpl, {super.key, this.name = ''});
  final CertTemplate tpl;
  final String name;
  @override
  Widget build(BuildContext context) {
    final c = templateColor(tpl);
    return AspectRatio(
      aspectRatio: tpl.portrait ? .78 : 1.5,
      child: Container(
        decoration: BoxDecoration(color: const Color(0xFFFFFBEB), borderRadius: BorderRadius.circular(R.sm), border: Border.all(color: c, width: 2)),
        padding: EdgeInsets.all(6.r),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(tpl.category.toUpperCase(), maxLines: 1, style: T.small.copyWith(fontSize: 7.sp, color: c, fontWeight: FontWeight.w800)),
            Text('CERTIFICATE', style: T.smallStrong.copyWith(fontSize: 10.sp, color: c)),
            if (name.isNotEmpty) Text(name, maxLines: 1, style: T.smallStrong.copyWith(fontSize: 9.sp)),
            Icon(Icons.workspace_premium_rounded, color: c, size: 18.r),
          ]),
        ),
      ),
    );
  }
}
