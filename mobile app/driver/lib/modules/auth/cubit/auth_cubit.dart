import '../../../core/cubit/action_cubit.dart';
import '../models/auth_models.dart';
import '../repositories/auth_view_repository.dart';
import 'session_cubit.dart';

class AuthCubit extends ActionCubit {
  AuthCubit(AuthViewRepository super.repository, this.session);
  final SessionCubit session;
  @override
  Future<void> handle(String label, String nodeId) async {
    final lower = label.toLowerCase();
    try {
      if (lower.contains('verify')) {
        final code = state.values.values
            .where((v) => RegExp(r'^\d$').hasMatch(v))
            .join();
        await session.verify(code);
        navigate('15003');
        return;
      }
      if (lower == 'sign in') {
        final phone =
            state.values.values
                .where((v) => v.replaceAll(RegExp(r'\D'), '').length >= 10)
                .firstOrNull ??
            '';
        await session.requestCode(phone);
        navigate('7759');
        return;
      }
      if (lower.contains('resend') || lower.contains('voice call')) {
        await session.requestCode(session.state.phone);
        notify('Demo code: 482916. No SMS was sent.');
        return;
      }
      if (lower == 'sign up') {
        await save();
        notify('Demo registration saved for review. Sign in to continue.');
        return;
      }
      if (lower == 'edit') {
        navigate('7629');
        return;
      }
      await super.handle(label, nodeId);
    } on AuthFailure catch (e) {
      notify(e.message);
    }
  }
}
