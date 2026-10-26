import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

class AppEmptyState extends StatelessWidget {
  const AppEmptyState(this.title, {super.key, this.hint, this.icon = Icons.inbox_outlined, this.action});
  final String title;
  final String? hint;
  final IconData icon;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.all(32.w),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 40.r, color: C.muted), SizedBox(height: 10.h),
          Text(title, style: T.h3, textAlign: TextAlign.center),
          if (hint != null) ...[SizedBox(height: 4.h), Text(hint!, style: T.body, textAlign: TextAlign.center)],
          if (action != null) ...[SizedBox(height: 14.h), action!],
        ]),
      );
}
