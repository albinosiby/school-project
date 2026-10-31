import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/firebase/crew_session.dart' show isoMonth;
import '../../shared/widgets/crew_widgets.dart';
import '../../trips/screens/widgets/trip_card.dart';
import '../bloc/crew_attendance_bloc.dart';
import '../models/crew_attendance_models.dart';

/// My attendance: check in / out today and the month's days (contract 14.5).
class CrewAttendanceScreen extends StatefulWidget {
  const CrewAttendanceScreen({super.key});
  @override
  State<CrewAttendanceScreen> createState() => _CrewAttendanceScreenState();
}

class _CrewAttendanceScreenState extends State<CrewAttendanceScreen> {
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);

  @override
  Widget build(BuildContext context) => BlocProvider<PunchBloc>(
    create: (_) => getIt<PunchBloc>(),
    child: BlocListener<PunchBloc, PunchState>(
      listener: (context, s) {
        final msg = s.error ?? s.done;
        if (msg != null) ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(behavior: SnackBarBehavior.floating, backgroundColor: s.error != null ? C.danger : C.ink, content: Text(msg)));
      },
      child: DetailScaffold(
        title: 'My attendance',
        fallbackRoute: RoutePaths.profile,
        body: DataView<CrewAttendanceBloc, CrewAttendance>(
          create: () => getIt<CrewAttendanceBloc>(),
          dataKey: isoMonth(_month),
          builder: (context, data) {
            final today = data.today;
            final busy = context.watch<PunchBloc>().state.busy;
            final thisMonth = isoMonth(_month) == isoMonth(DateTime.now());
            return ListView(
              padding: EdgeInsets.all(16.w),
              children: [
                AppSurfaceCard(
                  hero: true, color: C.panel, borderColor: C.panelBorder,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(fmtDate(DateTime.now(), year: true).toUpperCase(), style: T.capsMuted),
                    SizedBox(height: 6.h),
                    Row(children: [
                      Expanded(child: Text(today == null ? 'Not checked in' : today.punchedOut ? 'Shift complete' : 'On duty', style: T.h1)),
                      if (today != null) Pill(today.status, tone: today.status == 'Present' ? Tone.success : today.status == 'Late' ? Tone.warning : Tone.danger),
                    ]),
                    SizedBox(height: 12.h),
                    Row(children: [
                      Expanded(child: InfoCell('Check in', clock24(today?.inTime), icon: Icons.login_rounded)),
                      SizedBox(width: 8.w),
                      Expanded(child: InfoCell('Check out', clock24(today?.outTime), icon: Icons.logout_rounded)),
                      SizedBox(width: 8.w),
                      Expanded(child: InfoCell('On time by', clock24(data.checkInBy), icon: Icons.schedule_rounded)),
                    ]),
                    SizedBox(height: 12.h),
                    if (today == null)
                      AppButton('Check in now', icon: Icons.login_rounded, busy: busy, onPressed: () => context.read<PunchBloc>().add(const PunchIn()))
                    else if (!today.punchedOut)
                      AppButton('Check out', icon: Icons.logout_rounded, kind: BtnKind.outline, busy: busy, onPressed: () => context.read<PunchBloc>().add(const PunchOut()))
                    else
                      Text('Have a good evening. The office sees this day in Transport > Crew attendance.', style: T.small),
                  ]),
                ),
                SizedBox(height: 16.h),
                Row(children: [
                  IconButton(onPressed: () => setState(() => _month = DateTime(_month.year, _month.month - 1)), icon: const Icon(Icons.chevron_left_rounded)),
                  Expanded(child: Text(fmtMonth(_month), style: T.h3, textAlign: TextAlign.center)),
                  IconButton(onPressed: thisMonth ? null : () => setState(() => _month = DateTime(_month.year, _month.month + 1)), icon: const Icon(Icons.chevron_right_rounded)),
                ]),
                SizedBox(height: 8.h),
                Row(children: [
                  Expanded(child: StatTile(label: 'Present', value: '${data.count('Present')}', tone: Tone.success)),
                  SizedBox(width: 8.w),
                  Expanded(child: StatTile(label: 'Late', value: '${data.count('Late')}', tone: Tone.warning)),
                  SizedBox(width: 8.w),
                  Expanded(child: StatTile(label: 'Absent', value: '${data.count('Absent')}', tone: Tone.danger)),
                  SizedBox(width: 8.w),
                  Expanded(child: StatTile(label: 'Leave', value: '${data.count('Leave')}', tone: Tone.purple)),
                ]),
                SizedBox(height: 12.h),
                if (data.month.isEmpty) const AppEmptyState('No days recorded', icon: Icons.event_busy_rounded),
                AppSurfaceCard(
                  padding: EdgeInsets.zero,
                  child: Column(children: [
                    for (final (i, d) in data.month.indexed) ...[
                      if (i > 0) const Divider(height: 1, color: C.border),
                      ListTile(
                        title: Text(fmtTripDate(d.date), style: T.bodyStrong),
                        subtitle: Text('${clock24(d.inTime)} – ${clock24(d.outTime)}${d.source == 'admin' ? ' · corrected by office' : ''}${d.note.isEmpty ? '' : ' · ${d.note}'}', style: T.small),
                        trailing: Pill(d.status, tone: d.status == 'Present' ? Tone.success : d.status == 'Late' ? Tone.warning : d.status == 'Leave' ? Tone.purple : Tone.danger),
                      ),
                    ],
                  ]),
                ),
              ],
            );
          },
        ),
      ),
    ),
  );
}
