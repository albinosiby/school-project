import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/firebase/crew_session.dart' show isoDay, isoMonth;
import '../../crew/bloc/crew_bloc.dart';
import '../../crew_attendance/bloc/crew_attendance_bloc.dart';
import '../../crew_attendance/models/crew_attendance_models.dart';
import '../../shared/widgets/crew_widgets.dart';
import '../../trips/bloc/trips_bloc.dart';
import '../../trips/models/trip_models.dart';
import '../../trips/screens/widgets/trip_card.dart';

/// Figma 1. Home (driver) / 2 Assistant Home: bus card, today's trips, crew partner, check-in, quick actions.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: C.surface,
    body: Column(children: [
      const CrewTabHeader(),
      Expanded(
        child: CrewContextView(
          requireBus: false,
          builder: (context, ctx) {
            final bus = ctx.bus;
            final date = DateTime.now();
            return RefreshIndicator(
              onRefresh: () async => context.read<CrewBloc>().add(const RefreshData()),
              child: ListView(
                padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 110.h),
                children: [
                  Text(fmtDate(date, year: true).toUpperCase(), style: T.capsMuted),
                  SizedBox(height: 4.h),
                  Row(children: [
                    Expanded(child: Text('Welcome, ${ctx.me.name.split(' ').first} 👋', style: T.title)),
                    Pill('#${ctx.me.empId}', tone: Tone.neutral),
                  ]),
                  SizedBox(height: 14.h),
                  if (bus == null)
                    AppSurfaceCard(
                      child: Row(children: [
                        IconTile(Icons.no_transfer_rounded, tone: Tone.warning),
                        SizedBox(width: 12.w),
                        Expanded(child: Text('No bus allotted yet. The transport office assigns buses from the admin console.', style: T.body)),
                      ]),
                    )
                  else ...[
                    _BusCard(ctx: ctx),
                    SizedBox(height: 16.h),
                    _TodayTrips(busId: bus.id, date: isoDay(date)),
                  ],
                  SizedBox(height: 16.h),
                  _CheckInCard(month: isoMonth(date)),
                  SizedBox(height: 16.h),
                  if (ctx.partner != null) ...[
                    HomeSection(title: 'Crew on board', child: _PartnerCard(partner: ctx.partner!)),
                  ],
                  HomeSection(
                    title: 'Quick actions',
                    // rows sized by their content (a fixed aspect ratio overflowed at larger text sizes / in landscape)
                    child: _ActionGrid(children: [
                      AppQuickAction(icon: Icons.groups_rounded, label: 'Students', onTap: () => context.go(RoutePaths.students)),
                      AppQuickAction(icon: Icons.place_rounded, label: 'Stops', onTap: () => context.push(RoutePaths.stops)),
                      AppQuickAction(icon: Icons.history_rounded, label: 'Trip history', onTap: () => context.push(RoutePaths.tripHistory)),
                      AppQuickAction(icon: Icons.event_busy_rounded, label: 'Apply leave', onTap: () => context.push(RoutePaths.applyLeave)),
                      AppQuickAction(icon: Icons.campaign_rounded, label: 'Notices', onTap: () => context.push(RoutePaths.notices)),
                      AppQuickAction(icon: Icons.fact_check_rounded, label: 'My attendance', onTap: () => context.push(RoutePaths.attendance)),
                    ]),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    ]),
  );
}

class _BusCard extends StatelessWidget {
  const _BusCard({required this.ctx});
  final CrewContext ctx;
  @override
  Widget build(BuildContext context) {
    final bus = ctx.bus!;
    return AppSurfaceCard(
      hero: true,
      color: C.panel,
      borderColor: C.panelBorder,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          IconTile(Icons.directions_bus_rounded, tone: Tone.brand, size: 56),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text(bus.label, style: T.h1),
                SizedBox(width: 8.w),
                Flexible(child: Pill(bus.regNo, tone: Tone.neutral)),
              ]),
              SizedBox(height: 4.h),
              Text('${bus.model.isEmpty ? '${bus.capacity}-Seater' : bus.model} · ${bus.routeName}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
        ]),
        SizedBox(height: 12.h),
        Row(children: [
          Expanded(child: InfoCell('Students', '${bus.studentCount}', icon: Icons.groups_rounded)),
          SizedBox(width: 8.w),
          Expanded(child: InfoCell('Stops', '${bus.stops.length}', icon: Icons.place_rounded)),
          SizedBox(width: 8.w),
          Expanded(child: InfoCell('Pickup', clock24(bus.pickupStart), icon: Icons.schedule_rounded)),
        ]),
        if (bus.status != 'Active') ...[
          SizedBox(height: 10.h),
          Pill('Bus ${bus.status.toLowerCase()}', tone: Tone.warning, icon: Icons.build_rounded),
        ],
      ]),
    );
  }
}

