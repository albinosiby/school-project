import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// White card with a hairline border and a soft shadow (Figma Home / Track Live cards).
class AppElevatedCard extends StatelessWidget {
  const AppElevatedCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.onTap,
    this.color = C.bg,
    this.radius,
  });
  final Widget child;
  final EdgeInsetsGeometry? padding, margin;
  final VoidCallback? onTap;
  final Color color;
  final double? radius;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius ?? R.lg);
    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: color,
        borderRadius: r,
        border: Border.all(color: C.cardBorder),
        boxShadow: const [
          BoxShadow(color: C.cardShadow, blurRadius: 12, offset: Offset(0, 2)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: r,
          onTap: onTap,
          child: Padding(
            padding: padding ?? EdgeInsets.all(16.w),
            child: child,
          ),
        ),
      ),
    );
  }
}
