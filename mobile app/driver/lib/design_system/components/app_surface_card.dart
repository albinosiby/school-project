import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// White 12-radius card with a hairline outline and a 1px soft shadow (Figma "Conduct & Praise
/// Timeline Cards", "Attendance Status" card). [hero] adds the soft indigo glow in the top-right
/// corner used by the summary cards.
class AppSurfaceCard extends StatelessWidget {
  const AppSurfaceCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.onTap,
    this.hero = false,
    this.color = C.bg,
    this.borderColor,
    this.semanticLabel,
  });
  final Widget child;
  final EdgeInsetsGeometry? padding, margin;
  final VoidCallback? onTap;
  final bool hero;
  final Color color;
  final Color? borderColor;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(R.md);
    Widget content = Padding(
      padding: padding ?? EdgeInsets.all(16.w),
      child: child,
    );
    if (hero) {
      content = Stack(
        children: [
          Positioned(
            top: -40.r,
            right: -40.r,
            child: Container(
              width: 140.r,
              height: 140.r,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    C.indigoSoft.withValues(alpha: .7),
                    C.indigoSoft.withValues(alpha: 0),
                  ],
                ),
              ),
            ),
          ),
          content,
        ],
      );
    }
    return Semantics(
      container: true,
      button: onTap != null,
      label: semanticLabel,
      child: Container(
        margin: margin,
        decoration: BoxDecoration(
          color: color,
          borderRadius: r,
          border: Border.all(
            color: borderColor ?? C.outline.withValues(alpha: .9),
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0D000000),
              blurRadius: 2,
              offset: Offset(0, 1),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: r,
          child: Material(
            color: Colors.transparent,
            child: InkWell(onTap: onTap, child: content),
          ),
        ),
      ),
    );
  }
}

/// Caps eyebrow label with a trailing dot (Figma "OVERALL CONDUCT PULSE ●", "● ATTENDANCE STATUS").
class AppEyebrow extends StatelessWidget {
  const AppEyebrow(
    this.text, {
    super.key,
    this.color = C.primary,
    this.leadingDot = false,
  });
  final String text;
  final Color color;
  final bool leadingDot;

  @override
  Widget build(BuildContext context) {
    final dot = Container(
      width: 7.r,
      height: 7.r,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
    final label = Flexible(
      child: Text(
        text.toUpperCase(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: T.caps.copyWith(color: leadingDot ? C.onSurfaceVariant : color),
      ),
    );
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: leadingDot
          ? [dot, SizedBox(width: 8.w), label]
          : [label, SizedBox(width: 8.w), dot],
    );
  }
}
