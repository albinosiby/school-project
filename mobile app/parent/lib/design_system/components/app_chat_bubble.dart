import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Chat message bubble (Figma "4.1 View Messages"). Own messages: right, brand fill, time + read ticks.
/// Others: left, white card with an optional [avatar] and [sender] label above.
/// [attachments] are rendered inside the bubble above the text (e.g. AppFileChip rows).
class AppChatBubble extends StatelessWidget {
  const AppChatBubble({
    super.key,
    required this.text,
    required this.time,
    this.mine = false,
    this.sender,
    this.avatar,
    this.read = false,
    this.attachments = const [],
  });
  final String text, time;
  final bool mine, read;
  final String? sender;
  final Widget? avatar;
  final List<Widget> attachments;

  @override
  Widget build(BuildContext context) {
    final fg = mine ? Colors.white : C.ink;
    final meta = mine ? Colors.white.withValues(alpha: .78) : C.slate;
    final bubble = Container(
      constraints: BoxConstraints(maxWidth: 280.w),
      padding: EdgeInsets.fromLTRB(14.w, 10.h, 14.w, 8.h),
      decoration: BoxDecoration(
        color: mine ? C.primary : C.bg,
        border: mine ? null : Border.all(color: C.border.withValues(alpha: .6)),
        boxShadow: mine
            ? null
            : [
                BoxShadow(
                  color: C.ink.withValues(alpha: .04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(R.lg),
          topRight: Radius.circular(R.lg),
          bottomLeft: Radius.circular(mine ? R.lg : 4.r),
          bottomRight: Radius.circular(mine ? 4.r : R.lg),
        ),
      ),
      child: Column(
        crossAxisAlignment: mine
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final a in attachments)
            Padding(
              padding: EdgeInsets.only(bottom: 6.h),
              child: a,
            ),
          if (text.isNotEmpty)
            Text(
              text,
              style: T.body.copyWith(color: fg, fontSize: 15.sp, height: 1.45),
            ),
          SizedBox(height: 4.h),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                time,
                style: T.small.copyWith(
                  color: meta,
                  fontSize: 11.sp,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (mine) ...[
                SizedBox(width: 4.w),
                Icon(
                  read ? Icons.done_all_rounded : Icons.done_rounded,
                  size: 14.r,
                  color: meta,
                  semanticLabel: read ? 'Read' : 'Sent',
                ),
              ],
            ],
          ),
        ],
      ),
    );
    if (mine) {
      return Align(
        alignment: Alignment.centerRight,
        child: Padding(
          padding: EdgeInsets.only(bottom: 12.h),
          child: bubble,
        ),
      );
    }
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 34.r, child: avatar),
          SizedBox(width: 8.w),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (sender != null)
                  Padding(
                    padding: EdgeInsets.only(left: 2.w, bottom: 4.h),
                    child: Text(
                      sender!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.small.copyWith(
                        fontSize: 11.5.sp,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                bubble,
              ],
            ),
          ),
        ],
      ),
    );
  }
}
