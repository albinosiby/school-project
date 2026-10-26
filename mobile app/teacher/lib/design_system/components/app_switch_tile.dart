import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_card.dart';

/// Bordered card with a title, a supporting line and a trailing switch (settings / security toggles).
class AppSwitchTile extends StatelessWidget {
  const AppSwitchTile({super.key, required this.title, this.subtitle, required this.value, required this.onChanged});
  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 10.h),
        child: AppCard(
          onTap: () => onChanged(!value),
          padding: EdgeInsets.fromLTRB(14.w, 8.h, 8.w, 8.h),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: T.bodyStrong),
                if (subtitle != null && subtitle!.isNotEmpty) Text(subtitle!, style: T.small),
              ]),
            ),
            Switch(value: value, onChanged: onChanged),
          ]),
        ),
      );
}
