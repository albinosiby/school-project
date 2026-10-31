import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../attendance/screens/widgets/attendance_list.dart';
import '../../crew/bloc/crew_bloc.dart';
import '../../shared/widgets/crew_widgets.dart';
import '../../students/bloc/roster_bloc.dart';
import '../../students/models/student_models.dart';
import '../bloc/trips_bloc.dart';
import '../models/trip_models.dart';
import 'widgets/trip_card.dart';

/// Figma 3. Live / 1.2 Student Manifest / 1.15 End Trip: one trip with its checklist state, start / end actions and the
/// student list where the crew mark boarded / absent / dropped and call parents.
class TripDetailScreen extends StatelessWidget {
  const TripDetailScreen({super.key, required this.tripId});
  final String tripId;

  @override
  Widget build(BuildContext context) => BlocProvider<TripActionBloc>(
    create: (_) => getIt<TripActionBloc>(),
    child: BlocListener<TripActionBloc, TripActionState>(
      listener: (context, s) {
        final msg = s.error ?? s.done;
        if (msg != null) ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(behavior: SnackBarBehavior.floating, backgroundColor: s.error != null ? C.danger : C.ink, content: Text(msg)));
      },
      child: CrewContextView(
        builder: (context, ctx) {
          final date = tripId.split('_').first;
          final today = date == _today();
          return DataView<DayTripsBloc, List<Trip>>(
            create: () => getIt<DayTripsBloc>(),
            dataKey: '${ctx.bus!.id}|$date',
            refreshable: false,
            builder: (context, trips) {
              final trip = trips.where((t) => t.id == tripId).firstOrNull;
              if (trip == null) {
                return today
                    ? const DetailScaffold(title: 'Trip', body: AppEmptyState('Trip not found', hint: 'This trip belongs to another bus or day.'))
                    : _HistoryDetail(tripId: tripId, ctx: ctx);
              }
              return _TripBody(trip: trip, ctx: ctx);
            },
          );
        },
      ),
    ),
  );

  static String _today() {
    final d = DateTime.now();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }
}

/// A past trip (not in today's stream): read it from the history stream.
class _HistoryDetail extends StatelessWidget {
  const _HistoryDetail({required this.tripId, required this.ctx});
  final String tripId;
  final CrewContext ctx;
  @override
  Widget build(BuildContext context) => DataView<TripHistoryBloc, List<Trip>>(
    create: () => getIt<TripHistoryBloc>(),
    dataKey: ctx.bus!.id,
    refreshable: false,
    builder: (context, trips) {
      final trip = trips.where((t) => t.id == tripId).firstOrNull;
      if (trip == null) return const DetailScaffold(title: 'Trip', body: AppEmptyState('Trip not found'));
      return _TripBody(trip: trip, ctx: ctx);
    },
  );
}

class _TripBody extends StatelessWidget {
  const _TripBody({required this.trip, required this.ctx});
  final Trip trip;
  final CrewContext ctx;

  @override
  Widget build(BuildContext context) {
    final bus = ctx.bus!;
    final action = context.watch<TripActionBloc>().state;
    return DetailScaffold(
      title: trip.kind.label,
      subtitle: '${trip.bus} · ${fmtTripDate(trip.date)}',
      fallbackRoute: RoutePaths.trips,
      actions: [
        if (!trip.isCompleted && trip.kind == TripKind.pickup)
          IconButton(tooltip: 'Checklist', onPressed: () => context.push(RoutePaths.checklist(trip.id)), icon: Icon(trip.checklist.complete ? Icons.checklist_rtl_rounded : Icons.checklist_rounded, color: trip.checklist.complete ? C.success : C.warning)),
      ],
      body: DataView<RosterBloc, List<BusStudent>>(
        create: () => getIt<RosterBloc>(),
        dataKey: bus.id,
        refreshable: false,
        builder: (context, roster) => AttendanceList(
          trip: trip,
          bus: bus,
          roster: roster,
          header: _Header(trip: trip, action: action),
        ),
      ),
      bottom: _bottom(context, action),
    );
  }

  Widget? _bottom(BuildContext context, TripActionState action) {
    if (trip.isCompleted) return null;
    if (trip.isScheduled) {
      if (trip.needsChecklist) {
        return AppButton('Complete pre-trip checklist (${trip.checklist.done}/6)', icon: Icons.checklist_rounded, kind: BtnKind.soft, onPressed: () => context.push(RoutePaths.checklist(trip.id)));
      }
      return AppButton('Start ${trip.kind.short.toLowerCase()} trip', icon: Icons.play_arrow_rounded, busy: action.busy, onPressed: () => _confirmStart(context));
    }
    return AppButton('End trip', icon: Icons.flag_rounded, kind: BtnKind.danger, busy: action.busy, onPressed: () => _endSheet(context));
  }

