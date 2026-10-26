import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Standard modal bottom sheet with drag handle and title (used for every "Popup" frame).
Future<V?> showAppSheet<V>(
  BuildContext context, {
  required String title,
  String? subtitle,
  required Widget Function(BuildContext) builder,
}) => showModalBottomSheet<V>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  backgroundColor: C.bg,
  shape: RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(R.xxl)),
  ),
  builder: (ctx) => Padding(
    padding: EdgeInsets.fromLTRB(
      20.w,
      10.h,
      20.w,
      20.h + MediaQuery.of(ctx).viewInsets.bottom,
    ),
    child: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40.w,
              height: 4.h,
              margin: EdgeInsets.only(bottom: 14.h),
              decoration: BoxDecoration(
                color: C.border,
                borderRadius: BorderRadius.circular(2.r),
              ),
            ),
          ),
          Text(title, style: T.h1),
          if (subtitle != null) ...[
            SizedBox(height: 4.h),
            Text(subtitle, style: T.body),
          ],
          SizedBox(height: 16.h),
          builder(ctx),
        ],
      ),
    ),
  ),
);
