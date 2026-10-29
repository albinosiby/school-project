import '../../../core/cubit/action_cubit.dart';
import '../../auth/cubit/session_cubit.dart';
import '../repositories/account_view_repository.dart';

class AccountCubit extends ActionCubit {
  AccountCubit(
    AccountViewRepository super.repository,
    this.session,
    this.clearSessionData,
  );
  final SessionCubit session;
  final void Function() clearSessionData;
  @override
  Future<void> handle(String label, String nodeId) async {
    if (RegExp(
      r'log out|logout|sign out',
      caseSensitive: false,
    ).hasMatch(label)) {
      await session.signOut();
      clearSessionData();
      navigate('7566');
      return;
    }
    if (label.toLowerCase().contains('mark all read')) {
      select(nodeId);
      notify('All notifications marked as read.');
      return;
    }
    await super.handle(label, nodeId);
  }
}
