import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../models/message_models.dart';
import 'contact_avatar.dart';

/// One conversation card of the Messages list (Figma 4).
class ThreadTile extends StatelessWidget {
  const ThreadTile({
    super.key,
    required this.thread,
    required this.onTap,
    this.onLongPress,
  });
  final MessageThread thread;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final t = thread;
    final unread = t.unread > 0;
    return Semantics(
      button: true,
      label:
          '${t.teacher}, ${t.role}${unread ? ', ${t.unread} unread' : ''}${t.pinned ? ', pinned' : ''}',
      onLongPressHint: 'Conversation options',
      excludeSemantics: true,
      child: Material(
        color: C.bg,
        borderRadius: BorderRadius.circular(R.lg),
        child: InkWell(
          borderRadius: BorderRadius.circular(R.lg),
          onTap: onTap,
          onLongPress: onLongPress,
          child: Container(
            padding: EdgeInsets.fromLTRB(14.w, 14.h, 12.w, 14.h),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(R.lg),
              border: Border.all(color: unread ? C.panelBorder : C.border),
              boxShadow: const [
                BoxShadow(
                  color: C.cardShadow,
                  blurRadius: 10,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                ContactAvatar(
                  name: t.teacher,
                  kind: t.kind,
                  online: t.online,
                  verified: t.verified,
                ),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              t.teacher,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: T.h3.copyWith(fontSize: 15.5.sp),
                            ),
                          ),
                          if (t.verified && t.kind == ContactKind.classTeacher)
                            Padding(
                              padding: EdgeInsets.only(left: 4.w),
                              child: Icon(
                                Icons.verified_rounded,
                                size: 16.r,
                                color: C.primary,
                              ),
                            ),
                          SizedBox(width: 6.w),
                          Flexible(
                            child: Pill(t.role, tone: toneOfKind(t.kind)),
                          ),
                          SizedBox(width: 6.w),
                          if (t.pinned)
                            Padding(
                              padding: EdgeInsets.only(right: 2.w),
                              child: Icon(
                                Icons.push_pin_rounded,
                                size: 14.r,
                                color: C.muted,
                              ),
                            ),
                          Text(
                            relTime(t.lastAt),
                            style: T.small.copyWith(
                              fontSize: 11.5.sp,
                              color: unread ? C.primary : C.muted,
                              fontWeight: unread
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 2.h),
                      Text(
                        t.subject == null
                            ? t.subtitle
                            : '${t.subtitle} • ${t.subject}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.small,
                      ),
                      SizedBox(height: 2.h),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              t.lastMessage.replaceAll('\n', ' '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: T.body.copyWith(
                                fontSize: 13.sp,
                                color: unread ? C.ink : C.slate,
                                fontWeight: unread
                                    ? FontWeight.w600
                                    : FontWeight.w400,
                              ),
                            ),
                          ),
                          if (unread)
                            Container(
                              key: ValueKey('unread-${t.id}'),
                              margin: EdgeInsets.only(left: 8.w),
                              constraints: BoxConstraints(minWidth: 22.r),
                              height: 22.r,
                              alignment: Alignment.center,
                              padding: EdgeInsets.symmetric(horizontal: 6.w),
                              decoration: BoxDecoration(
                                color: C.primary,
                                borderRadius: BorderRadius.circular(R.pill),
                              ),
                              child: Text(
                                '${t.unread}',
                                style: T.smallStrong.copyWith(
                                  color: Colors.white,
                                  fontSize: 11.sp,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
