import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Loading placeholder: a column of soft skeleton cards (used by every list screen).
class AppLoading extends StatelessWidget {
  const AppLoading({super.key, this.rows = 4});
  final int rows;

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Loading',
    child: ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 16.h),
      children: [
        for (var i = 0; i < rows; i++)
          Container(
            height: 76.h,
            margin: EdgeInsets.only(bottom: 12.h),
            decoration: BoxDecoration(
              color: C.surface,
              borderRadius: BorderRadius.circular(R.xl),
              border: Border.all(color: C.border),
            ),
            alignment: Alignment.centerLeft,
            padding: EdgeInsets.all(16.w),
            child: Row(
              children: [
                Container(
                  width: 40.r,
                  height: 40.r,
                  decoration: BoxDecoration(
                    color: C.border,
                    borderRadius: BorderRadius.circular(R.md),
                  ),
                ),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 10.h,
                        width: 140.w,
                        decoration: BoxDecoration(
                          color: C.border,
                          borderRadius: BorderRadius.circular(5.r),
                        ),
                      ),
                      SizedBox(height: 8.h),
                      Container(
                        height: 8.h,
                        width: 90.w,
                        decoration: BoxDecoration(
                          color: C.border.withValues(alpha: .7),
                          borderRadius: BorderRadius.circular(4.r),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    ),
  );
}
