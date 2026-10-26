import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Small tinted metadata chip with an optional leading icon (period / day / NCERT / skill tags).
/// [neutral] uses a grey style instead of the brand tint.
class AppTagChip extends StatelessWidget {
  const AppTagChip(this.label, {super.key, this.icon, this.neutral = false});
  final String label;
  final IconData? icon;
  final bool neutral;

  @override
  Widget build(BuildContext context) {
    final fg = neutral ? C.slate : C.primary;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
      decoration: BoxDecoration(
        color: neutral ? const Color(0xFFF1F5F9) : C.primarySoft,
        borderRadius: BorderRadius.circular(R.sm),
        border: Border.all(color: neutral ? C.border : C.panelBorder),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 14.r, color: fg), SizedBox(width: 5.w)],
        Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small.copyWith(color: fg, fontWeight: FontWeight.w600))),
      ]),
    );
  }
}
