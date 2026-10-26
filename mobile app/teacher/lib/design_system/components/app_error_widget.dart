import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_button.dart';

class AppErrorWidget extends StatelessWidget {
  const AppErrorWidget({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: EdgeInsets.all(24.w),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.error_outline_rounded, size: 44.r, color: C.danger), SizedBox(height: 10.h),
            Text(message, style: T.body, textAlign: TextAlign.center),
            if (onRetry != null) ...[SizedBox(height: 16.h), AppButton('Retry', icon: Icons.refresh_rounded, expand: false, onPressed: onRetry)],
          ]),
        ),
      );
}
