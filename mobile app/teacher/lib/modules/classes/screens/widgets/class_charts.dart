import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';

/// A point of a line chart; [value] null leaves a gap (e.g. an exam the student missed).
typedef ChartPoint = ({String label, double? value});

/// Smooth line with a gradient area, a dashed threshold, and an optional dashed comparison series. Tap or drag to
/// read a point (the latest is shown by default).
class TrendLineChart extends StatefulWidget {
  const TrendLineChart({
    super.key,
    required this.points,
    this.compare,
    this.threshold,
    this.color = C.primary,
    this.height = 170,
    this.unit = '%',
    this.compareLabel = 'Class',
    this.detail,
  });
  final List<ChartPoint> points;
  final List<ChartPoint>? compare;
  final double? threshold;
  final Color color;
  final double height;
  final String unit, compareLabel;

  /// Text under the picked point's value (e.g. "29/32 present"); defaults to its label.
  final String Function(int index)? detail;

  @override
  State<TrendLineChart> createState() => _TrendLineChartState();
}

class _TrendLineChartState extends State<TrendLineChart> {
  int? _sel;

  @override
  void didUpdateWidget(covariant TrendLineChart old) {
    super.didUpdateWidget(old);
    if (old.points.length != widget.points.length) _sel = null;
  }

  (double, double) get _range {
    final all = [
      for (final p in [...widget.points, ...?widget.compare]) ?p.value,
      ?widget.threshold,
    ];
    if (all.isEmpty) return (0, 100);
    final lo = all.reduce(math.min), hi = all.reduce(math.max);
    final min = math.max(0.0, ((lo - 5) / 10).floorToDouble() * 10);
    final max = widget.unit == '%' ? math.max(min + 10, math.min(100.0, ((hi + 5) / 10).ceilToDouble() * 10)) : ((hi + 1) / 5).ceilToDouble() * 5;
    return (min, max <= min ? min + 10 : max);
  }

  int get _last {
    for (var i = widget.points.length - 1; i >= 0; i--) {
      if (widget.points[i].value != null) return i;
    }
    return widget.points.length - 1;
  }

  void _pick(Offset local, double width) {
    if (widget.points.isEmpty) return;
    final step = widget.points.length == 1 ? 0.0 : width / (widget.points.length - 1);
    final i = step == 0 ? 0 : (local.dx / step).round().clamp(0, widget.points.length - 1);
    if (i != _sel) setState(() => _sel = i);
  }

  @override
  Widget build(BuildContext context) {
    final pts = widget.points;
    if (pts.isEmpty) return SizedBox(height: widget.height.h, child: Center(child: Text('No data yet', style: T.small)));
    final i = (_sel ?? _last).clamp(0, pts.length - 1);
    final p = pts[i];
    final cmp = widget.compare != null && i < widget.compare!.length ? widget.compare![i].value : null;
    final (min, max) = _range;
    final below = widget.threshold != null && p.value != null && p.value! < widget.threshold!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(p.value == null ? '—' : '${p.value!.toStringAsFixed(1)}${widget.unit}', style: T.title.copyWith(color: below ? C.danger : widget.color)),
            SizedBox(width: 8.w),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: 4.h),
                child: Text(widget.detail?.call(i) ?? p.label, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ),
            if (cmp != null)
              Padding(
                padding: EdgeInsets.only(bottom: 4.h),
                child: Text('${widget.compareLabel} ${cmp.toStringAsFixed(0)}${widget.unit}', style: T.smallStrong.copyWith(color: C.slate)),
              ),
          ],
        ),
        SizedBox(height: 10.h),
        SizedBox(
          height: widget.height.h,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                width: 28.w,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    for (final v in [max, (max + min) / 2, min]) Text(v.round().toString(), style: T.small.copyWith(fontSize: 9.5.sp, color: C.muted)),
                  ],
                ),
              ),
              SizedBox(width: 8.w),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, box) => GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTapDown: (d) => _pick(d.localPosition, box.maxWidth),
                    onHorizontalDragUpdate: (d) => _pick(d.localPosition, box.maxWidth),
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: 1),
                      duration: const Duration(milliseconds: 650),
                      curve: Curves.easeOutCubic,
                      builder: (_, t, _) => CustomPaint(
                        size: Size(box.maxWidth, box.maxHeight),
                        painter: _LinePainter(
                          points: pts,
                          compare: widget.compare,
                          min: min,
                          max: max,
                          threshold: widget.threshold,
                          color: widget.color,
                          selected: i,
                          progress: t,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 6.h),
        Row(
          children: [
            SizedBox(width: 36.w),
            Expanded(child: Text(pts.first.label, style: T.small.copyWith(fontSize: 10.sp), maxLines: 1)),
            if (pts.length > 2) Expanded(child: Text(pts[pts.length ~/ 2].label, textAlign: TextAlign.center, style: T.small.copyWith(fontSize: 10.sp), maxLines: 1)),
            Expanded(child: Text(pts.last.label, textAlign: TextAlign.right, style: T.small.copyWith(fontSize: 10.sp), maxLines: 1)),
          ],
        ),
      ],
    );
  }
}

