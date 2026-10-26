import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Equal-width single-select segmented control.
/// [track] = grey track with a white selected thumb (Figma "Day Coverage");
/// otherwise separate outlined buttons with a filled primary selection (Figma "Correction Type").
class AppSegmented extends StatelessWidget {
  const AppSegmented({
    super.key,
    required this.items,
    required this.value,
    required this.onChanged,
    this.track = false,
  });
  final List<String> items;
  final String value;
  final ValueChanged<String> onChanged;
  final bool track;

  @override
  Widget build(BuildContext context) {
    Widget seg(String item) {
      final on = item == value;
      final bg = track
          ? (on ? C.bg : Colors.transparent)
          : (on ? C.primary : C.bg);
      final fg = track
          ? (on ? C.primary : C.slate)
          : (on ? Colors.white : C.ink);
      return Expanded(
        child: Semantics(
          button: true,
          selected: on,
          label: item,
          child: InkWell(
            borderRadius: BorderRadius.circular(R.md),
            onTap: () => onChanged(item),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              constraints: BoxConstraints(minHeight: 44.h),
              alignment: Alignment.center,
              padding: EdgeInsets.symmetric(horizontal: 4.w),
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(track ? R.sm : R.md),
                border: track
                    ? null
                    : Border.all(color: on ? C.primary : C.border),
                boxShadow: track && on
                    ? [
                        BoxShadow(
                          color: C.ink.withValues(alpha: .08),
                          blurRadius: 6,
                          offset: const Offset(0, 1),
                        ),
                      ]
                    : null,
              ),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  item,
                  maxLines: 1,
                  style: T.smallStrong.copyWith(
                    fontSize: 13.sp,
                    color: fg,
                    fontWeight: on ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }

    final row = Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) SizedBox(width: track ? 4.w : 8.w),
          seg(items[i]),
        ],
      ],
    );
    if (!track) return row;
    return Container(
      padding: EdgeInsets.all(4.r),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(R.md),
      ),
      child: row,
    );
  }
}
