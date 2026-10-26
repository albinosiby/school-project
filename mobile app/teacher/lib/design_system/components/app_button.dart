import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

enum BtnKind { primary, outline, soft, danger, ghost }

/// Filled button with icon, loading state and kinds. Labels scale down instead of clipping.
class AppButton extends StatelessWidget {
  const AppButton(this.label, {super.key, this.onPressed, this.icon, this.kind = BtnKind.primary, this.expand = true, this.small = false, this.busy = false});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final BtnKind kind;
  final bool expand, small, busy;
  @override
  Widget build(BuildContext context) {
    final (fg, bg, side) = switch (kind) {
      BtnKind.primary => (Colors.white, C.primary, C.primary),
      BtnKind.outline => (C.primary, C.bg, C.panelBorder),
      BtnKind.soft => (C.primary, C.primarySoft, C.primarySoft),
      BtnKind.danger => (Colors.white, C.danger, C.danger),
      BtnKind.ghost => (C.slate, Colors.transparent, Colors.transparent),
    };
    final child = busy
        ? SizedBox(width: 18.r, height: 18.r, child: CircularProgressIndicator(strokeWidth: 2, color: fg))
        : Row(mainAxisSize: MainAxisSize.min, children: [
            if (icon != null) ...[Icon(icon, size: (small ? 16 : 20).r, color: fg), SizedBox(width: 8.w)],
            Flexible(child: FittedBox(fit: BoxFit.scaleDown, child: Text(label, maxLines: 1, style: T.button.copyWith(color: fg, fontSize: (small ? 13 : 15).sp)))),
          ]);
    final btn = FilledButton(
      onPressed: busy ? null : onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: bg, disabledBackgroundColor: bg.withValues(alpha: .6), foregroundColor: fg, elevation: 0,
        minimumSize: Size(0, (small ? 38 : 52).h),
        padding: EdgeInsets.symmetric(horizontal: (small ? 14 : 20).w),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(small ? R.md : R.lg), side: BorderSide(color: side)),
      ),
      child: child,
    );
    return expand ? SizedBox(width: double.infinity, child: btn) : btn;
  }
}
