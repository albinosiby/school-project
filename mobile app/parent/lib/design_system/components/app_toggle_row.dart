import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_card.dart';

/// Bordered card row with a title, optional subtitle and a trailing switch (notification / visibility toggles).
class AppToggleRow extends StatelessWidget {
  const AppToggleRow({
    super.key,
    required this.title,
    this.subtitle,
    required this.value,
    required this.onChanged,
    this.tinted = false,
    this.margin,
  });
  final String title;
  final String? subtitle;
  final bool value, tinted;
  final ValueChanged<bool> onChanged;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) => AppCard(
    radius: R.lg,
    margin: margin,
    color: tinted ? C.panel : C.bg,
    border: tinted ? C.panelBorder : C.border,
    padding: EdgeInsets.fromLTRB(14.w, 8.h, 8.w, 8.h),
    onTap: () => onChanged(!value),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: T.bodyStrong,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (subtitle != null)
                Text(
                  subtitle!,
                  style: T.small,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
            ],
          ),
        ),
        Semantics(
          label: title,
          toggled: value,
          child: Switch(value: value, onChanged: onChanged),
        ),
      ],
    ),
  );
}