class _LinePainter extends CustomPainter {
  _LinePainter({
    required this.points,
    required this.compare,
    required this.min,
    required this.max,
    required this.threshold,
    required this.color,
    required this.selected,
    required this.progress,
  });
  final List<ChartPoint> points;
  final List<ChartPoint>? compare;
  final double min, max, progress;
  final double? threshold;
  final Color color;
  final int selected;

  double _x(int i, Size s) => points.length == 1 ? s.width / 2 : s.width * i / (points.length - 1);
  double _y(double v, Size s) => s.height - s.height * ((v.clamp(min, max) - min) / (max - min)) * progress;

  /// Smooth path through the non-null points (a gap breaks the line).
  Path _path(List<ChartPoint> pts, Size s) {
    final path = Path();
    Offset? prev;
    for (var i = 0; i < pts.length; i++) {
      final v = pts[i].value;
      if (v == null) {
        prev = null;
        continue;
      }
      final o = Offset(_x(i, s), _y(v, s));
      if (prev == null) {
        path.moveTo(o.dx, o.dy);
      } else {
        final mid = (prev.dx + o.dx) / 2;
        path.cubicTo(mid, prev.dy, mid, o.dy, o.dx, o.dy);
      }
      prev = o;
    }
    return path;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final grid = Paint()
      ..color = C.border
      ..strokeWidth = 1;
    for (final g in [0.0, .5, 1.0]) {
      canvas.drawLine(Offset(0, size.height * g), Offset(size.width, size.height * g), grid);
    }
    if (threshold != null && threshold! > min && threshold! < max) {
      final y = size.height - size.height * ((threshold! - min) / (max - min));
      final dash = Paint()
        ..color = C.danger.withValues(alpha: .6)
        ..strokeWidth = 1.4;
      for (double x = 0; x < size.width; x += 8) {
        canvas.drawLine(Offset(x, y), Offset(math.min(x + 4, size.width), y), dash);
      }
    }
    if (compare != null) {
      final cp = Paint()
        ..color = C.slate.withValues(alpha: .55)
        ..strokeWidth = 1.6
        ..style = PaintingStyle.stroke;
      final path = _path(compare!, size);
      for (final m in path.computeMetrics()) {
        for (double d = 0; d < m.length; d += 9) {
          canvas.drawPath(m.extractPath(d, math.min(d + 5, m.length)), cp);
        }
      }
    }
    final line = _path(points, size);
    // area under the line (only for an unbroken series)
    if (points.every((p) => p.value != null) && points.length > 1) {
      final area = Path.from(line)
        ..lineTo(_x(points.length - 1, size), size.height)
        ..lineTo(_x(0, size), size.height)
        ..close();
      canvas.drawPath(
        area,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [color.withValues(alpha: .28), color.withValues(alpha: .02)],
          ).createShader(Offset.zero & size),
      );
    }
    canvas.drawPath(
      line,
      Paint()
        ..color = color
        ..strokeWidth = 2.6
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );
    final few = points.length <= 12;
    for (var i = 0; i < points.length; i++) {
      final v = points[i].value;
      if (v == null || (!few && i != selected)) continue;
      final o = Offset(_x(i, size), _y(v, size));
      final low = threshold != null && v < threshold!;
      if (i == selected) {
        canvas.drawLine(Offset(o.dx, 0), Offset(o.dx, size.height), Paint()..color = color.withValues(alpha: .18)..strokeWidth = 1.2);
        canvas.drawCircle(o, 7, Paint()..color = (low ? C.danger : color).withValues(alpha: .2));
      }
      canvas.drawCircle(o, i == selected ? 4.5 : 3, Paint()..color = Colors.white);
      canvas.drawCircle(
        o,
        i == selected ? 4.5 : 3,
        Paint()
          ..color = low ? C.danger : color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _LinePainter old) => old.selected != selected || old.progress != progress || old.points != points;
}

/// One horizontal bar per item (label, value 0-100, optional caption); bars under [threshold] are red.
class HBarChart extends StatelessWidget {
  const HBarChart({super.key, required this.items, this.threshold, this.color = C.primary, this.empty = 'No data yet'});

