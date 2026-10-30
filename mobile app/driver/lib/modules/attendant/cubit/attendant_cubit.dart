import '../../../core/cubit/action_cubit.dart';
import '../../../core/models/view_model.dart';
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
      if (!state.selected.containsAll({
        '1174_3138',
        '1174_3150',
        '1174_3162',
      })) {
        notify('Check all cabin zones before completing the sweep.');
        return;
      }
      if (!await save()) return;
      navigate('4193');
      return;
    }
    if (lower.contains('submit') && hasMissingRequiredFields) {
      notify('Complete the required report details.');
      return;
    }
    if (state.screen?.id == '4589' && lower.startsWith('submit')) {
      if (await save()) emit(state.copy(effect: const CloseView()));
      return;
    }
    await super.handle(label, nodeId);
  }
}
