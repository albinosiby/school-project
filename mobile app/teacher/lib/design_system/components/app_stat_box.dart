import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Compact stat block (label, big value, optional unit and caption) that scales down instead of overflowing
/// narrow cells. Used in rows of three inside hero panels.
class AppStatBox extends StatelessWidget {
  const AppStatBox({super.key, required this.label, required this.value, this.unit = '', this.caption, this.valueColor, this.icon, this.color = C.bg, this.centered = false});
  final String label, value, unit;
  final String? caption;
  final Color? valueColor;
  final IconData? icon;
  final Color color;
  final bool centered;

  @override
  Widget build(BuildContext context) {
    final align = centered ? CrossAxisAlignment.center : CrossAxisAlignment.start;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 10.h),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.panelBorder)),
      child: Column(crossAxisAlignment: align, children: [
        Row(mainAxisAlignment: centered ? MainAxisAlignment.center : MainAxisAlignment.start, children: [
          Flexible(child: Text(label, style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
          if (icon != null) ...[SizedBox(width: 4.w), Icon(icon, size: 14.r, color: valueColor ?? C.primary)],
        ]),
        SizedBox(height: 4.h),
        FittedBox(
          fit: BoxFit.scaleDown, alignment: centered ? Alignment.center : Alignment.centerLeft,
          child: Text.rich(TextSpan(children: [
            TextSpan(text: value, style: T.stat.copyWith(fontSize: 18.sp, color: valueColor)),
            if (unit.isNotEmpty) TextSpan(text: ' $unit', style: T.small.copyWith(fontSize: 10.sp, color: C.muted)),
          ])),
        ),
        if (caption != null) Text(caption!, style: T.small.copyWith(fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
      ]),
    );
  }
}
