import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';

/// Grey tappable field with an icon, a value and a supporting line (Figma "Due Date" / "Due Time" / class picker).
class PickField extends StatelessWidget {
  const PickField({super.key, required this.icon, required this.title, required this.sub, required this.onTap, this.label, this.tile = false, this.trailing});
  final IconData icon;
  final String title, sub;
  final String? label;
  final VoidCallback onTap;
  /// Shows the icon in a tinted tile instead of plain.
  final bool tile;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final field = Semantics(
      button: true, label: '${label ?? ''} $title, $sub'.trim(),
      child: Material(
        color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(R.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(R.md), onTap: onTap,
          child: Container(
            constraints: BoxConstraints(minHeight: 56.h),
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
            child: Row(children: [
              if (tile) IconTile(icon, size: 34) else Icon(icon, color: C.primary, size: 22.r),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text(title, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(sub, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ]),
              ),
              ?trailing,
            ]),
          ),
        ),
      ),
    );
    if (label == null) return field;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label!, style: T.smallStrong.copyWith(color: C.slate)),
      SizedBox(height: 6.h),
      field,
    ]);
  }
}
