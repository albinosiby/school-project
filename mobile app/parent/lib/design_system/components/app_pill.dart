import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_tone.dart';

/// Small rounded status label.
class Pill extends StatelessWidget {
  const Pill(
    this.label, {
    super.key,
    this.tone = Tone.brand,
    this.icon,
    this.dot = false,
  });
  final String label;
  final Tone tone;
  final IconData? icon;
  final bool dot;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
      decoration: BoxDecoration(
        color: c.bg,
        borderRadius: BorderRadius.circular(R.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot)
            Container(
              width: 6.r,
              height: 6.r,
              margin: EdgeInsets.only(right: 6.w),
              decoration: BoxDecoration(color: c.fg, shape: BoxShape.circle),
            ),
          if (icon != null) ...[
            Icon(icon, size: 13.r, color: c.fg),
            SizedBox(width: 4.w),
          ],
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: T.small.copyWith(
                color: c.fg,
                fontWeight: FontWeight.w700,
                fontSize: 11.5.sp,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
