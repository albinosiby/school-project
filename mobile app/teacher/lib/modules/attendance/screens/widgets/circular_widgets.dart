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

/// The message as one paragraph for a preview ("Dear Parent,\nThe school…" → "Dear Parent, The school…").
String circularPreview(String text) => text.replaceAll(RegExp(r'\s+'), ' ').trim();

/// One circular: category icon, title, a two-line preview, and category · when · sender with its state.
/// Long-press pins it (when [onPin] is given).
class CircularTile extends StatelessWidget {
  const CircularTile(this.c, {super.key, this.onPin, this.highlight = false});
  final Circular c;
  final VoidCallback? onPin;

  /// The home card: one more line of the message.
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final tone = toneColors(c.urgent ? Tone.danger : circularTone(c.cat));
    final unread = !c.read;
    final preview = circularPreview(c.summary);
    final sender = c.author.isNotEmpty ? c.author : c.office;
    final meta = T.small.copyWith(fontSize: 11.5.sp, color: C.slate);
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: Material(
        color: C.bg,
        borderRadius: BorderRadius.circular(R.lg),
        child: InkWell(
          borderRadius: BorderRadius.circular(R.lg),
          onTap: () => context.push(RoutePaths.circular(c.id)),
          onLongPress: onPin,
          child: Container(
            padding: EdgeInsets.all(12.r),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(R.lg),
              border: Border.all(color: unread ? C.primary.withValues(alpha: .35) : C.border),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 38.r,
                  height: 38.r,
                  decoration: BoxDecoration(color: tone.bg, borderRadius: BorderRadius.circular(R.md)),
                  child: Icon(c.urgent ? Icons.priority_high_rounded : circularIcon(c.cat), size: 19.r, color: tone.fg),
                ),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              c.title,
                              style: T.bodyStrong.copyWith(
                                fontSize: 14.5.sp,
                                height: 1.3,
                                fontWeight: unread ? FontWeight.w800 : FontWeight.w600,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (c.pinned)
                            Padding(
                              padding: EdgeInsets.only(left: 6.w, top: 2.h),
                              child: Icon(Icons.push_pin_rounded, size: 14.r, color: C.primary),
                            ),
                          if (unread)
                            Container(
                              width: 8.r,
                              height: 8.r,
                              margin: EdgeInsets.only(left: 6.w, top: 5.h),
                              decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle),
                            ),
                        ],
                      ),
                      if (preview.isNotEmpty) ...[
                        SizedBox(height: 3.h),
                        Text(
                          preview,
                          style: T.small.copyWith(fontSize: 12.5.sp, height: 1.4, color: C.ink.withValues(alpha: .72)),
                          maxLines: highlight ? 3 : 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      SizedBox(height: 8.h),
                      Row(
                        children: [
                          Text(
                            c.urgent ? 'Urgent' : c.catLabel,
                            style: meta.copyWith(color: tone.fg, fontWeight: FontWeight.w700),
                          ),
                          Text('  ·  ${circularWhen(c.date)}', style: meta),
                          Expanded(
                            child: Text(
                              sender.isEmpty ? '' : '  ·  $sender',
                              style: meta,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (c.attachment != null) ...[
                            SizedBox(width: 6.w),
                            Icon(Icons.attach_file_rounded, size: 13.r, color: C.slate),
                          ],
                          SizedBox(width: 6.w),
                          if (c.ack)
                            Tooltip(
                              message: 'Acknowledged',
                              child: Icon(Icons.verified_rounded, size: 16.r, color: C.successDark),
                            )
                          else
                            Text(
                              'To acknowledge',
                              style: meta.copyWith(color: C.warningDark, fontWeight: FontWeight.w700),
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
