import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Horizontally scrolling single-select chips.
class FilterChips extends StatelessWidget {
  const FilterChips({super.key, required this.items, required this.value, required this.onChanged});
  final List<String> items;
  final String value;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 40.h,
        child: ListView.separated(
          scrollDirection: Axis.horizontal, itemCount: items.length, separatorBuilder: (_, _) => SizedBox(width: 8.w),
          itemBuilder: (_, i) {
            final on = items[i] == value;
            return Semantics(
              button: true, selected: on,
              child: GestureDetector(
                onTap: () => onChanged(items[i]),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150), padding: EdgeInsets.symmetric(horizontal: 16.w), alignment: Alignment.center,
                  decoration: BoxDecoration(color: on ? C.primarySoft : C.bg, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: on ? C.primary.withValues(alpha: .4) : C.border)),
                  child: Text(items[i], style: T.bodyStrong.copyWith(color: on ? C.primary : C.slate, fontSize: 13.5.sp)),
                ),
              ),
            );
          },
        ),
      );
}
