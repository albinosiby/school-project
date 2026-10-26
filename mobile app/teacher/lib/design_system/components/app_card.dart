import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// White bordered card with optional tap.
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding, this.color = C.bg, this.border = C.border, this.onTap, this.radius, this.margin});
  final Widget child;
  final EdgeInsetsGeometry? padding, margin;
  final Color color, border;
  final VoidCallback? onTap;
  final double? radius;
  @override
  Widget build(BuildContext context) {
    final r = radius ?? R.xl;
    return Container(
      margin: margin,
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(r), border: Border.all(color: border)),
      child: Material(
        color: Colors.transparent,
        child: InkWell(borderRadius: BorderRadius.circular(r), onTap: onTap, child: Padding(padding: padding ?? EdgeInsets.all(16.w), child: child)),
      ),
    );
  }
}

/// Tinted hero panel (light blue with blue border).
class PanelCard extends StatelessWidget {
  const PanelCard({super.key, required this.child, this.padding, this.margin, this.onTap});
  final Widget child;
  final EdgeInsetsGeometry? padding, margin;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) =>
      AppCard(color: C.panel, border: C.panelBorder, radius: R.xxl, padding: padding, margin: margin, onTap: onTap, child: child);
}
