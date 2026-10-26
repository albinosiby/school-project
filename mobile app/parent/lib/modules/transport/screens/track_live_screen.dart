import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../family/models/family_models.dart';
import '../../home/screens/widgets/parent_page_scaffold.dart';
import '../bloc/track_live_bloc.dart';
import '../models/transport_models.dart';
import 'widgets/bus_map.dart';
import 'widgets/contact_tile.dart';
import 'widgets/stop_timeline.dart';

/// Figma "1.1 Track Live": simulated live map, ETA, child on board, route milestones, driver and
/// attendant contacts, notify-me toggles. The position updates as the repository feed advances.
class TrackLiveScreen extends StatelessWidget {
  const TrackLiveScreen({super.key});

  @override
  Widget build(BuildContext context) => ParentPageScaffold(
    title: 'Track Live',
    body: ChildDataView<TrackLiveBloc, BusTrip>(
      create: () => getIt<TrackLiveBloc>(),
      refreshable: false,
      builder: (context, trip, child) => _TrackBody(trip: trip, child: child),
    ),
  );
}

class _TrackBody extends StatefulWidget {
  const _TrackBody({required this.trip, required this.child});
  final BusTrip trip;
  final Child child;

  @override
  State<_TrackBody> createState() => _TrackBodyState();
}

class _TrackBodyState extends State<_TrackBody> {
  bool _satellite = false;

  @override
  Widget build(BuildContext context) {
    final trip = widget.trip;
    final child = widget.child;
    final phase = trip.phase;
    return ListView(
      padding: EdgeInsets.only(bottom: 24.h),
      children: [
        SizedBox(
          height: 330.h,
          child: BusMap(
            trip: trip,
            satellite: _satellite,
            onRecenter: () => AppDialogs.showSnackBar(
              context,
              message: 'Centred on Bus #${trip.busNo}',
            ),
            onLayers: () {
              setState(() => _satellite = !_satellite);
              AppDialogs.showSnackBar(
                context,
                message: _satellite ? 'Satellite view' : 'Street view',
              );
            },
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _EtaCard(trip: trip),
              SizedBox(height: 12.h),
              AppElevatedCard(
                padding: EdgeInsets.all(14.w),
                child: Row(
                  children: [
                    Avatar(child.name, size: 44),
                    SizedBox(width: 12.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text.rich(
                            TextSpan(
                              text: child.name,
                              style: T.bodyStrong.copyWith(color: C.onSurface),
                              children: [
                                TextSpan(
                                  text: '  ${child.className}',
                                  style: T.small,
                                ),
                              ],
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            'Seat ${trip.seat} • Tap ${fmtClock(trip.boardedAt)}',
                            style: T.small.copyWith(color: C.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    phase == TripPhase.inTransit
                        ? const Pill(
                            'Onboard Safe',
                            tone: Tone.success,
                            icon: Icons.sensors_rounded,
                          )
                        : const Pill(
                            'Dropped Safely',
                            tone: Tone.success,
                            icon: Icons.check_circle_outline_rounded,
                          ),
                  ],
                ),
              ),
              SizedBox(height: 12.h),
              AppElevatedCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Route Milestones',
                            style: T.h2.copyWith(color: C.onSurface),
                          ),
                        ),
                        Text(
                          '${trip.stops.length} Key Stops',
                          style: T.small.copyWith(color: C.onSurfaceVariant),
                        ),
                      ],
                    ),
                    SizedBox(height: 14.h),
                    StopTimeline(trip: trip),
                  ],
                ),
              ),
              SizedBox(height: 12.h),
              AppElevatedCard(
                padding: EdgeInsets.all(14.w),
                child: Column(
                  children: [
                    ContactTile(
                      contact: trip.driver,
                      detail: '${trip.vehicleNo} • ${trip.safety}',
                      onCall: () => confirmCall(context, trip.driver),
                    ),
                    Divider(height: 24.h, color: C.cardBorder),
                    ContactTile(
                      contact: trip.attendant,
                      detail: '${trip.attendant.role} • On board',
                      onCall: () => confirmCall(context, trip.attendant),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 12.h),
              Text('NOTIFY ME', style: T.capsMuted),
              SizedBox(height: 8.h),
              for (final a in BusAlert.values)
                AppToggleRow(
                  key: ValueKey('bus-alert-${a.name}'),
                  title: a.title,
                  subtitle: a.subtitle,
                  value: trip.alertOn(a),
                  margin: EdgeInsets.only(bottom: 8.h),
                  onChanged: (v) {
                    context.read<TrackLiveBloc>().add(ToggleBusAlert(a, v));
                    AppDialogs.showSnackBar(
                      context,
                      message: '${a.title} ${v ? 'on' : 'off'}',
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

class _EtaCard extends StatelessWidget {
  const _EtaCard({required this.trip});
  final BusTrip trip;

  @override
  Widget build(BuildContext context) {
    final phase = trip.phase;
    final drop = trip.dropStop;
    final inTransit = phase == TripPhase.inTransit;
    return AppElevatedCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Pill(
                inTransit
                    ? 'On Time • Route ${trip.route}'
                    : 'Arrived • Route ${trip.route}',
                tone: Tone.brand,
                dot: true,
              ),
              const Spacer(),
              Text(
                'Bus #${trip.busNo}',
                style: T.small.copyWith(color: C.onSurfaceVariant),
              ),
            ],
          ),
          SizedBox(height: 12.h),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      key: const Key('track-eta'),
                      TextSpan(
                        text: inTransit
                            ? '${trip.minutesToDrop} min${trip.minutesToDrop == 1 ? '' : 's'}'
                            : 'Dropped off',
                        style: T.title.copyWith(
                          color: C.primary,
                          fontSize: 30.sp,
                        ),
                        children: [
                          if (inTransit)
                            TextSpan(
                              text: '  away',
                              style: T.body.copyWith(color: C.onSurfaceVariant),
                            ),
                        ],
                      ),
                    ),
                    SizedBox(height: 4.h),
                    Text(
                      inTransit
                          ? 'Drop-off at ${fmtClock(trip.dropEta)} • ${drop.name}'
                          : 'Reached ${drop.name} at ${fmtClock(trip.dropEta)}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: T.small.copyWith(color: C.onSurface),
                    ),
                  ],
                ),
              ),
              SizedBox(width: 12.w),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${trip.kmToDrop.toStringAsFixed(1)} km',
                    style: T.h2.copyWith(color: C.onSurface),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.traffic_outlined,
                        size: 13.r,
                        color: C.emerald,
                      ),
                      SizedBox(width: 3.w),
                      Text(
                        inTransit ? trip.traffic : 'Trip on schedule',
                        style: T.small.copyWith(color: C.emerald),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
