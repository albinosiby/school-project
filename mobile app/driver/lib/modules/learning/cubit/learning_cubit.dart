import '../../../core/cubit/action_cubit.dart';
import '../repositories/learning_view_repository.dart';

class LearningCubit extends ActionCubit {
  LearningCubit(LearningViewRepository super.repository);
  @override
  Future<void> handle(String label, String nodeId) async {
    if (label.toLowerCase().contains('locked')) {
      notify('Complete the preceding lessons to unlock this assessment.');
      return;
    }
    if (label.toLowerCase().contains('play') ||
        label.toLowerCase().contains('resume')) {
      select(nodeId);
      notify(
        'Demo lesson selected. Training video streaming is not connected.',
      );
      return;
    }
    await super.handle(label, nodeId);
  }
}
