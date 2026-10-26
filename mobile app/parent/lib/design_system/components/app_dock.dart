import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// One tab of the floating dock / rail / drawer.
class AppNavItem {
  const AppNavItem(this.icon, this.selectedIcon, this.label);
  final IconData icon, selectedIcon;
  final String label;
}

/// Floating dock bottom navigation bar (Figma "Modern Floating Dock Navigation Bar"):
/// a rounded card lifted off the bottom edge, with a selection pill that slides between
/// tabs, a springy icon and a haptic tick.
class AppDock extends StatelessWidget {
  const AppDock({
    super.key,
    required this.items,
    required this.index,
    required this.onTap,
  });
  final List<AppNavItem> items;
  final int index;
  final ValueChanged<int> onTap;

  static const _slide = Duration(milliseconds: 360);

  void _select(int i) {
    if (i != index) HapticFeedback.selectionClick();
    onTap(i);
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    minimum: EdgeInsets.only(bottom: 8.h),
    child: Padding(
      padding: EdgeInsets.fromLTRB(16.w, 0, 16.w, 6.h),
      child: Container(
        height: 68.h,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28.r),
          border: Border.all(color: C.border.withValues(alpha: .7)),
          boxShadow: [
            BoxShadow(
              color: C.ink.withValues(alpha: .14),
              blurRadius: 28,
              spreadRadius: -2,
              offset: const Offset(0, 12),
            ),
            BoxShadow(
              color: C.ink.withValues(alpha: .05),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: LayoutBuilder(
          builder: (context, box) {
            final w = box.maxWidth / items.length;
            return Stack(
              children: [
                AnimatedPositioned(
                  duration: _slide,
                  curve: Curves.easeOutBack,
                  left: index * w,
                  top: 0,
                  bottom: 0,
                  width: w,
                  child: Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: 6.w,
                      vertical: 7.h,
                    ),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: C.primarySoft,
                        borderRadius: BorderRadius.circular(22.r),
                      ),
                    ),
                  ),
                ),
                Row(
                  children: [
                    for (var i = 0; i < items.length; i++)
                      Expanded(
                        child: _DockItem(
                          item: items[i],
                          selected: i == index,
                          onTap: () => _select(i),
                        ),
                      ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    ),
  );
}

class _DockItem extends StatelessWidget {
  const _DockItem({
    required this.item,
    required this.selected,
    required this.onTap,
  });
  final AppNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    label: item.label,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedSlide(
            duration: const Duration(milliseconds: 320),
            curve: Curves.easeOutBack,
            offset: Offset(0, selected ? -.08 : 0),
            child: AnimatedScale(
              duration: const Duration(milliseconds: 380),
              curve: Curves.easeOutBack,
              scale: selected ? 1.18 : 1,
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
                transitionBuilder: (c, a) => FadeTransition(
                  opacity: a,
                  child: ScaleTransition(
                    scale: Tween(begin: .7, end: 1.0).animate(a),
                    child: c,
                  ),
                ),
                child: Icon(
                  selected ? item.selectedIcon : item.icon,
                  key: ValueKey(selected),
                  size: 23.r,
                  color: selected ? C.primary : C.slate,
                ),
              ),
            ),
          ),
          SizedBox(height: 3.h),
          AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            style: T.small.copyWith(
              fontSize: 11.sp,
              color: selected ? C.primary : C.muted,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
            ),
            child: Text(item.label, maxLines: 1),
          ),
        ],
      ),
    ),
  );
}
