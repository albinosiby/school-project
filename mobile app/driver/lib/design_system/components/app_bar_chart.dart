import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Hand-drawn vertical bar chart with value labels, an optional dashed target line and
/// highlighted low/high bars (Figma "Daily Attendance Trend"). Values are in [min]..[max];
/// a null value draws a stub bar and a '-' label. [height] is in design pixels.
class AppBarChart extends StatelessWidget {
  const AppBarChart({
    super.key,
    required this.values,
    required this.labels,
    this.min = 0,
    this.max = 100,
    this.target,
    this.lowIndex,
    this.highIndex,
    this.height = 170,
    this.valueLabel,
  });

  final List<double?> values;
  final List<String> labels;
  final double min, max;
  final double? target;
  final int? lowIndex, highIndex;
  final double height;
  final String Function(double v)? valueLabel;

  static const _lowColors = [Color(0xFFFB7185), Color(0xFFFECDD3)];
  static const _baseColors = [C.primary, Color(0xFFA5B4FC)];
  static const _highColors = [C.primaryDark, C.primary];

  @override
  Widget build(BuildContext context) {
    final h = height.h;
    final plot = h - 30.h;
    double y(double v) => ((v.clamp(min, max) - min) / (max - min)) * plot;
    String lbl(double v) =>
        valueLabel?.call(v) ?? '${v.toStringAsFixed(v >= 97 ? 1 : 0)}%';
    return Semantics(
      label:
          'Bar chart: ${[for (var i = 0; i < values.length; i++) '${labels[i]} ${values[i] == null ? 'no data' : lbl(values[i]!)}'].join(', ')}',
      child: Column(
        children: [
          SizedBox(
            height: h,
            child: Stack(
              children: [
                if (target != null)
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _DashedLine(bottom: y(target!)),
                    ),
                  ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    for (var i = 0; i < values.length; i++)
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                values[i] == null ? '-' : lbl(values[i]!),
                                style: T.smallStrong.copyWith(
                                  fontSize: 13.sp,
                                  color: i == lowIndex
                                      ? C.danger
                                      : i == highIndex
                                      ? C.primary
                                      : C.ink,
                                ),
                              ),
                            ),
                            SizedBox(height: 4.h),
                            Container(
                              width: 34.w,
                              height: values[i] == null
                                  ? 6.h
                                  : y(values[i]!).clamp(6.h, plot),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.vertical(
                                  top: Radius.circular(R.sm),
                                ),
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: i == lowIndex
                                      ? _lowColors
                                      : i == highIndex
                                      ? _highColors
                                      : _baseColors,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          SizedBox(height: 8.h),
          Row(
            children: [
              for (var i = 0; i < labels.length; i++)
                Expanded(
                  child: Center(
                    child: Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: 8.w,
                        vertical: 4.h,
                      ),
                      decoration: BoxDecoration(
                        color: i == lowIndex
                            ? C.dangerSoft
                            : i == highIndex
                            ? C.primarySoft
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(R.sm),
                      ),
                      child: Text(
                        labels[i],
                        maxLines: 1,
                        style: T.smallStrong.copyWith(
                          fontSize: 12.sp,
                          color: i == lowIndex
                              ? C.danger
                              : i == highIndex
                              ? C.primary
                              : C.slate,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DashedLine extends CustomPainter {
  _DashedLine({required this.bottom});
  final double bottom;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = C.primary.withValues(alpha: .6)
      ..strokeWidth = 1.2;
    final y = size.height - bottom;
    for (double x = 0; x < size.width; x += 8) {
      canvas.drawLine(Offset(x, y), Offset(x + 4, y), p);
    }
  }

  @override
  bool shouldRepaint(_DashedLine old) => old.bottom != bottom;
}
