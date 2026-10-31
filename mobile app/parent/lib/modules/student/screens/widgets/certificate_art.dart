import 'package:flutter/material.dart';
import '../../../../constants/app_constants.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../models/certificate_models.dart';

/// Illustrated certificate (no image assets): parchment gradient, double border, school, title and the
/// child's name, plus a seal. Bonafide certificates use the cool blue paper of the Figma sample.
class CertificateArt extends StatelessWidget {
  const CertificateArt({
    super.key,
    required this.certificate,
    required this.childName,
    this.height = 180,
  });
  final Certificate certificate;
  final String childName;
  final double height;

  @override
  Widget build(BuildContext context) {
    final c = certificate;
    final blue = c.category == CertificateCategory.bonafide;
    final ink = blue ? C.primaryDark : C.warningDark;
    final paper = blue
        ? const [Color(0xFFF4F8FF), Color(0xFFE3ECFB)]
        : const [Color(0xFFFFFBF0), Color(0xFFF6E9C8)];
    if (c.requested) {
      return Container(
        height: height.h,
        alignment: Alignment.center,
        color: C.surfaceLow,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.hourglass_top_rounded, size: 32.r, color: C.slate),
            SizedBox(height: 8.h),
            Text('Being prepared by the school office', style: T.small),
          ],
        ),
      );
    }
    return Container(
      height: height.h,
      padding: EdgeInsets.all(12.r),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: paper,
        ),
      ),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: ink.withValues(alpha: .55), width: 1.5),
        ),
        padding: EdgeInsets.all(3.r),
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: ink.withValues(alpha: .3)),
          ),
          padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 8.h),
          child: Stack(
            children: [
              Column(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  Text(
                    AppConstants.schoolName.toUpperCase(),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.capsMuted.copyWith(color: ink, fontSize: 9.5.sp),
                  ),
                  Text(
                    c.title,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: T.h3.copyWith(
                      color: ink,
                      fontSize: 13.sp,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                  Text(
                    'THIS IS TO CERTIFY THAT',
                    style: T.small.copyWith(fontSize: 8.sp, letterSpacing: 1),
                  ),
                  Text(
                    childName.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.h2.copyWith(
                      color: C.ink,
                      fontSize: 15.sp,
                      letterSpacing: 1,
                    ),
                  ),
                  Text(
                    [c.summary, fmtDate(c.issuedOn, year: true)].where((s) => s.isNotEmpty).join(' • '),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.small.copyWith(fontSize: 8.5.sp),
                  ),
                ],
              ),
              Positioned(
                left: 0,
                bottom: 0,
                child: Container(
                  width: 30.r,
                  height: 30.r,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: blue
                          ? const [Color(0xFFB9C9EE), Color(0xFF6E86C9)]
                          : const [Color(0xFFFDE68A), Color(0xFFD97706)],
                    ),
                  ),
                  child: Icon(
                    blue ? Icons.verified_rounded : Icons.emoji_events_rounded,
                    size: 16.r,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
