import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../../../utils/services/local_storage_service.dart';
import '../models/transport_models.dart';
import 'transport_repository_interface.dart';

/// The child's school bus from `par_transport/{studentId}` (data contract §14.9), a projection the Cloud Functions keep
/// from `students`, `tr_buses`, `tr_crew`, `tr_trips` and `tr_attendance`. Parents never read `tr_*`.
///
/// There is no GPS feed: the bus position is estimated from the stop schedule and today's trip status
/// ([BusTrip.scheduleBased]). Track Live's poll re-computes it against the clock. A child without a doc is not on a
/// school bus ([BusTrip.notOnBus]). The "notify me" toggles have no backend field, so they are kept on this device.
/// Reads are cache-first through Firestore's offline cache (cached snapshot first, then the server one).
class FirebaseTransportRepository implements ITransportRepository {
  FirebaseTransportRepository(this._session, this._storage, {DateTime Function()? clock})
      : _clock = clock ?? DateTime.now;
  final ParentSession _session;
  final LocalStorageService _storage;
  final DateTime Function() _clock;
  final _ticks = StreamController<String>.broadcast();

  /// India time: `today.date` and the stop times are IST wall-clock values (§14.9).
  static const ist = Duration(hours: 5, minutes: 30);

  String _alertKey(String childId) => 'bus_alerts:${_session.uid}:$childId';

  Map<BusAlert, bool> alertsOf(String childId) {
    final out = {...defaultBusAlerts};
    try {
      final raw = _storage.getString(_alertKey(childId));
      if (raw != null) {
        (jsonDecode(raw) as Map).forEach((k, v) {
          final a = BusAlert.values.asNameMap()['$k'];
          if (a != null && v is bool) out[a] = v;
        });
      }
    } catch (_) {
      // unreadable preference: defaults
    }
    return Map.unmodifiable(out);
  }

  @override
  Stream<BusTrip> watchTrip(String childId) {
    late final StreamController<BusTrip> out;
    final subs = <StreamSubscription<Object?>>[];
    DocumentSnapshot<Json>? last;
    void emit() {
      final s = last;
      if (s == null || out.isClosed) return;
      final d = s.data();
      out.add(d == null ? BusTrip.notOnBus(childId) : fromDoc(childId, d, now: _clock(), alerts: alertsOf(childId)));
    }

    out = StreamController<BusTrip>(
      onListen: () => subs
        ..add(_session.whenReady(() => _session.col('par_transport').doc(childId).snapshots()).listen((s) {
          last = s;
          emit();
        }, onError: out.addError))
        ..add(_ticks.stream.where((id) => id == childId).listen((_) => emit())),
      onCancel: () async {
        for (final s in subs) {
          await s.cancel();
        }
      },
    );
    return out.stream;
  }

  /// No GPS: moves the schedule-based position to "now".
  @override
  Future<void> pollPosition(String childId) async => _ticks.add(childId);

  @override
  Future<void> setAlert(String childId, BusAlert alert, bool enabled) async {
    final next = {...alertsOf(childId), alert: enabled};
    await _storage.setString(_alertKey(childId), jsonEncode({for (final e in next.entries) e.key.name: e.value}));
    _ticks.add(childId);
  }

  /// No gate scanner is connected to the school system.
  @override
  Future<GateEntry?> gateEntryOn(String childId, DateTime day) async => null;

  // ---------------------------------------------------------------- mapping

  static TripStatus? statusOf(Object? v) => switch ('${v ?? ''}') {
        'scheduled' => TripStatus.scheduled,
        'active' => TripStatus.active,
        'completed' => TripStatus.completed,
        _ => null,
      };

  static BusMark? markOf(Object? v) => switch ('${v ?? ''}') {
        'boarded' => BusMark.boarded,
        'absent' => BusMark.absent,
        'dropped' => BusMark.dropped,
        _ => null,
      };

  /// `"06:58"` -> minutes since midnight.
  static int? minuteOf(Object? hhmm) {
    final m = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch('${hhmm ?? ''}'.trim());
    if (m == null) return null;
    final h = int.parse(m[1]!), min = int.parse(m[2]!);
    return h > 23 || min > 59 ? null : h * 60 + min;
  }

  /// "Bus 14" -> "14", "Route 4B" -> "4B" (the screens add "Bus #" / "Route").
  static String stripPrefix(String v, String word) =>
      v.trim().replaceFirst(RegExp('^$word\\s*#?\\s*', caseSensitive: false), '');

  /// The trip the parent sees (contract §14.9): today's active trip, else the next one (pickup before noon IST,
  /// drop after; once the pickup trip is over the drop trip is next).
  static TripKind kindFor(TripStatus? pickup, TripStatus? drop, DateTime istNow) {
    if (pickup == TripStatus.active) return TripKind.pickup;
    if (drop == TripStatus.active) return TripKind.drop;
    if (istNow.hour < 12 && pickup != TripStatus.completed) return TripKind.pickup;
    return TripKind.drop;
  }

