import 'package:get_it/get_it.dart';
import '../../utils/services/cache_service.dart';
import '../../modules/messages/bloc/chat_bloc.dart';
import '../../modules/messages/bloc/messages_bloc.dart';
import '../../modules/messages/bloc/new_message_bloc.dart';
import '../../modules/messages/repositories/message_repository_interface.dart';
import '../../modules/messages/repositories/mock_message_repository.dart';

/// Registers the messages module's repository (interface -> implementation) and BLoCs.
/// Backend switch: choose the implementation with AppConfig here (mock today).
void registerMessagesModule(GetIt getIt) {
  getIt.registerLazySingleton<IMessageRepository>(
    () => MockMessageRepository(getIt<CacheService>()),
  );
  getIt.registerFactory<MessagesBloc>(() => MessagesBloc(getIt()));
  getIt.registerFactory<UnreadCountBloc>(() => UnreadCountBloc(getIt()));
  getIt.registerFactory<ChatBloc>(() => ChatBloc(getIt()));
  getIt.registerFactory<NewMessageBloc>(() => NewMessageBloc(getIt()));
}