  /// A null value shows an empty track with [empty] instead of a percentage.
  final List<({String label, double? value, String caption})> items;
  final double? threshold;
  final Color color;
  final String empty;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return Text('No data yet', style: T.small);
    return Column(
      children: [
        for (final it in items)
          Padding(
            padding: EdgeInsets.symmetric(vertical: 6.h),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(it.label, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    if (it.caption.isNotEmpty) Text('${it.caption}  ', style: T.small.copyWith(fontSize: 11.sp)),
                    if (it.value == null)
                      Text(empty, style: T.small.copyWith(fontSize: 11.5.sp, color: C.muted))
                    else
                      Text(
                        '${it.value!.toStringAsFixed(0)}%',
                        style: T.bodyStrong.copyWith(fontSize: 13.sp, color: threshold != null && it.value! < threshold! ? C.danger : C.ink),
                      ),
                  ],
                ),
                SizedBox(height: 5.h),
                LayoutBuilder(
                  builder: (_, box) {
                    final v = it.value ?? 0;
                    final low = it.value != null && threshold != null && v < threshold!;
                    final c = low ? C.danger : color;
                    return Stack(
                      children: [
                        Container(height: 8.h, decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.pill))),
                        TweenAnimationBuilder<double>(
                          tween: Tween(begin: 0, end: (v / 100).clamp(0, 1)),
                          duration: const Duration(milliseconds: 600),
                          curve: Curves.easeOutCubic,
                          builder: (_, v, _) => Container(
                            width: box.maxWidth * v,
                            height: 8.h,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(R.pill),
                              gradient: LinearGradient(colors: [c.withValues(alpha: .65), c]),
                            ),
                          ),
                        ),
                        if (threshold != null && it.value != null)
                          Positioned(
                            left: box.maxWidth * (threshold! / 100).clamp(0, 1) - 1,
                            child: Container(width: 2, height: 8.h, color: C.ink.withValues(alpha: .25)),
                          ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Vertical columns with counts on top (e.g. students per marks band), coloured from [colors].
class ColumnChart extends StatelessWidget {
  const ColumnChart({super.key, required this.values, required this.labels, required this.colors, this.height = 130});
  final List<int> values;
  final List<String> labels;
  final List<Color> colors;
  final double height;
  @override
  Widget build(BuildContext context) {
    final top = values.isEmpty ? 1 : math.max(1, values.reduce(math.max));
    return SizedBox(
      height: height.h + 40.h,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < values.length; i++)
            Expanded(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 5.w),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text('${values[i]}', style: T.bodyStrong.copyWith(fontSize: 13.sp, color: values[i] == 0 ? C.muted : C.ink)),
                    SizedBox(height: 4.h),
                    TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: values[i] / top),
                      duration: const Duration(milliseconds: 600),
                      curve: Curves.easeOutCubic,
                      builder: (_, v, _) => Container(
                        height: math.max(4.0, height.h * v),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.vertical(top: Radius.circular(8.r), bottom: Radius.circular(3.r)),
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [colors[i], colors[i].withValues(alpha: .55)],
                          ),
                        ),
                      ),
                    ),
                    SizedBox(height: 6.h),
                    Text(labels[i], style: T.small.copyWith(fontSize: 10.sp), maxLines: 1, overflow: TextOverflow.visible, softWrap: false),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// A ring split into [segments] with [center] text inside and a legend beside it.
class DonutChart extends StatelessWidget {
  const DonutChart({super.key, required this.segments, required this.center, this.caption = '', this.size = 120});
  final List<({String label, int value, Color color})> segments;
  final String center, caption;
  final double size;
  @override
  Widget build(BuildContext context) {
    final total = segments.fold<int>(0, (a, s) => a + s.value);
    return Row(
      children: [
        SizedBox(
          width: size.r,
          height: size.r,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 700),
            curve: Curves.easeOutCubic,
            builder: (_, t, _) => CustomPaint(
              painter: _DonutPainter(segments: segments, total: total, progress: t),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(center, style: T.h2),
                    if (caption.isNotEmpty) Text(caption, style: T.small.copyWith(fontSize: 10.sp)),
                  ],
                ),
              ),
            ),
          ),
        ),
        SizedBox(width: 18.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final s in segments)
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 4.h),
                  child: Row(
                    children: [
                      Container(width: 10.r, height: 10.r, decoration: BoxDecoration(color: s.color, borderRadius: BorderRadius.circular(3.r))),
                      SizedBox(width: 8.w),
                      Expanded(child: Text(s.label, style: T.small.copyWith(fontSize: 12.sp))),
                      Text('${s.value}', style: T.bodyStrong.copyWith(fontSize: 13.sp)),
                      SizedBox(
                        width: 44.w,
                        child: Text(total == 0 ? '' : '${(s.value * 100 / total).round()}%', textAlign: TextAlign.right, style: T.small.copyWith(fontSize: 11.sp)),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.segments, required this.total, required this.progress});
  final List<({String label, int value, Color color})> segments;
  final int total;
  final double progress;
  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * .14;
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: size.width / 2 - stroke / 2);
    canvas.drawArc(rect, 0, math.pi * 2, false, Paint()..color = C.surface..style = PaintingStyle.stroke..strokeWidth = stroke);
    if (total == 0) return;
    var start = -math.pi / 2;
    for (final s in segments) {
      if (s.value == 0) continue;
      final sweep = math.pi * 2 * s.value / total * progress;
      canvas.drawArc(
        rect,
        start + .02,
        math.max(0, sweep - .04),
        false,
        Paint()
          ..color = s.color
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.butt,
      );
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter old) => old.progress != progress || old.total != total;
}
