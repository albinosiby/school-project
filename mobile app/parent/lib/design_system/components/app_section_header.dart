import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_icon_tile.dart';

class SectionHeader extends StatelessWidget {
  const SectionHeader(
    this.title, {
    super.key,
    this.icon,
    this.action,
    this.onAction,
    this.caps = false,
  });
  final String title;
  final IconData? icon;
  final String? action;
  final VoidCallback? onAction;
  final bool caps;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(2.w, 20.h, 2.w, 10.h),
    child: Row(
      children: [
        if (icon != null) ...[IconTile(icon!, size: 34), SizedBox(width: 10.w)],
        Expanded(
          child: Text(
            caps ? title.toUpperCase() : title,
            style: caps ? T.capsMuted : T.h2,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (action != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: Size(0, 32.h),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              action!,
              style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.sp),
            ),
          ),
      ],
    ),
  );
}
