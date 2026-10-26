import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Grey tile with an icon, a small caps label and a value (contact rows, time slot / classroom boxes).
/// [onCopy] adds a copy button.
class AppInfoTile extends StatelessWidget {
  const AppInfoTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.onCopy,
    this.iconColor = C.slate,
    this.compact = false,
  });
  final IconData icon;
  final String label, value;
  final VoidCallback? onCopy;
  final Color iconColor;

  /// Tighter padding and smaller value text (two tiles side by side).
  final bool compact;

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(
      horizontal: (compact ? 10 : 12).w,
      vertical: (compact ? 10 : 12).h,
    ),
    decoration: BoxDecoration(
      color: C.surface,
      borderRadius: BorderRadius.circular(R.md),
      border: Border.all(color: C.border),
    ),
    child: Row(
      children: [
        Icon(icon, size: 18.r, color: iconColor),
        SizedBox(width: (compact ? 8 : 10).w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: T.capsMuted.copyWith(fontSize: 9.5.sp),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                value,
                style: compact ? T.smallStrong : T.bodyStrong,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        if (onCopy != null)
          IconButton(
            tooltip: 'Copy ${label.toLowerCase()}',
            onPressed: onCopy,
            icon: Icon(Icons.copy_rounded, size: 18.r, color: C.slate),
          ),
      ],
    ),
  );
}
