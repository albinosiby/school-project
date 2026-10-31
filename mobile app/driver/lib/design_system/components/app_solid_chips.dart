import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Horizontally scrolling single-select pill chips (Figma "Filter Chips Carousel", Messages filters):
/// the selected chip is solid primary with white text, the others white with a hairline outline.
/// [labelOf] lets a chip show extra text (e.g. a count) while [onChanged] reports the raw item.
class AppSolidChips extends StatelessWidget {
  const AppSolidChips({
    super.key,
    required this.items,
    required this.value,
    required this.onChanged,
    this.labelOf,
  });
  final List<String> items;
  final String value;
  final ValueChanged<String> onChanged;
  final String Function(String item)? labelOf;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 44.h,
    // Few chips: build them all (no lazy list) so every chip can be scrolled into view.
    child: SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final (i, item) in items.indexed) ...[
            if (i > 0) SizedBox(width: 8.w),
            _chip(item),
          ],
        ],
      ),
    ),
  );

  Widget _chip(String item) {
    final on = item == value;
    return Semantics(
      button: true,
      selected: on,
      child: InkWell(
        borderRadius: BorderRadius.circular(R.pill),
        onTap: () => onChanged(item),
        child: Center(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            height: 32.h,
            padding: EdgeInsets.symmetric(horizontal: 14.w),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: on ? C.primary : C.bg,
              borderRadius: BorderRadius.circular(R.pill),
              border: Border.all(
                color: on ? C.primary : C.outline.withValues(alpha: .9),
              ),
            ),
            child: Text(
              labelOf?.call(item) ?? item,
              style: T.small.copyWith(
                fontSize: 12.5.sp,
                fontWeight: on ? FontWeight.w600 : FontWeight.w500,
                color: on ? Colors.white : C.onSurfaceVariant,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
