import 'package:go_router/go_router.dart';
import '../../../modules/messages/screens/chat_screen.dart';
import '../../../modules/messages/screens/new_message_screen.dart';
import '../routes.dart';

/// Pushed routes of the messages module (the Messages tab root is in routes_config.dart).
/// Fixed paths before ":id" paths.
final List<RouteBase> messagesRoutes = [
  GoRoute(
    path: RoutePaths.newMessage,
    builder: (_, s) => NewMessageScreen(
      contactId: s.uri.queryParameters['to'],
      draftId: s.uri.queryParameters['draft'],
    ),
  ),
  GoRoute(
    path: RoutePaths.chat,
    builder: (_, s) => ChatScreen(
      threadId: s.pathParameters['id']!,
      teacher: s.uri.queryParameters['teacher'],
      role: s.uri.queryParameters['role'],
    ),
  ),
];
