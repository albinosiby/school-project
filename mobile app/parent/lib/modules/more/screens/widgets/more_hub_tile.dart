import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';

/// Square-ish tile of the More hub grid: tinted icon, title and a one-line caption.
class MoreHubTile extends StatelessWidget {
  const MoreHubTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.tone = Tone.brand,
  });
  final IconData icon;
  final String title, subtitle;
  final Tone tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => AppSurfaceCard(
    onTap: onTap,
    semanticLabel: title,
    padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 12.h),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        IconTile(icon, tone: tone, size: 38),
        SizedBox(height: 10.h),
        Text(
          title,
          style: T.smallStrong.copyWith(fontSize: 13.sp, color: C.onSurface),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        Text(
          subtitle,
          style: T.small.copyWith(fontSize: 11.sp),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    ),
  );
}
