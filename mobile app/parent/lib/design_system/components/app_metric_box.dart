import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_tone.dart';

/// Grey bento metric (Figma "Quick Micro Metrics Grid"): icon + optional badge on top, bold value and
/// a small label below. Use three in a row inside a hero card.
class AppMetricBox extends StatelessWidget {
  const AppMetricBox({
    super.key,
    required this.value,
    required this.label,
    this.icon,
    this.badge,
    this.tone = Tone.brand,
    this.valueColor,
  });
  final String value, label;
  final IconData? icon;
  final String? badge;
  final Tone tone;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    final fg = tone == Tone.brand ? C.primary : c.fg;
    return Container(
      padding: EdgeInsets.fromLTRB(10.w, 10.h, 8.w, 10.h),
      decoration: BoxDecoration(
        color: C.surfaceLow,
        borderRadius: BorderRadius.circular(R.sm),
        border: Border.all(color: C.outline.withValues(alpha: .6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 22.h,
            child: Row(
              children: [
                if (icon != null) Icon(icon, size: 16.r, color: fg),
                const Spacer(),
                if (badge != null)
                  Flexible(
                    flex: 4,
                    child: Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: 7.w,
                        vertical: 2.h,
                      ),
                      decoration: BoxDecoration(
                        color: tone == Tone.brand ? C.indigoSoft : c.bg,
                        borderRadius: BorderRadius.circular(R.pill),
                      ),
                      child: Text(
                        badge!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.small.copyWith(
                          fontSize: 10.5.sp,
                          fontWeight: FontWeight.w700,
                          color: fg,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          SizedBox(height: 8.h),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              maxLines: 1,
              style: T.h2.copyWith(
                fontSize: 16.sp,
                color: valueColor ?? C.onSurface,
              ),
            ),
          ),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: T.small.copyWith(fontSize: 11.sp, color: C.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}
