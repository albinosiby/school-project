import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_icon_tile.dart';

/// School identity card: icon tile, name with a verified tick, affiliation line and an optional board badge
/// (Figma "Onboarding 1/3/4").
class AppInstitutionCard extends StatelessWidget {
  const AppInstitutionCard({
    super.key,
    required this.name,
    required this.subtitle,
    this.badge,
    this.icon = Icons.account_balance_rounded,
    this.verified = true,
    this.tinted = false,
  });
  final String name, subtitle;
  final String? badge;
  final IconData icon;
  final bool verified;

  /// Grey panel (verification steps) instead of a white card.
  final bool tinted;

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.all(14.r),
    decoration: BoxDecoration(
      color: tinted ? C.surface : C.bg,
      borderRadius: BorderRadius.circular(R.lg),
      border: Border.all(color: C.border),
    ),
    child: Row(
      children: [
        IconTile(icon, size: 44),
        SizedBox(width: 12.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.h3,
                    ),
                  ),
                  if (verified) ...[
                    SizedBox(width: 6.w),
                    Icon(
                      Icons.verified_rounded,
                      color: C.primary,
                      size: 16.r,
                      semanticLabel: 'Verified',
                    ),
                  ],
                ],
              ),
              SizedBox(height: 2.h),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: T.small,
              ),
            ],
          ),
        ),
        if (badge != null) ...[
          SizedBox(width: 8.w),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
            decoration: BoxDecoration(
              color: C.border,
              borderRadius: BorderRadius.circular(R.sm),
            ),
            child: Text(badge!, style: T.smallStrong.copyWith(color: C.slate)),
          ),
        ],
      ],
    ),
  );
}