  /// `par_transport/{studentId}` -> [BusTrip] at [now].
  static BusTrip fromDoc(String childId, Json d, {required DateTime now, Map<BusAlert, bool> alerts = defaultBusAlerts}) {
    final istNow = now.toUtc().add(ist);
    final today = d['today'] is Map ? Map<String, dynamic>.from(d['today'] as Map) : const <String, dynamic>{};
    final isToday = '${today['date'] ?? ''}' == isoDay(istNow);
    Json trip(String k) => isToday && today[k] is Map ? Map<String, dynamic>.from(today[k] as Map) : const <String, dynamic>{};
    final pickup = trip('pickup'), drop = trip('drop');
    final kind = kindFor(statusOf(pickup['status']), statusOf(drop['status']), istNow);
    final cur = kind == TripKind.pickup ? pickup : drop;
    final status = statusOf(cur['status']) ?? TripStatus.scheduled;
    final timeKey = kind == TripKind.pickup ? 'pickupTime' : 'dropTime';

    var raw = [
      for (final s in (d['stops'] as List?) ?? const [])
        if (s is Map) Map<String, dynamic>.from(s),
    ];
    final stopId = '${d['stopId'] ?? ''}', stopName = '${d['stop'] ?? ''}';
    // a bus without a stop list still has the child's own stop
    if (raw.isEmpty && (stopId.isNotEmpty || stopName.isNotEmpty)) {
      raw = [
        {'id': stopId, 'name': stopName, 'pickupTime': d['pickupTime'], 'dropTime': d['dropTime']},
      ];
    }
    if (raw.isEmpty) return BusTrip.notOnBus(childId);

    var childIdx = stopId.isEmpty ? -1 : raw.indexWhere((s) => '${s['id'] ?? ''}' == stopId);
    if (childIdx < 0 && stopName.isNotEmpty) childIdx = raw.indexWhere((s) => '${s['name'] ?? ''}' == stopName);

    // offsets from the first stop of this trip, in the doc's order
    final times = [for (final s in raw) minuteOf(s[timeKey])];
    final base = times.whereType<int>().firstOrNull;
    var prev = 0;
    final stops = <BusStop>[];
    for (var i = 0; i < raw.length; i++) {
      final t = times[i];
      final offset = t == null || base == null ? prev : math.max(0, t - base);
      prev = offset;
      final f = raw.length == 1 ? .5 : i / (raw.length - 1);
      stops.add(BusStop(
        id: '${raw[i]['id'] ?? 'stop_$i'}',
        name: '${raw[i]['name'] ?? ''}',
        offsetMinutes: offset,
        km: 0,
        // schematic map: the stops laid out corner to corner in route order
        mapX: .12 + .76 * f,
        mapY: (.2 + .6 * f + (i.isOdd ? .07 : -.07)).clamp(.08, .92).toDouble(),
        isChildDrop: i == childIdx,
      ));
    }

    final startIst = base ?? (istNow.hour * 60 + istNow.minute);
    final scheduledStart =
        DateTime.utc(istNow.year, istNow.month, istNow.day, startIst ~/ 60, startIst % 60).subtract(ist).toLocal();
    final startedAt = parseTime(cur['startedAt']);
    final departedAt = status == TripStatus.scheduled ? scheduledStart : (startedAt ?? scheduledStart);
    final elapsed = switch (status) {
      TripStatus.scheduled => 0.0,
      TripStatus.active => math.max(0, now.difference(departedAt).inSeconds / 60).toDouble(),
      TripStatus.completed => stops.last.offsetMinutes + 1.0,
    };
    final mark = markOf(cur['mark']);
    final markAt = parseTime(cur['markAt']);

    BusContact contact(Object? v, String role) {
      final c = v is Map ? v : const {};
      final name = '${c['name'] ?? ''}'.trim();
      return BusContact(name: name.isEmpty ? '$role not assigned' : name, role: role, phone: '${c['phone'] ?? ''}'.trim());
    }

    final bus = stripPrefix('${d['bus'] ?? ''}', 'bus');
    return BusTrip(
      childId: childId,
      busNo: bus.isEmpty ? '${d['busId'] ?? ''}' : bus,
      route: stripPrefix('${d['routeName'] ?? ''}', 'route'),
      vehicleNo: '${d['regNo'] ?? ''}'.trim(),
      safety: '${d['model'] ?? ''}'.trim(),
      driver: contact(d['driver'], 'Driver'),
      attendant: contact(d['attendant'], 'Bus attendant'),
      departedAt: departedAt,
      elapsedMinutes: elapsed,
      stops: stops,
      seat: '${d['seat'] ?? ''}'.trim(),
      boardedAt: mark == BusMark.boarded ? markAt : null,
      alerts: alerts,
      kind: kind,
      status: status,
      mark: mark,
      markAt: markAt,
      scheduleBased: true,
    );
  }
}
