import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_avatar.dart';

/// Top header of the five tab screens: logo tile, title, bell (with unread dot) and avatar.
/// Presentational: the data comes from the caller (see modules/home/screens/widgets/teacher_tab_header.dart).
class AppTabHeader extends StatelessWidget {
  const AppTabHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.eyebrow,
    this.icon = Icons.school_rounded,
    required this.userName,
    this.hasUnread = false,
    this.onBell,
    this.onAvatar,
  });
  final String title, userName;
  final String? subtitle, eyebrow;
  final IconData icon;
  final bool hasUnread;
  final VoidCallback? onBell, onAvatar;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.fromLTRB(16.w, 10.h, 16.w, 12.h),
    decoration: const BoxDecoration(
      color: C.bg,
      border: Border(bottom: BorderSide(color: C.border)),
    ),
    child: Row(
      children: [
        Container(
          width: 48.r,
          height: 48.r,
          decoration: BoxDecoration(
            color: C.primaryDark,
            borderRadius: BorderRadius.circular(R.lg),
          ),
          child: Icon(icon, color: Colors.white, size: 26.r),
        ),
        SizedBox(width: 12.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (eyebrow != null)
                Text(eyebrow!, style: T.caps.copyWith(fontSize: 10.5.sp)),
              Text(
                title,
                style: T.h1.copyWith(fontSize: 17.sp),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (subtitle != null)
                Text(
                  subtitle!,
                  style: T.small,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
            ],
          ),
        ),
        Semantics(
          button: true,
          label: hasUnread ? 'Notifications, unread' : 'Notifications',
          child: InkResponse(
            onTap: onBell,
            child: Container(
              width: 44.r,
              height: 44.r,
              decoration: BoxDecoration(
                color: C.panel,
                shape: BoxShape.circle,
                border: Border.all(color: C.panelBorder),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Icon(
                    Icons.notifications_none_rounded,
                    color: C.primary,
                    size: 24.r,
                  ),
                  if (hasUnread)
                    Positioned(
                      right: 10.r,
                      top: 10.r,
                      child: Container(
                        width: 9.r,
                        height: 9.r,
                        decoration: BoxDecoration(
                          color: C.danger,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        SizedBox(width: 10.w),
        Semantics(
          button: true,
          label: 'Profile',
          child: InkResponse(
            onTap: onAvatar,
            child: Avatar(userName, size: 44, online: true),
          ),
        ),
      ],
    ),
  );
}

/// Scrollable body for tab screens with page padding and room for the dock.
class AppTabBody extends StatelessWidget {
  const AppTabBody({super.key, required this.children, this.onRefresh});
  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  @override
  Widget build(BuildContext context) {
    final list = ListView(
      padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 110.h),
      children: children,
    );
    return onRefresh == null
        ? list
        : RefreshIndicator(onRefresh: onRefresh!, child: list);
  }
}
