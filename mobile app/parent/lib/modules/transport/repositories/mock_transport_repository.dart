import 'dart:async';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/transport_models.dart';
import 'transport_demo_data.dart';
import 'transport_repository_interface.dart';

/// In-memory bus feed. Each [pollPosition] (Track Live polls on a timer) advances the single, shared
/// bus along its stops, which updates ETA, next stop and position for every watcher. Alerts are per child.
class MockTransportRepository implements ITransportRepository {
  MockTransportRepository(this._cache, {DateTime Function()? clock})
    : _departedAt = (clock ?? DateTime.now)().subtract(
        Duration(minutes: TransportDemoData.startElapsedMinutes.round()),
      );

  /// Simulated minutes the bus moves per GPS poll.
  static double minutesPerTick = .5;

  final CacheService _cache;
  final DateTime _departedAt;
  double _elapsed = TransportDemoData.startElapsedMinutes;
  final Map<String, Map<BusAlert, bool>> _alerts = {};
  final _changes = StreamController<void>.broadcast();

  double get elapsedMinutes => _elapsed;

  /// Moves the bus forward (each poll; tests may call it directly).
  void advance([double? minutes]) {
    final end = TransportDemoData.stops.last.offsetMinutes.toDouble();
    if (_elapsed >= end) return;
    _elapsed = (_elapsed + (minutes ?? minutesPerTick)).clamp(0, end);
    _changes.add(null);
  }

  BusTrip _build(String childId) => BusTrip(
    childId: childId,
    busNo: TransportDemoData.busNo,
    route: TransportDemoData.route,
    vehicleNo: TransportDemoData.vehicleNo,
    safety: TransportDemoData.safety,
    driver: TransportDemoData.driver,
    attendant: TransportDemoData.attendant,
    departedAt: _departedAt,
    elapsedMinutes: _elapsed,
    stops: TransportDemoData.stops,
    seat: TransportDemoData.seatOf(childId),
    boardedAt: _departedAt.subtract(const Duration(minutes: 3)),
    alerts: Map.unmodifiable({
      ...TransportDemoData.defaultAlerts,
      ...?_alerts[childId],
    }),
  );

  @override
  Stream<BusTrip> watchTrip(String childId) => cacheFirst(
    cache: _cache,
    key: 'transport:$childId',
    fetch: () async {
      await MockLatency.wait();
      return _build(childId);
    },
    refetch: () async => _build(childId),
    refreshOn: _changes.stream,
  );

  @override
  Future<void> setAlert(String childId, BusAlert alert, bool enabled) async {
    (_alerts[childId] ??= {})[alert] = enabled;
    _changes.add(null);
  }

  @override
  Future<void> pollPosition(String childId) async => advance();

  @override
  Future<GateEntry?> gateEntryOn(String childId, DateTime day) async =>
      TransportDemoData.gateEntry(childId, day);
}
