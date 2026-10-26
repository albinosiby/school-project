import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_card.dart';
import 'app_icon_tile.dart';

/// One bordered card holding [AppSettingsRow]s separated by hairlines (Figma "Settings" groups).
class AppSettingsGroup extends StatelessWidget {
  const AppSettingsGroup(this.children, {super.key});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => AppCard(
    padding: EdgeInsets.zero,
    radius: R.xl,
    child: Column(
      children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) const Divider(height: 1, thickness: 1, color: C.border),
          children[i],
        ],
      ],
    ),
  );
}

/// Settings row: optional icon tile, title (+ badge), subtitle and a trailing widget (switch, pill, chevron).
/// With [switchValue] set the row renders a Switch and the whole row toggles it.
class AppSettingsRow extends StatelessWidget {
  const AppSettingsRow({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.badge,
    this.trailing,
    this.onTap,
    this.switchValue,
    this.onSwitch,
    this.tinted = false,
  });
  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget? badge, trailing;
  final VoidCallback? onTap;
  final bool? switchValue;
  final ValueChanged<bool>? onSwitch;

  /// Light tint used for locked/mandatory rows.
  final bool tinted;

  @override
  Widget build(BuildContext context) {
    final sw = switchValue == null
        ? null
        : Semantics(
            label: title,
            toggled: switchValue,
            child: Switch(value: switchValue!, onChanged: onSwitch),
          );
    final tap =
        onTap ??
        (switchValue != null && onSwitch != null
            ? () => onSwitch!(!switchValue!)
            : null);
    return Material(
      color: tinted ? C.surface : Colors.transparent,
      child: InkWell(
        onTap: tap,
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: 56.h),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
            child: Row(
              children: [
                if (icon != null) ...[
                  IconTile(icon!, size: 40),
                  SizedBox(width: 12.w),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              title,
                              style: T.bodyStrong.copyWith(fontSize: 15.sp),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (badge != null) ...[SizedBox(width: 8.w), badge!],
                        ],
                      ),
                      if (subtitle != null)
                        Text(
                          subtitle!,
                          style: T.small,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ),
                if (sw != null || trailing != null) ...[
                  SizedBox(width: 8.w),
                  sw ?? trailing!,
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
