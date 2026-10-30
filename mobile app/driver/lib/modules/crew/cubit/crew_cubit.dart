import '../../../core/cubit/action_cubit.dart';
import '../../auth/models/auth_models.dart';
import '../../auth/cubit/session_cubit.dart';
import '../repositories/crew_view_repository.dart';

class CrewCubit extends ActionCubit {
  CrewCubit(CrewViewRepository super.repository, this.session);
  final SessionCubit session;
  @override
  Future<void> handle(String label, String nodeId) async {
    final text = label.toLowerCase();
    try {
      if (text.contains('lead driver')) {
        await session.chooseRole(CrewRole.driver);
        navigate('15282');
        return;
      }
      if (text.contains('bus attendant')) {
        await session.chooseRole(CrewRole.assistant);
        navigate('15003');
        return;
      }
      if (state.screen?.id == '15553' && text.contains('authorize handshake')) {
        final pin = state.values.values
            .where((v) => RegExp(r'^\d$').hasMatch(v))
            .join();
        if (pin != '842910') {
          notify(
            'Use demo pairing PIN 842910. No hardware handshake is performed.',
          );
          return;
        }
      }
      if (text.contains('confirm pairing') ||
          text.contains('authorize handshake')) {
        final role = text.contains('driver')
            ? CrewRole.driver
            : text.contains('attendant')
            ? CrewRole.assistant
            : session.state.role;
        await session.chooseRole(role);
        navigate(role == CrewRole.driver ? '5271' : '4');
        return;
      }
      if (text.contains('regenerate')) {
        notify('Demo pairing PIN refreshed: 842910.');
        return;
      }
      await super.handle(label, nodeId);
    } on AuthFailure catch (e) {
      notify(e.message);
    }
  }
}
