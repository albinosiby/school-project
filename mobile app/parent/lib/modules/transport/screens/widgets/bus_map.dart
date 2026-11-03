import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../models/transport_models.dart';
import 'trip_labels.dart';

/// Simulated live map (no map SDK): streets, the route (travelled part solid, the rest dashed),
/// stops and the moving bus, plus the Figma overlays (speed chip, drop ETA bubble, departure chip).
class BusMap extends StatelessWidget {
  const BusMap({
    super.key,
    required this.trip,
    required this.satellite,
    required this.onRecenter,
    required this.onLayers,
  });
  final BusTrip trip;
  final bool satellite;
  final VoidCallback onRecenter, onLayers;

  Widget _chip(Widget child) => Container(
    padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
    decoration: BoxDecoration(
      color: C.bg,
      borderRadius: BorderRadius.circular(R.sm),
      boxShadow: const [
        BoxShadow(color: C.cardShadow, blurRadius: 8, offset: Offset(0, 2)),
      ],
    ),
    child: child,
  );

  Widget _mapButton(String label, IconData icon, VoidCallback onTap) => Tooltip(
    message: label,
    child: Semantics(
      button: true,
      label: label,
      child: Material(
        color: C.bg,
        shape: const CircleBorder(),
        elevation: 2,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(
            width: 44.r,
            height: 44.r,
            child: Icon(icon, size: 20.r, color: C.onSurfaceVariant),
          ),
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final w = box.maxWidth, h = box.maxHeight;
      final pos = trip.mapPosition;
      final drop = trip.dropStop;
      final bus = Offset(pos.x * w, pos.y * h);
      final style = T.smallStrong.copyWith(color: C.onSurface, fontSize: 11.sp);
      return Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          Positioned.fill(
            child: CustomPaint(
              painter: _MapPainter(trip: trip, satellite: satellite),
            ),
          ),
          // Bus marker with a soft halo.
          Positioned(
            left: bus.dx - 26.r,
            top: bus.dy - 26.r,
            child: Semantics(
              label: trip.scheduleBased
                  ? 'Bus ${trip.busNo} position estimated from the schedule'
                  : 'Bus ${trip.busNo} live position',
              child: Container(
                width: 52.r,
                height: 52.r,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: C.primary.withValues(alpha: .18),
                  shape: BoxShape.circle,
                ),
                child: Container(
                  width: 32.r,
                  height: 32.r,
                  decoration: const BoxDecoration(
                    color: C.primary,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.directions_bus_rounded,
                    size: 18.r,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
          // Drop ETA bubble.
          Positioned(
            left: (drop.mapX * w - 24.w).clamp(8.w, w - 140.w),
            top: (drop.mapY * h - 44.h).clamp(8.h, h - 40.h),
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
              decoration: BoxDecoration(
                color: C.onSurfaceVariant,
                borderRadius: BorderRadius.circular(R.pill),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6.r,
                    height: 6.r,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                  ),
                  SizedBox(width: 6.w),
                  Text(
                    trip.etaBubble,
                    style: style.copyWith(color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            left: 12.w,
            top: 12.h,
            child: _chip(
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8.r,
                    height: 8.r,
                    decoration: BoxDecoration(
                      color:
                          trip.phase == TripPhase.completed ||
                              trip.phase == TripPhase.scheduled
                          ? C.muted
                          : C.success,
                      shape: BoxShape.circle,
                    ),
                  ),
                  SizedBox(width: 6.w),
                  Text(
                    trip.mapStatus,
                    style: style,
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            right: 12.w,
            top: 12.h,
            child: Column(
              children: [
                _mapButton(
                  'Re-centre on bus',
                  Icons.my_location_rounded,
                  onRecenter,
                ),
                SizedBox(height: 10.h),
                _mapButton(
                  satellite ? 'Show street map' : 'Show satellite map',
                  Icons.layers_outlined,
                  onLayers,
                ),
              ],
            ),
          ),
          Positioned(
            left: 12.w,
            bottom: 12.h,
            right: 60.w,
            child: Align(
              alignment: Alignment.centerLeft,
              child: _chip(
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.school_outlined, size: 14.r, color: C.primary),
                    SizedBox(width: 6.w),
                    Flexible(
                      child: Text(
                        trip.originLine,
                        style: style,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      );
    },
  );
}

class _MapPainter extends CustomPainter {
  _MapPainter({required this.trip, required this.satellite});
  final BusTrip trip;
  final bool satellite;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    Offset p(double x, double y) => Offset(x * w, y * h);
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = satellite ? C.mapLandDark : C.mapLand,
    );
    final park = Paint()..color = satellite ? C.mapParkDark : C.mapPark;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(.02 * w, .05 * h, .22 * w, .2 * h),
        Radius.circular(24.r),
      ),
      park,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(.62 * w, .58 * h, .24 * w, .3 * h),
        Radius.circular(28.r),
      ),
      park,
    );
    canvas.drawOval(
      Rect.fromLTWH(-.12 * w, .72 * h, .45 * w, .45 * h),
      Paint()..color = satellite ? C.mapWaterDark : C.mapWater,
    );
    final road = Paint()
      ..color = satellite ? C.mapRoadDark : C.mapRoad
      ..strokeWidth = 7.r
      ..style = PaintingStyle.stroke;
    for (final y in [.18, .45, .62, .84]) {
      canvas.drawLine(p(0, y), p(1, y), road);
    }
    for (final x in [.12, .36, .55, .74, .92]) {
      canvas.drawLine(p(x, 0), p(x, 1), road);
    }
    canvas.drawPath(
      Path()
        ..moveTo(.6 * w, 0)
        ..quadraticBezierTo(.95 * w, .4 * h, .88 * w, h),
      road..strokeWidth = 10.r,
    );

    // Route: travelled part solid, the rest dashed.
    final stops = trip.stops;
    final bus = trip.mapPosition;
    final busPt = p(bus.x, bus.y);
    final solid = Path()..moveTo(stops.first.mapX * w, stops.first.mapY * h);
    final rest = Path()..moveTo(busPt.dx, busPt.dy);
    var reachedBus = false;
    for (var i = 1; i < stops.length; i++) {
      final pt = p(stops[i].mapX, stops[i].mapY);
      if (trip.isPassed(stops[i])) {
        solid.lineTo(pt.dx, pt.dy);
      } else {
        if (!reachedBus) {
          solid.lineTo(busPt.dx, busPt.dy);
          reachedBus = true;
        }
        rest.lineTo(pt.dx, pt.dy);
      }
    }
    final line = Paint()
      ..color = C.primary
      ..strokeWidth = 4.r
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    canvas.drawPath(solid, line);
    for (final m in rest.computeMetrics()) {
      for (var d = 0.0; d < m.length; d += 14.r) {
        canvas.drawPath(m.extractPath(d, d + 8.r), line);
      }
    }
    for (final s in stops) {
      final c = p(s.mapX, s.mapY);
      final passed = trip.isPassed(s);
      if (s.isChildDrop) {
        canvas.drawCircle(
          c,
          14.r,
          Paint()..color = C.primary.withValues(alpha: .2),
        );
      }
      canvas.drawCircle(
        c,
        6.r,
        Paint()..color = passed ? C.primary : Colors.white,
      );
      canvas.drawCircle(
        c,
        6.r,
        Paint()
          ..color = C.primary
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5.r,
      );
    }
  }

  @override
  bool shouldRepaint(_MapPainter old) =>
      old.trip != trip || old.satellite != satellite;
}
