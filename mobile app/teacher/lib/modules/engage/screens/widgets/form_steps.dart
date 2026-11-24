import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';

/// Numbered step of a schedule form: a circle on a connecting rail, a title row and a card holding [children].
class FormStep extends StatelessWidget {
  const FormStep({
    super.key,
    required this.n,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.children,
    this.last = false,
  });
  final int n;
  final String title, subtitle;
  final IconData icon;
  final List<Widget> children;
  final bool last;
  @override
  Widget build(BuildContext context) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          width: 32.r,
          child: Column(
            children: [
              Container(
                width: 28.r,
                height: 28.r,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: C.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: C.bg, width: 2),
                ),
                child: Text(
                  '$n',
                  style: T.smallStrong.copyWith(color: Colors.white, fontSize: 12.sp),
                ),
              ),
              if (!last)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: EdgeInsets.symmetric(vertical: 4.h),
                    color: C.border,
                  ),
                ),
            ],
          ),
        ),
        SizedBox(width: 10.w),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: last ? 0 : 18.h),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: EdgeInsets.only(top: 3.h, bottom: 10.h),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(title, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                            Text(subtitle, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                          ],
                        ),
                      ),
                      Icon(icon, size: 18.r, color: C.muted),
                    ],
                  ),
                ),
                AppCard(
                  radius: R.lg,
                  padding: EdgeInsets.all(12.w),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

/// A quiet one-line note inside a step (a link to join, or how to get one).
class StepHint extends StatelessWidget {
  const StepHint({super.key, required this.icon, required this.text, this.strong = false});
  final IconData icon;
  final String text;
  final bool strong;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 9.h),
    decoration: BoxDecoration(
      color: C.surface,
      borderRadius: BorderRadius.circular(R.md),
      border: Border.all(color: C.border),
    ),
    child: Row(
      children: [
        Icon(icon, size: 16.r, color: strong ? C.primary : C.slate),
        SizedBox(width: 8.w),
        Expanded(
          child: Text(
            text,
            style: strong ? T.bodyStrong.copyWith(fontSize: 12.5.sp, color: C.primary) : T.small,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    ),
  );
}
