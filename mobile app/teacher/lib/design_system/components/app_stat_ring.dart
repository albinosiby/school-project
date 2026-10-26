import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Hand-drawn circular progress ring with a centred label (e.g. "74%"). [size] is in design pixels,
/// [value] in 0..1.
class AppStatRing extends StatelessWidget {
  const AppStatRing({super.key, required this.value, this.label, this.size = 44, this.color = C.primary, this.stroke = 4});
  final double value;
  final String? label;
  final double size, stroke;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final s = size.r;
    return Semantics(
      label: label ?? '${(value * 100).round()}%',
      child: SizedBox(
        width: s, height: s,
        child: CustomPaint(
          painter: _RingPainter(value: value.clamp(0, 1).toDouble(), color: color, stroke: stroke.r),
          child: Center(
            child: Padding(
              padding: EdgeInsets.all(stroke.r + 2.r),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(label ?? '${(value * 100).round()}%', style: T.smallStrong.copyWith(fontSize: (size * .26).sp, color: C.ink)),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.value, required this.color, required this.stroke});
  final double value, stroke;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final r = rect.deflate(stroke / 2);
    final track = Paint()
      ..color = const Color(0xFFE5EDFB)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    final arc = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = stroke;
    canvas.drawArc(r, 0, math.pi * 2, false, track);
    canvas.drawArc(r, -math.pi / 2, math.pi * 2 * value, false, arc);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.value != value || old.color != color || old.stroke != stroke;
}
