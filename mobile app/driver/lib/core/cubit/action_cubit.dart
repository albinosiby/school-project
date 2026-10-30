import 'view_cubit.dart';
import '../models/view_model.dart';

abstract class ActionCubit extends ViewCubit {
  ActionCubit(super.repository);
  Future<void> act(String action, String nodeId) async {
    ViewNode? findNode(ViewNode node) {
      if (node.id == nodeId) return node;
      for (final child in node.children) {
        final found = findNode(child);
        if (found != null) return found;
      }
      return null;
    }

    if (action == 'choose' ||
        state.screen != null &&
            findNode(state.screen!.root)?.interaction == 'choice') {
      Iterable<String> choices(ViewNode node) sync* {
        if (node.interaction == 'choice' && node.action != null) yield node.id;
        for (final child in node.children) {
          yield* choices(child);
        }
      }

      final selected = {...state.selected}
        ..removeAll(choices(state.screen!.root))
        ..add(nodeId);
      emit(state.copy(selected: Set.unmodifiable(selected)));
      return;
    }
    if (action == 'toggle' ||
        state.screen != null &&
            findNode(state.screen!.root)?.interaction == 'toggle') {
      select(nodeId);
      return;
    }
    if (action == 'profile' || action == 'notifications') {
      navigate('@$action');
      return;
    }
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
    if (RegExp(
      r'cancel|discard|keep current|go back|^close$',
    ).hasMatch(lower)) {
      emit(state.copy(effect: const CloseView()));
      return;
    }
    if (RegExp(
      r'download|export|offline pdf|share|certificate|\.pdf|^pdf$',
    ).hasMatch(lower)) {
      notify('Demo preview ready. Live document export is not connected.');
      return;
    }
    if (RegExp(
      r'call|sos|dispatch alert|camera|upload|scan|nfc|rfid|rescan|voice|notify|ping|intercom|radio|control desk|transport desk|\+91',
    ).hasMatch(lower)) {
      notify('Demo: $label. No external call, alert, or upload was made.');
      return;
    }
    if (RegExp(
      r'submit|save|confirm|approve|authorize|complete|send',
    ).hasMatch(lower)) {
      await save();
      return;
    }
    select(nodeId);
  }
}
