import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// One legend entry: a square swatch (or a dashed line when [dashed]) and a label.
class AppLegendItem {
  const AppLegendItem(this.label, this.color, {this.dashed = false, this.dot = false});
  final String label;
  final Color color;
  final bool dashed, dot;
}

/// Chart legend row (wraps on narrow screens). With [boxed] it sits on a light surface.
class AppChartLegend extends StatelessWidget {
  const AppChartLegend({super.key, required this.items, this.boxed = true, this.center = true});
  final List<AppLegendItem> items;
  final bool boxed, center;

  @override
  Widget build(BuildContext context) {
    final wrap = Wrap(
      alignment: center ? WrapAlignment.center : WrapAlignment.start,
      spacing: 16.w, runSpacing: 6.h,
      children: [
        for (final i in items)
          Row(mainAxisSize: MainAxisSize.min, children: [
            if (i.dashed)
              Text('- -', style: T.smallStrong.copyWith(color: i.color))
            else
              Container(
                width: (i.dot ? 8 : 10).r, height: (i.dot ? 8 : 10).r,
                decoration: BoxDecoration(color: i.color, shape: i.dot ? BoxShape.circle : BoxShape.rectangle, borderRadius: i.dot ? null : BorderRadius.circular(2.r)),
              ),
            SizedBox(width: 6.w),
            Text(i.label, style: T.small.copyWith(fontSize: 12.sp)),
          ]),
      ],
    );
    if (!boxed) return wrap;
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 8.h),
      decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
      child: wrap,
    );
  }
}
