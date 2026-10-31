import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_card.dart';
import 'app_icon_tile.dart';
import 'app_pill.dart';
import 'app_tone.dart';

class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.sub,
    this.tone = Tone.brand,
    this.badge,
    this.onTap,
  });
  final String label, value;
  final String? sub, badge;
  final IconData? icon;
  final Tone tone;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => AppCard(
    radius: R.lg,
    padding: EdgeInsets.all(12.w),
    color: C.panel,
    border: C.panelBorder,
    onTap: onTap,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            if (icon != null)
              IconTile(icon!, tone: tone, size: 30)
            else
              Flexible(
                child: Text(
                  label,
                  style: T.small,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            if (badge != null) Flexible(child: Pill(badge!, tone: tone)),
          ],
        ),
        SizedBox(height: 10.h),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: value,
                  style: T.stat.copyWith(fontSize: 22.sp),
                ),
                if (sub != null) TextSpan(text: ' $sub', style: T.small),
              ],
            ),
          ),
        ),
        if (icon != null)
          Text(
            label,
            style: T.small,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
      ],
    ),
  );
}
