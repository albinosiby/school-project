import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';

/// Grey date box with an icon square, caps caption and the date (Figma "FROM / TO").
class LeaveDateBox extends StatelessWidget {
  const LeaveDateBox({
    super.key,
    required this.caption,
    required this.value,
    required this.icon,
    required this.onTap,
  });
  final String caption, value;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: '$caption date, $value',
    excludeSemantics: true,
    child: Material(
      color: C.surfaceLow,
      borderRadius: BorderRadius.circular(R.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(R.md),
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 12.h),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(R.md),
            border: Border.all(color: C.outline),
          ),
          child: Row(
            children: [
              Container(
                width: 34.r,
                height: 34.r,
                decoration: BoxDecoration(
                  color: C.outline,
                  borderRadius: BorderRadius.circular(R.sm),
                ),
                child: Icon(icon, size: 18.r, color: C.primary),
              ),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      caption,
                      style: T.small.copyWith(
                        fontSize: 10.5.sp,
                        color: C.onSurfaceVariant,
                        letterSpacing: .5,
                      ),
                    ),
                    Text(
                      value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.bodyStrong.copyWith(color: C.onSurface),
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

/// Dashed upload drop zone (Figma "Attach Doctor's Prescription / Slip").
class LeaveAttachBox extends StatelessWidget {
  const LeaveAttachBox({
    super.key,
    required this.title,
    required this.hint,
    required this.onTap,
  });
  final String title, hint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: title,
    excludeSemantics: true,
    child: InkWell(
      borderRadius: BorderRadius.circular(R.md),
      onTap: onTap,
      child: CustomPaint(
        painter: _DashedBorder(radius: R.md),
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.symmetric(vertical: 18.h, horizontal: 12.w),
          child: Column(
            children: [
              Container(
                width: 40.r,
                height: 40.r,
                decoration: const BoxDecoration(
                  color: C.indigoSoft,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.upload_file_rounded,
                  size: 20.r,
                  color: C.primary,
                ),
              ),
              SizedBox(height: 8.h),
              Text(
                title,
                textAlign: TextAlign.center,
                style: T.bodyStrong.copyWith(color: C.onSurface),
              ),
              Text(hint, style: T.small.copyWith(color: C.muted)),
            ],
          ),
        ),
      ),
    ),
  );
}

class _DashedBorder extends CustomPainter {
  _DashedBorder({required this.radius});
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = C.muted
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius)),
      );
    for (final m in path.computeMetrics()) {
      for (var d = 0.0; d < m.length; d += 9.r) {
        canvas.drawPath(m.extractPath(d, d + 5.r), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorder old) => old.radius != radius;
}

/// Small grey caps label used above form sections, with an optional trailing widget.
class LeaveFieldLabel extends StatelessWidget {
  const LeaveFieldLabel(this.label, {super.key, this.trailing});
  final String label;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 8.h),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: T.small.copyWith(color: C.onSurfaceVariant),
          ),
        ),
        ?trailing,
      ],
    ),
  );
}

/// Inline red error under a form section.
class LeaveFieldError extends StatelessWidget {
  const LeaveFieldError(this.message, {super.key});
  final String? message;

  @override
  Widget build(BuildContext context) => message == null
      ? const SizedBox.shrink()
      : Padding(
          padding: EdgeInsets.only(top: 6.h),
          child: Text(message!, style: T.small.copyWith(color: C.danger)),
        );
}
