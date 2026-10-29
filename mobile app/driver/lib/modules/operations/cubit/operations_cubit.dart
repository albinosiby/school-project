import '../../../core/cubit/action_cubit.dart';
import '../repositories/operations_view_repository.dart';

class OperationsCubit extends ActionCubit {
  OperationsCubit(OperationsViewRepository super.repository);
  @override
  Future<void> handle(String label, String nodeId) async {
    final lower = label.toLowerCase();
    if (RegExp(r'submit|save|confirm standby|report found').hasMatch(lower)) {
      if (state.values.values.any((v) => v.trim().isEmpty)) {
        notify('Complete the required details before submitting.');
        return;
      }
      await save();
      if (state.screen?.id == '8132') navigate('8483');
      if (state.screen?.id == '11926') navigate('11153');
      return;
    }
    await super.handle(label, nodeId);
  }
}
