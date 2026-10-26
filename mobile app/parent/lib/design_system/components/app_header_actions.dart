import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_avatar.dart';

/// Trailing actions of the Figma detail headers (5.x frames): bell with unread dot and the guardian avatar.
/// Presentational: pass the callbacks (notifications / profile routes) from the screen.
class AppHeaderActions extends StatelessWidget {
  const AppHeaderActions({
    super.key,
    required this.userName,
    this.hasUnread = true,
    this.onBell,
    this.onAvatar,
  });
  final String userName;
  final bool hasUnread;
  final VoidCallback? onBell, onAvatar;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Tooltip(
        message: 'Notifications',
        child: Semantics(
          button: true,
          label: hasUnread ? 'Notifications, unread' : 'Notifications',
          child: InkResponse(
            onTap: onBell,
            radius: 24.r,
            child: Container(
              width: 44.r,
              height: 44.r,
              decoration: BoxDecoration(
                color: C.bg,
                shape: BoxShape.circle,
                border: Border.all(color: C.border),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Icon(
                    Icons.notifications_none_rounded,
                    color: C.primary,
                    size: 22.r,
                  ),
                  if (hasUnread)
                    Positioned(
                      right: 11.r,
                      top: 10.r,
                      child: Container(
                        width: 8.r,
                        height: 8.r,
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
      ),
      SizedBox(width: 8.w),
      Tooltip(
        message: 'My profile',
        child: Semantics(
          button: true,
          label: 'My profile',
          child: InkResponse(
            onTap: onAvatar,
            radius: 24.r,
            child: Avatar(userName, size: 44, online: true),
          ),
        ),
      ),
      SizedBox(width: 4.w),
    ],
  );
}
