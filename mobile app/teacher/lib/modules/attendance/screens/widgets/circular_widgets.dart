import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../models/attendance_models.dart';
import '../../models/circular_models.dart';

Tone circularTone(String c) => switch (c) {
  'Academic' => Tone.brand,
  'Admin' => Tone.neutral,
  'Events' => Tone.success,
  _ => Tone.purple,
};

IconData circularIcon(String c) => switch (c) {
  'Academic' => Icons.menu_book_rounded,
  'Admin' => Icons.admin_panel_settings_outlined,
  'Events' => Icons.emoji_events_outlined,
  _ => Icons.campaign_outlined,
};

/// "Today", "Yesterday", "3 days ago", else "Nov 12, 2026".
String circularWhen(String date) {
  final d = DateTime.tryParse(date);
  if (d == null) return date;
  final t = todayDate();
  final diff = t.difference(DateTime(d.year, d.month, d.day)).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return '$diff days ago';
  return fmtKey(date, 'MMM d, yyyy');
}

/// One circular: category tile, title, two lines of the message, and when / who / attachment / state.
class CircularTile extends StatelessWidget {
  const CircularTile(this.c, {super.key, this.onPin, this.highlight = false});
  final Circular c;
  final VoidCallback? onPin;

  /// The home card: a little more room for the message.
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final tone = toneColors(c.urgent ? Tone.danger : circularTone(c.cat));
    final unread = !c.read;
    return AppCard(
      margin: EdgeInsets.only(bottom: 10.h),
      radius: R.xl,
      onTap: () => context.push(RoutePaths.circular(c.id)),
      color: unread ? C.panel : C.bg,
      border: unread ? C.panelBorder : C.border,
      padding: EdgeInsets.fromLTRB(12.w, 12.h, onPin == null ? 12.w : 2.w, 12.h),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42.r,
            height: 42.r,
            decoration: BoxDecoration(color: tone.bg, borderRadius: BorderRadius.circular(R.md)),
            child: Icon(c.urgent ? Icons.priority_high_rounded : circularIcon(c.cat), size: 21.r, color: tone.fg),
          ),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (unread) ...[
                      Container(
                        width: 8.r,
                        height: 8.r,
                        decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle),
                      ),
                      SizedBox(width: 6.w),
                    ],
                    Expanded(
                      child: Text(
                        [c.urgent ? 'URGENT' : c.catLabel.toUpperCase(), if (c.pinned) 'PINNED'].join(' • '),
                        style: T.capsMuted.copyWith(fontSize: 10.sp, color: c.urgent ? C.danger : null),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(circularWhen(c.date), style: T.small.copyWith(fontSize: 11.sp)),
                  ],
                ),
                SizedBox(height: 4.h),
                Text(
                  c.title,
                  style: T.h3.copyWith(fontSize: 15.sp, fontWeight: unread ? FontWeight.w800 : FontWeight.w600),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (c.summary.isNotEmpty) ...[
                  SizedBox(height: 4.h),
                  Text(
                    c.summary,
                    style: T.body.copyWith(fontSize: 13.sp, height: 1.4),
                    maxLines: highlight ? 3 : 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                SizedBox(height: 8.h),
                Row(
                  children: [
                    if (c.author.isNotEmpty || c.office.isNotEmpty)
                      Flexible(
                        child: Text(
                          c.author.isNotEmpty ? c.author : c.office,
                          style: T.small.copyWith(fontSize: 11.5.sp),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    if (c.attachment != null) ...[
                      SizedBox(width: 8.w),
                      Icon(Icons.attach_file_rounded, size: 14.r, color: C.slate),
                    ],
                    const Spacer(),
                    if (c.ack)
                      const Pill('Acknowledged', tone: Tone.success, icon: Icons.verified_outlined)
                    else if (unread)
                      const Pill('New', tone: Tone.brand),
                  ],
                ),
              ],
            ),
          ),
          if (onPin != null)
            IconButton(
              tooltip: c.pinned ? 'Unpin circular' : 'Pin circular',
              constraints: BoxConstraints(minWidth: 40.r, minHeight: 40.r),
              padding: EdgeInsets.zero,
              onPressed: onPin,
              icon: Icon(
                c.pinned ? Icons.push_pin_rounded : Icons.push_pin_outlined,
                size: 18.r,
                color: c.pinned ? C.primary : C.muted,
              ),
            ),
        ],
      ),
    );
  }
}
