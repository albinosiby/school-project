import 'package:flutter/material.dart';
import '../../../../core/widgets/data_view.dart';
import '../../../../design_system/design_system.dart';
import '../../../../di/injection.dart';
import '../../../attendance/bloc/attendance_bloc.dart';
import '../../../attendance/models/attendance_models.dart';
import '../../../crew/models/crew_models.dart';
import '../../../shared/widgets/crew_widgets.dart';
import '../../../trips/models/trip_models.dart';
import '../../../trips/screens/widgets/trip_card.dart';
import '../../models/student_models.dart';

/// Student card popup (Figma 1.4.1.1 / 5 care notes): identity, stop, guardian with Call, recent bus attendance.
Future<void> showStudentSheet(BuildContext context, BusStudent s, Bus bus) => showAppSheet<void>(
  context,
  title: s.name,
  subtitle: [s.classLabel, s.rollLabel, if (s.grn.isNotEmpty) s.grn].where((e) => e.isNotEmpty).join(' · '),
  useRootNavigator: true,
  builder: (ctx) {
    final stop = bus.stop(s.busStopId);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (s.medicalNote.isNotEmpty) ...[
        AppSurfaceCard(
          color: C.dangerSoft, borderColor: C.dangerSoft,
          child: Row(children: [
            Icon(Icons.medical_information_rounded, color: C.danger, size: 22.r),
            SizedBox(width: 10.w),
            Expanded(child: Text(s.medicalNote, style: T.bodyStrong.copyWith(color: C.danger))),
          ]),
        ),
        SizedBox(height: 12.h),
      ],
      Row(children: [
        Expanded(child: InfoCell('Stop', s.busStop.isEmpty ? 'Not set' : s.busStop, icon: Icons.place_rounded)),
        SizedBox(width: 8.w),
        Expanded(child: InfoCell('Pickup / Drop', stop == null ? '--' : '${clock24(stop.pickupTime)} / ${clock24(stop.dropTime)}', icon: Icons.schedule_rounded)),
      ]),
      SizedBox(height: 12.h),
      AppSurfaceCard(
        child: Row(children: [
          Avatar(s.guardian.isEmpty ? '?' : s.guardian, size: 44, tone: Tone.purple),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.guardian.isEmpty ? 'Guardian not recorded' : s.guardian, style: T.bodyStrong),
              Text('${s.relation.isEmpty ? 'Guardian' : s.relation} · ${s.phone.isEmpty ? 'no phone' : s.phone}', style: T.small),
            ]),
          ),
          CallButton(phone: s.phone, name: s.guardian),
        ]),
      ),
      SizedBox(height: 16.h),
      Text('RECENT BUS ATTENDANCE', style: T.capsMuted),
      SizedBox(height: 8.h),
      SizedBox(
        height: 220.h,
        child: DataView<BusAttendanceHistoryBloc, List<TripAttendance>>(
          create: () => getIt<BusAttendanceHistoryBloc>(),
          dataKey: bus.id,
          nested: true,
          builder: (context, history) {
            final rows = [for (final a in history) if (a.of(s.id) != null) (a, a.of(s.id)!)].take(14).toList();
            if (rows.isEmpty) return const AppEmptyState('No trips yet', icon: Icons.history_rounded);
            return ListView(
              children: [
                for (final (a, m) in rows)
                  ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(a.kind.index == 0 ? Icons.wb_sunny_rounded : Icons.wb_twilight_rounded, color: C.slate, size: 20.r),
                    title: Text('${fmtTripDate(a.date)} · ${a.kind.short}', style: T.bodyStrong),
                    subtitle: Text('${clock(m.at)}${m.byName.isEmpty ? '' : ' · ${m.byName}'}', style: T.small),
                    trailing: Pill(m.status.label, tone: markTone(m.status)),
                  ),
              ],
            );
          },
        ),
      ),
    ]);
  },
);
