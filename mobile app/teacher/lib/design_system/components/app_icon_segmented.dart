import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Grey track segmented control whose segments carry an icon and an optional red count badge
/// (Figma "My Leaves | Student leaves", "Seating Layout | Candidate Details"). Index based.
class AppIconSegmented extends StatelessWidget {
  const AppIconSegmented({super.key, required this.labels, required this.index, required this.onChanged, this.icons, this.badges});
  final List<String> labels;
  final int index;
  final ValueChanged<int> onChanged;
  final List<IconData>? icons;

  /// Segment index -> count; shown when > 0.
  final Map<int, int>? badges;

  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.all(4.r),
        decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
        child: Row(children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: Semantics(
                button: true, selected: i == index, label: labels[i],
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onChanged(i),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    height: 44.h,
                    padding: EdgeInsets.symmetric(horizontal: 6.w),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: i == index ? C.bg : Colors.transparent,
                      borderRadius: BorderRadius.circular(R.md),
                      boxShadow: i == index ? [BoxShadow(color: C.ink.withValues(alpha: .08), blurRadius: 6, offset: const Offset(0, 1))] : null,
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      if (icons != null) ...[Icon(icons![i], size: 18.r, color: i == index ? C.primary : C.slate), SizedBox(width: 6.w)],
                      Flexible(
                        child: Text(labels[i], maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: T.bodyStrong.copyWith(fontSize: 13.5.sp, color: i == index ? C.primary : C.slate, fontWeight: i == index ? FontWeight.w700 : FontWeight.w500)),
                      ),
                      if ((badges?[i] ?? 0) > 0) ...[
                        SizedBox(width: 6.w),
                        Container(
                          padding: EdgeInsets.symmetric(horizontal: 7.w, vertical: 2.h),
                          decoration: BoxDecoration(color: C.dangerSoft, borderRadius: BorderRadius.circular(R.pill)),
                          child: Text('${badges![i]}', style: T.small.copyWith(color: C.danger, fontWeight: FontWeight.w800, fontSize: 11.sp)),
                        ),
                      ],
                    ]),
                  ),
                ),
              ),
            ),
        ]),
      );
}