class _TodayTrips extends StatelessWidget {
  const _TodayTrips({required this.busId, required this.date});
  final String busId, date;
  @override
  Widget build(BuildContext context) => DataView<DayTripsBloc, List<Trip>>(
    create: () => getIt<DayTripsBloc>(),
    dataKey: '$busId|$date',
    nested: true,
    builder: (context, trips) {
      final live = trips.where((t) => t.isActive).firstOrNull;
      final next = live ?? trips.where((t) => t.isScheduled).firstOrNull;
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Pill(live != null ? 'LIVE TRIP' : 'NEXT TRIP', tone: live != null ? Tone.success : Tone.brand, dot: live != null),
          const Spacer(),
          TextButton(onPressed: () => context.go(RoutePaths.trips), child: Text('All trips', style: T.smallStrong.copyWith(color: C.primary))),
        ]),
        SizedBox(height: 8.h),
        if (next == null)
          AppSurfaceCard(
            child: Row(children: [
              IconTile(Icons.task_alt_rounded, tone: Tone.success),
              SizedBox(width: 12.w),
              Expanded(child: Text("Both of today's trips are done. See you tomorrow!", style: T.bodyStrong)),
            ]),
          )
        else
          TripCard(trip: next, onTap: () => context.push(RoutePaths.trip(next.id)), featured: true),
      ]);
    },
  );
}

class _CheckInCard extends StatelessWidget {
  const _CheckInCard({required this.month});
  final String month;
  @override
  Widget build(BuildContext context) => BlocProvider<CrewAttendanceBloc>(
    key: ValueKey('home-att-$month'),
    create: (_) => getIt<CrewAttendanceBloc>()..add(LoadData(month)),
    child: BlocProvider<PunchBloc>(
      create: (_) => getIt<PunchBloc>(),
      child: BlocListener<PunchBloc, PunchState>(
        listener: (context, s) {
          final msg = s.error ?? s.done;
          if (msg != null) ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(behavior: SnackBarBehavior.floating, backgroundColor: s.error != null ? C.danger : C.ink, content: Text(msg)));
        },
        child: BlocBuilder<CrewAttendanceBloc, DataState<CrewAttendance>>(
          builder: (context, state) {
            final today = state.data?.today;
            final busy = context.watch<PunchBloc>().state.busy;
            return AppSurfaceCard(
              onTap: () => context.push(RoutePaths.attendance),
              child: Row(children: [
                IconTile(today == null ? Icons.login_rounded : today.punchedOut ? Icons.task_alt_rounded : Icons.logout_rounded, tone: today == null ? Tone.warning : Tone.success),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(today == null ? 'Not checked in' : today.punchedOut ? 'Shift complete' : 'On duty since ${clock24(today.inTime)}', style: T.bodyStrong),
                    SizedBox(height: 2.h),
                    Text(
                      today == null
                          ? 'Check in by ${clock24(state.data?.checkInBy)} to be on time'
                          : today.punchedOut ? 'In ${clock24(today.inTime)} · Out ${clock24(today.outTime)}' : today.status == 'Late' ? 'Marked late today' : 'Marked present',
                      style: T.small,
                    ),
                  ]),
                ),
                SizedBox(width: 8.w),
                if (today == null)
                  AppButton('Check in', expand: false, small: true, busy: busy, onPressed: () => context.read<PunchBloc>().add(const PunchIn()))
                else if (!today.punchedOut)
                  AppButton('Check out', expand: false, small: true, kind: BtnKind.outline, busy: busy, onPressed: () => context.read<PunchBloc>().add(const PunchOut()))
                else
                  Icon(Icons.chevron_right_rounded, color: C.muted),
              ]),
            );
          },
        ),
      ),
    ),
  );
}

class _PartnerCard extends StatelessWidget {
  const _PartnerCard({required this.partner});
  final CrewMember partner;
  @override
  Widget build(BuildContext context) => AppSurfaceCard(
    child: Row(children: [
      Avatar(partner.name, size: 44, tone: partner.isDriver ? Tone.brand : Tone.purple),
      SizedBox(width: 12.w),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(partner.name, style: T.bodyStrong),
          Text('${partner.role.title} · #${partner.empId}', style: T.small),
        ]),
      ),
      Pill(partner.status, tone: partner.status == 'Active' ? Tone.success : Tone.warning),
      SizedBox(width: 8.w),
      CallButton(phone: partner.phone, name: partner.name),
    ]),
  );
}

/// Two tiles per row; each row is as tall as its tallest tile.
class _ActionGrid extends StatelessWidget {
  const _ActionGrid({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Column(children: [
    for (var i = 0; i < children.length; i += 2)
      Padding(
        padding: EdgeInsets.only(bottom: 10.h),
        child: IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Expanded(child: children[i]),
            SizedBox(width: 10.w),
            Expanded(child: i + 1 < children.length ? children[i + 1] : const SizedBox()),
          ]),
        ),
      ),
  ]);
}