  Future<void> _confirmStart(BuildContext context) async {
    final odo = await showAppSheet<int?>(
      context,
      title: 'Start ${trip.kind.label.toLowerCase()}',
      subtitle: 'Mark pupils as they board. Parents are told when their child boards.',
      builder: (ctx) => _OdometerForm(label: 'Odometer at start (km)', initial: trip.odometerStart, confirm: 'Start trip'),
    );
    if (odo == null || !context.mounted) return;
    context.read<TripActionBloc>().add(StartTrip(trip, odometer: odo < 0 ? null : odo));
  }

  Future<void> _endSheet(BuildContext context) async {
    final pending = trip.pending;
    final r = await showAppSheet<(int, String)?>(
      context,
      title: 'End ${trip.kind.label.toLowerCase()}',
      subtitle: pending > 0
          ? '$pending ${pending == 1 ? 'pupil is' : 'pupils are'} not marked yet. Unmarked pupils stay pending for the office.'
          : trip.kind == TripKind.pickup ? 'Every boarded pupil is marked as arrived at school.' : 'Pupils still on board stay marked boarded for follow-up.',
      builder: (ctx) => _EndForm(trip: trip),
    );
    if (r == null || !context.mounted) return;
    context.read<TripActionBloc>().add(EndTrip(trip, odometer: r.$1 < 0 ? null : r.$1, note: r.$2));
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.trip, required this.action});
  final Trip trip;
  final TripActionState action;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    AppSurfaceCard(
      hero: true, color: C.panel, borderColor: C.panelBorder,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Pill(trip.status.label, tone: tripTone(trip.status), dot: trip.isActive),
          SizedBox(width: 8.w),
          if (trip.kind == TripKind.pickup) Pill(trip.checklist.complete ? 'Pre-trip passed' : 'Checklist ${trip.checklist.done}/6', tone: trip.checklist.complete ? Tone.success : Tone.warning, icon: Icons.checklist_rounded),
          SizedBox(width: 8.w),
          Expanded(
            child: Text(
              trip.isActive ? 'Started ${clock(trip.startedAt)}' : trip.isCompleted ? '${clock(trip.startedAt)} – ${clock(trip.endedAt)}' : trip.routeName,
              style: T.small, textAlign: TextAlign.right, maxLines: 1, overflow: TextOverflow.ellipsis,
            ),
          ),
        ]),
        SizedBox(height: 12.h),
        Row(children: [
          Expanded(child: InfoCell('Total', '${trip.total}')),
          SizedBox(width: 8.w),
          Expanded(child: InfoCell(trip.kind == TripKind.pickup && trip.isCompleted ? 'Arrived' : 'Boarded', '${trip.kind == TripKind.pickup && trip.isCompleted ? trip.dropped : trip.boarded}')),
          SizedBox(width: 8.w),
          Expanded(child: InfoCell('Absent', '${trip.absent}')),
          SizedBox(width: 8.w),
          Expanded(child: InfoCell('Pending', '${trip.pending}')),
        ]),
        if (trip.driver.isNotEmpty || trip.attendant.isNotEmpty) ...[
          SizedBox(height: 10.h),
          Text('Crew: ${[if (trip.driver.isNotEmpty) '${trip.driver} (driver)', if (trip.attendant.isNotEmpty) '${trip.attendant} (staff)'].join(' · ')}', style: T.small),
        ],
        if (trip.note.isNotEmpty) ...[SizedBox(height: 6.h), Text('Note: ${trip.note}', style: T.small)],
      ]),
    ),
    SizedBox(height: 14.h),
  ]);
}

class _OdometerForm extends StatefulWidget {
  const _OdometerForm({required this.label, this.initial, required this.confirm});
  final String label, confirm;
  final int? initial;
  @override
  State<_OdometerForm> createState() => _OdometerFormState();
}

class _OdometerFormState extends State<_OdometerForm> {
  late final _c = TextEditingController(text: widget.initial?.toString() ?? '');
  @override
  Widget build(BuildContext context) => Column(children: [
    AppTextField(label: widget.label, controller: _c, keyboard: TextInputType.number, hint: 'optional'),
    AppButton(widget.confirm, icon: Icons.play_arrow_rounded, onPressed: () => Navigator.pop(context, int.tryParse(_c.text.trim()) ?? -1)),
  ]);
}

class _EndForm extends StatefulWidget {
  const _EndForm({required this.trip});
  final Trip trip;
  @override
  State<_EndForm> createState() => _EndFormState();
}

class _EndFormState extends State<_EndForm> {
  final _odo = TextEditingController();
  final _note = TextEditingController();
  @override
  Widget build(BuildContext context) => Column(children: [
    AppTextField(label: 'Odometer at end (km)', controller: _odo, keyboard: TextInputType.number, hint: 'optional'),
    AppTextField(label: 'Note for the office', controller: _note, maxLines: 3, hint: 'Delays, incidents, pupils handed over…'),
    AppButton('End trip', icon: Icons.flag_rounded, kind: BtnKind.danger, onPressed: () => Navigator.pop(context, (int.tryParse(_odo.text.trim()) ?? -1, _note.text.trim()))),
  ]);
}
