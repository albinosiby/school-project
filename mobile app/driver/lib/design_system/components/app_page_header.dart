import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../tokens/app_tokens.dart';
import 'app_header_actions.dart';

/// Header of pushed parent screens (Figma "TRACK LIVE", "APPLY LEAVE"): round back button, small caps
/// title and [AppHeaderActions] (bell with unread dot, guardian avatar). Presentational: callers pass the actions.
class AppPageHeader extends StatelessWidget implements PreferredSizeWidget {
  const AppPageHeader(
    this.title, {
    super.key,
    required this.userName,
    this.hasUnread = true,
    this.onBell,
    this.onAvatar,
    this.fallbackRoute = '/home',
  });
  final String title, userName;
  final bool hasUnread;
  final VoidCallback? onBell, onAvatar;
  final String fallbackRoute;

  @override
  Size get preferredSize => Size.fromHeight(68.h);

  Widget _round({
    required String label,
    required VoidCallback? onTap,
    required Widget child,
  }) => Semantics(
    button: true,
    label: label,
    child: Tooltip(
      message: label,
      child: InkResponse(
        onTap: onTap,
        radius: 26.r,
        child: Container(
          width: 44.r,
          height: 44.r,
          decoration: BoxDecoration(
            color: C.bg,
            borderRadius: BorderRadius.circular(R.lg),
            border: Border.all(color: C.border),
          ),
          alignment: Alignment.center,
          child: child,
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: Container(
      height: 68.h,
      color: C.surface,
      padding: EdgeInsets.symmetric(horizontal: 16.w),
      child: Row(
        children: [
          _round(
            label: 'Back',
            onTap: () =>
                context.canPop() ? context.pop() : context.go(fallbackRoute),
            child: Icon(Icons.arrow_back_rounded, color: C.ink, size: 22.r),
          ),
          SizedBox(width: 12.w),
          Expanded(
            child: Text(
              title.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: T.capsMuted.copyWith(fontSize: 12.sp),
            ),
          ),
          AppHeaderActions(
            userName: userName,
            hasUnread: hasUnread,
            onBell: onBell,
            onAvatar: onAvatar,
          ),
        ],
      ),
    ),
  );
}
