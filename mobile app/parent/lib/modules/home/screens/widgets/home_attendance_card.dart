import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../../attendance/models/attendance_models.dart';
import '../../models/home_models.dart';

/// "TODAY'S ATTENDANCE" card: today's status, the RFID gate entry and the term average.
class HomeAttendanceCard extends StatelessWidget {
  const HomeAttendanceCard({super.key, required this.summary});
  final HomeSummary summary;

  @override
  Widget build(BuildContext context) {
    final r = summary.attendanceToday;
    final (label, tone) = !summary.isSchoolDay
        ? ('No School Today', Tone.neutral)
        : r == null
        ? ('Not Marked Yet', Tone.neutral)
        : switch (r.status) {
            AttendanceStatus.present => ('Present Today', Tone.success),
            AttendanceStatus.late => ('Late Today', Tone.warning),
            AttendanceStatus.halfDay => ('Half Day', Tone.purple),
            AttendanceStatus.absent => ('Absent Today', Tone.danger),
            AttendanceStatus.leave => ('On Leave', Tone.brand),
            AttendanceStatus.holiday => ('Holiday', Tone.neutral),
          };
    final gate = summary.gateEntry;
    final avg = summary.termAttendance;
    final standing = avg >= 85
        ? 'Good Standing'
        : (avg >= 75 ? 'Satisfactory' : 'Below 75% minimum');
    return AppElevatedCard(
      onTap: () => context.go(RoutePaths.academicsSection('attendance')),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  "TODAY'S ATTENDANCE",
                  style: T.capsMuted.copyWith(fontSize: 12.sp),
                ),
              ),
              Pill(
                label,
                tone: tone,
                icon: tone == Tone.success
                    ? Icons.check_circle_outline_rounded
                    : null,
              ),
            ],
          ),
          SizedBox(height: 12.h),
          Container(
            padding: EdgeInsets.all(12.w),
            decoration: BoxDecoration(
              color: C.surface,
              borderRadius: BorderRadius.circular(R.md),
              border: Border.all(color: C.cardBorder),
            ),
            child: Row(
              children: [
                Container(
                  width: 34.r,
                  height: 34.r,
                  decoration: BoxDecoration(
                    color: gate == null ? C.outline : C.emeraldSoft,
                    borderRadius: BorderRadius.circular(R.sm),
                  ),
                  child: Icon(
                    Icons.badge_outlined,
                    size: 18.r,
                    color: gate == null ? C.slate : C.emerald,
                  ),
                ),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        gate == null
                            ? (summary.isSchoolDay
                                  ? 'No RFID gate entry yet'
                                  : 'No gate entry on holidays')
                            : 'Gate entry verified via RFID Badge',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.bodyStrong.copyWith(
                          color: C.ink,
                          fontSize: 13.sp,
                        ),
                      ),
                      Text(
                        gate == null
                            ? 'You will be notified on entry'
                            : '${fmtMinute(gate.at.hour * 60 + gate.at.minute)} • ${gate.gate}',
                        style: T.small.copyWith(color: C.muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 14.h),
          Row(
            children: [
              Expanded(flex: 3, child: AppProgress(avg / 100, height: 6)),
              SizedBox(width: 10.w),
              Text(
                '${avg.toStringAsFixed(1)}%',
                key: const Key('home-term-average'),
                style: T.smallStrong.copyWith(color: C.ink, fontSize: 13.sp),
              ),
              SizedBox(width: 10.w),
              Flexible(
                flex: 4,
                child: Text(
                  'Term Average ($standing)',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.end,
                  style: T.small,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
