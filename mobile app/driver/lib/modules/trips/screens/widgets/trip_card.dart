import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../../shared/widgets/crew_widgets.dart';
import '../../models/trip_models.dart';

/// One trip row (Figma 2. Trips): kind, route, status, boarded / total, start or open.
class TripCard extends StatelessWidget {
  const TripCard({super.key, required this.trip, required this.onTap, this.featured = false});
  final Trip trip;
  final VoidCallback onTap;
  final bool featured;

  @override
  Widget build(BuildContext context) {
    final t = trip;
    final icon = t.kind == TripKind.pickup ? Icons.wb_sunny_rounded : Icons.wb_twilight_rounded;
    return AppSurfaceCard(
      onTap: onTap,
      semanticLabel: '${t.kind.label} ${t.status.label}',
      borderColor: featured && t.isActive ? C.success : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          IconTile(icon, tone: t.isActive ? Tone.success : t.isCompleted ? Tone.brand : Tone.warning),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t.kind.label, style: T.h3),
              Text('${t.routeName.isEmpty ? t.bus : t.routeName} · ${t.date == '' ? '' : fmtTripDate(t.date)}', style: T.small),
            ]),
          ),
          Pill(t.status.label, tone: tripTone(t.status), dot: t.isActive),
        ]),
        SizedBox(height: 12.h),
        Row(children: [
          Expanded(child: _Metric('Students', '${t.total}')),
          SizedBox(width: 8.w),
          Expanded(child: _Metric(t.kind == TripKind.pickup && t.isCompleted ? 'Arrived' : 'Boarded', '${t.kind == TripKind.pickup && t.isCompleted ? t.dropped : t.boarded}', color: C.successDark)),
          SizedBox(width: 8.w),
          Expanded(child: _Metric('Absent', '${t.absent}', color: t.absent > 0 ? C.danger : null)),
          SizedBox(width: 8.w),
          Expanded(child: _Metric(t.isCompleted ? 'Ended' : t.isActive ? 'Started' : 'Checklist', t.isCompleted ? clock(t.endedAt) : t.isActive ? clock(t.startedAt) : '${t.checklist.done}/6')),
        ]),
        if (featured) ...[
          SizedBox(height: 12.h),
          AppButton(
            t.isActive ? 'Open live trip' : t.needsChecklist ? 'Start pre-trip checklist' : 'Start ${t.kind.short.toLowerCase()} trip',
            icon: t.isActive ? Icons.sensors_rounded : Icons.play_arrow_rounded,
            kind: t.isActive ? BtnKind.soft : BtnKind.primary,
            onPressed: onTap,
          ),
        ],
      ]),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value, {this.color});
  final String label, value;
  final Color? color;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(vertical: 8.h, horizontal: 6.w),
    decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.sm)),
    child: Column(children: [
      FittedBox(fit: BoxFit.scaleDown, child: Text(value, style: T.h3.copyWith(color: color), maxLines: 1)),
      Text(label, style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
    ]),
  );
}

/// "2026-10-31" -> "Fri, 31 Oct".
String fmtTripDate(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${days[d.weekday - 1]}, ${d.day} ${months[d.month - 1]}';
}

/// "2018-04-02" -> "Apr 2018".
String fmtMonthYear(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${months[d.month - 1]} ${d.year}';
}
