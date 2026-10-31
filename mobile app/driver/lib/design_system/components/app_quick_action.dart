import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Square quick-action tile: soft icon box above a (max two line) label (Figma Home "Quick Actions").
class AppQuickAction extends StatelessWidget {
  const AppQuickAction({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label.replaceAll('\n', ' '),
    excludeSemantics: true,
    child: Material(
      color: C.bg,
      borderRadius: BorderRadius.circular(R.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(R.md),
        onTap: onTap,
        child: Container(
          constraints: BoxConstraints(minHeight: 88.h),
          padding: EdgeInsets.symmetric(horizontal: 4.w, vertical: 10.h),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(R.md),
            border: Border.all(color: C.border),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 42.r,
                height: 42.r,
                decoration: BoxDecoration(
                  color: C.surfaceLow,
                  borderRadius: BorderRadius.circular(R.md),
                ),
                child: Icon(icon, color: C.primary, size: 20.r),
              ),
              SizedBox(height: 8.h),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: T.small.copyWith(
                  color: C.onSurface,
                  fontWeight: FontWeight.w500,
                  fontSize: 12.5.sp,
                  height: 1.25,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
