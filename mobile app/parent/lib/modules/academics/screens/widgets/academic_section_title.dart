import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';

/// Section heading in the Parent App style ("Conduct Activity Log  ·  Updated today"): primary icon,
/// bold title and either a muted caption or a text action on the right.
class AcademicSectionTitle extends StatelessWidget {
  const AcademicSectionTitle(
    this.title, {
    super.key,
    required this.icon,
    this.caption,
    this.action,
    this.onAction,
  });
  final String title;
  final IconData icon;
  final String? caption, action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(2.w, 18.h, 2.w, 8.h),
    child: Row(
      children: [
        Icon(icon, size: 18.r, color: C.primary),
        SizedBox(width: 8.w),
        Expanded(
          child: Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: T.h3.copyWith(color: C.onSurface),
          ),
        ),
        if (action != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              minimumSize: Size(44.w, 40.h),
              padding: EdgeInsets.symmetric(horizontal: 6.w),
            ),
            child: Text(
              action!,
              style: T.smallStrong.copyWith(color: C.primary, fontSize: 13.sp),
            ),
          )
        else if (caption != null)
          Text(
            caption!,
            style: T.small.copyWith(
              fontSize: 11.5.sp,
              color: C.onSurfaceVariant,
            ),
          ),
      ],
    ),
  );
}

/// Bottom padding so the last card clears the floating dock.
SizedBox academicListEnd() => SizedBox(height: 110.h);

/// Standard list padding for the Academics / Fees tab bodies.
EdgeInsets academicListPadding() =>
    EdgeInsets.fromLTRB(S.page, 14.h, S.page, 0);
