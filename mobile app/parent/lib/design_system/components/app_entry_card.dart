import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_surface_card.dart';
import 'app_tone.dart';

/// List entry in the Figma timeline-card style: tinted 40px icon tile, bold title, optional badge
/// under it, a "● meta" line, a trailing widget (status pill / amount), an optional quoted body with
/// a left rule, and an optional footer row of chips.
class AppEntryCard extends StatelessWidget {
  const AppEntryCard({
    super.key,
    required this.icon,
    required this.title,
    this.tone = Tone.brand,
    this.badge,
    this.meta,
    this.trailing,
    this.body,
    this.footer = const [],
    this.onTap,
    this.margin,
  });
  final IconData icon;
  final String title;
  final Tone tone;
  final Widget? badge, trailing;
  final String? meta, body;
  final List<Widget> footer;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    final fg = tone == Tone.brand ? C.primary : c.fg;
    final bg = tone == Tone.brand ? C.indigoSoft : c.bg;
    return AppSurfaceCard(
      margin: margin ?? EdgeInsets.only(bottom: 12.h),
      padding: EdgeInsets.fromLTRB(13.w, 13.h, 13.w, 13.h),
      onTap: onTap,
      semanticLabel: title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40.r,
                height: 40.r,
                decoration: BoxDecoration(
                  color: bg.withValues(alpha: .6),
                  borderRadius: BorderRadius.circular(R.md),
                  border: Border.all(color: fg.withValues(alpha: .2)),
                ),
                child: Icon(icon, size: 20.r, color: fg),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: T.h3.copyWith(color: C.onSurface),
                    ),
                    if (badge != null) ...[SizedBox(height: 4.h), badge!],
                    if (meta != null) ...[
                      SizedBox(height: 4.h),
                      Row(
                        children: [
                          Container(
                            width: 6.r,
                            height: 6.r,
                            decoration: BoxDecoration(
                              color: fg.withValues(alpha: .4),
                              shape: BoxShape.circle,
                            ),
                          ),
                          SizedBox(width: 6.w),
                          Expanded(
                            child: Text(
                              meta!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: T.small.copyWith(
                                fontSize: 11.sp,
                                color: C.onSurfaceVariant,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[SizedBox(width: 8.w), trailing!],
            ],
          ),
          if (body != null) ...[
            SizedBox(height: 10.h),
            Container(
              padding: EdgeInsets.only(left: 12.w),
              decoration: BoxDecoration(
                border: Border(left: BorderSide(color: bg, width: 2)),
              ),
              child: Text(
                body!,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: T.body.copyWith(color: C.onSurfaceVariant),
              ),
            ),
          ],
          if (footer.isNotEmpty) ...[
            SizedBox(height: 10.h),
            Container(
              padding: EdgeInsets.only(top: 10.h),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(color: C.outline.withValues(alpha: .4)),
                ),
              ),
              child: Wrap(spacing: 8.w, runSpacing: 6.h, children: footer),
            ),
          ],
        ],
      ),
    );
  }
}

/// Small grey footer chip with an icon (Figma "Logged to Portfolio", "Classroom Practice").
class AppMetaChip extends StatelessWidget {
  const AppMetaChip(this.label, {super.key, required this.icon, this.color});
  final String label;
  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
    decoration: BoxDecoration(
      color: C.surfaceLow,
      borderRadius: BorderRadius.circular(R.pill),
      border: Border.all(color: C.outline.withValues(alpha: .6)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12.r, color: color ?? C.onSurfaceVariant),
        SizedBox(width: 5.w),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: T.small.copyWith(
              fontSize: 11.sp,
              color: color ?? C.onSurfaceVariant,
            ),
          ),
        ),
      ],
    ),
  );
}
