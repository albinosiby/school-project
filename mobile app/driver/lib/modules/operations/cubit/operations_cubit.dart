import '../../../core/cubit/action_cubit.dart';
import '../../../core/models/view_model.dart';
import '../repositories/operations_view_repository.dart';

class OperationsCubit extends ActionCubit {
  OperationsCubit(OperationsViewRepository super.repository);
  @override
  void update(String id, String value) {
    super.update(id, value);
    if (state.screen?.id == '12538' &&
        ['1174_12692', '1174_12717'].contains(id)) {
      final quantity =
          double.tryParse(
            (state.values['1174_12692'] ?? '').replaceAll(',', ''),
          ) ??
          0;
      final rate =
          double.tryParse(
            (state.values['1174_12717'] ?? '').replaceAll(',', ''),
          ) ??
          0;
      super.update('1174_12729', (quantity * rate).toStringAsFixed(2));
    }
  }

  @override
  Future<void> handle(String label, String nodeId) async {
    final lower = label.toLowerCase();
    if (state.screen?.id == '12538' &&
        (lower == '+5 l' || lower == '-5 l' || lower.startsWith('full tank'))) {
      final current =
          double.tryParse(
            (state.values['1174_12692'] ?? '0').replaceAll(',', ''),
          ) ??
          0;
      final next = lower.startsWith('full tank')
          ? 41.6
          : (current + (lower.startsWith('+') ? 5 : -5))
                .clamp(0, 10000)
                .toDouble();
      update('1174_12692', next.toStringAsFixed(1));
      final rate =
          double.tryParse(
            (state.values['1174_12717'] ?? '0').replaceAll(',', ''),
          ) ??
          0;
      update('1174_12729', (next * rate).toStringAsFixed(2));
      return;
    }
    if (state.screen?.id == '12538' && lower.startsWith('submit')) {
      double? number(String id) =>
          double.tryParse((state.values[id] ?? '').replaceAll(',', ''));
      if ((number('1174_12692') ?? 0) <= 0 ||
          (number('1174_12717') ?? 0) <= 0 ||
          number('1174_12756') == null) {
        notify('Enter a valid fuel quantity, rate and odometer.');
        return;
      }
    }
    if (RegExp(r'submit|save|confirm standby|report found').hasMatch(lower)) {
      if (hasMissingRequiredFields) {
        notify('Complete the required details before submitting.');
        return;
      }
      if (!await save()) return;
      if (state.screen?.id == '8359') {
        emit(state.copy(effect: const CloseView()));
        return;
      }
      if (state.screen?.id == '8132') navigate('8483');
      if (state.screen?.id == '11926') navigate('11153');
      return;
    }
    await super.handle(label, nodeId);
  }
}
