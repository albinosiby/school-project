import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_bottom_sheet.dart';
import 'app_icon_tile.dart';

/// Dropdown-like trigger: icon tile, optional caption above the label, chevron (Figma "Date"/"Session",
/// "ASSESSMENT SCOPE", "START DATE" fields). [trailing] replaces the chevron (e.g. a status pill).
class AppPickTile extends StatelessWidget {
  const AppPickTile({
    super.key,
    required this.icon,
    required this.label,
    this.caption,
    required this.onTap,
    this.trailing,
    this.plainIcon = false,
  });
  final IconData icon;
  final String label;
  final String? caption;
  final VoidCallback onTap;
  final Widget? trailing;
  final bool plainIcon;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: caption == null ? label : '$caption: $label',
    child: InkWell(
      borderRadius: BorderRadius.circular(R.lg),
      onTap: onTap,
      child: Container(
        constraints: BoxConstraints(minHeight: 56.h),
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
        decoration: BoxDecoration(
          color: C.bg,
          borderRadius: BorderRadius.circular(R.lg),
          border: Border.all(color: C.panelBorder),
        ),
        child: Row(
          children: [
            if (plainIcon)
              Icon(icon, size: 20.r, color: C.primary)
            else
              IconTile(icon, size: 34),
            SizedBox(width: 10.w),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (caption != null)
                    Text(
                      caption!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.small.copyWith(fontSize: 11.sp),
                    ),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.bodyStrong.copyWith(fontSize: 13.5.sp),
                  ),
                ],
              ),
            ),
            trailing ??
                Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: C.slate,
                  size: 22.r,
                ),
          ],
        ),
      ),
    ),
  );
}

/// Picks one of [items] in a standard bottom sheet; returns null when dismissed.
Future<V?> showPickSheet<V>(
  BuildContext context, {
  required String title,
  required List<V> items,
  required String Function(V) label,
  String Function(V)? sub,
  V? selected,
}) => showAppSheet<V>(
  context,
  title: title,
  builder: (ctx) => Column(
    children: [
      for (final i in items)
        ListTile(
          contentPadding: EdgeInsets.zero,
          minTileHeight: 52.h,
          title: Text(label(i), style: T.bodyStrong),
          subtitle: sub == null ? null : Text(sub(i), style: T.small),
          trailing: i == selected
              ? Icon(Icons.check_circle_rounded, color: C.primary, size: 22.r)
              : null,
          onTap: () => Navigator.pop(ctx, i),
        ),
    ],
  ),
);
