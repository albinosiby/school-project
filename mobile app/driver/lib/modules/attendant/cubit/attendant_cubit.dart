import '../../../core/cubit/action_cubit.dart';
import '../../transport/repositories/trip_repository.dart';
import '../repositories/attendant_view_repository.dart';

class AttendantCubit extends ActionCubit {
  AttendantCubit(AttendantViewRepository super.repository, this.trips);
  final TripRepository trips;
  @override
  Future<void> handle(String label, String nodeId) async {
    final lower = label.toLowerCase();
    if (lower.contains('verify otp')) {
      try {
        trips.handover(
          nodeId,
          state.values.values
                  .where((v) => RegExp(r'^\d{4}$').hasMatch(v))
                  .firstOrNull ??
              '',
        );
        select(nodeId);
        notify('Demo guardian handover verified.');
      } on StateError catch (e) {
        notify(e.message);
      }
      return;
    }
    if (lower.contains('no-show')) {
      select(nodeId);
      notify('Student retained onboard. Guardian handover remains pending.');
      return;
    }
    if (lower.contains('complete sweep')) {
      if (state.selected.length < 3) {
        notify('Check all cabin zones before completing the sweep.');
        return;
      }
      await save();
      navigate('4193');
      return;
    }
    if (lower.contains('submit') &&
        state.values.values.any((v) => v.trim().isEmpty)) {
      notify('Complete the required report details.');
      return;
    }
    await super.handle(label, nodeId);
  }
}
