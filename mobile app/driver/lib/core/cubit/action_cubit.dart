import 'view_cubit.dart';
import '../models/view_model.dart';

abstract class ActionCubit extends ViewCubit {
  ActionCubit(super.repository);
  Future<void> act(String action, String nodeId) async {
    if (action == 'back') {
      emit(state.copy(effect: const CloseView()));
      return;
    }
    if (action.startsWith('route:')) {
      navigate(action.substring(6));
      return;
    }
    final label = action.replaceFirst('tap:', '');
    await handle(label, nodeId);
  }

  Future<void> handle(String label, String nodeId) async {
    final lower = label.toLowerCase();
    if (RegExp(r'cancel|discard|keep current|go back').hasMatch(lower)) {
      emit(state.copy(effect: const CloseView()));
      return;
    }
    if (RegExp(
      r'submit|save|confirm|approve|authorize|complete|send',
    ).hasMatch(lower)) {
      await save();
      return;
    }
    if (RegExp(
      r'download|export|offline pdf|share|certificate',
    ).hasMatch(lower)) {
      notify('Demo preview ready. Live document export is not connected.');
      return;
    }
    if (RegExp(
      r'call|sos|dispatch alert|camera|upload|scan|nfc|rescan|voice|notify desk',
    ).hasMatch(lower)) {
      notify('Demo: $label. No external call, alert, or upload was made.');
      return;
    }
    select(nodeId);
  }
}
