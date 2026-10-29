import '../../../core/cubit/action_cubit.dart';
import '../repositories/transport_view_repository.dart';
import '../repositories/trip_repository.dart';

class TransportCubit extends ActionCubit {
  TransportCubit(TransportViewRepository super.repository, this.trips);
  final TripRepository trips;
  @override
  Future<void> act(String action, String nodeId) async {
    if (action == 'route:6416') {
      try {
        trips.start();
        navigate('6416');
      } on StateError catch (e) {
        notify(e.message);
        navigate('9783');
      }
      return;
    }
    await super.act(action, nodeId);
  }

  @override
  Future<void> handle(String label, String nodeId) async {
    final lower = label.toLowerCase();
    try {
      if (lower.trim() == 'pass') {
        trips.check(nodeId);
        select(nodeId);
        return;
      }
      if (lower == 'submit' && state.screen?.id == '9783') {
        if (trips.current.checked.length < 2) {
          notify('Complete both manual safety checks before submitting.');
          return;
        }
        notify('Pre-trip checks saved. The morning trip is ready.');
        navigate('5638');
        return;
      }
      if (lower == 'boarded') {
        trips.board(nodeId);
        select(nodeId);
        notify('Student boarding recorded.');
        return;
      }
      if (lower.contains('complete') ||
          lower.contains('end trip') ||
          lower.contains('submit') && state.screen?.id == '14244') {
        trips.finish();
        notify('Trip completed and saved in this demo session.');
        navigate('10392');
        return;
      }
      await super.handle(label, nodeId);
    } on StateError catch (e) {
      notify(e.message);
    }
  }
}
