import '../models/message_models.dart';

abstract class IMessageRepository {
  Stream<List<MessageThread>> watchThreads(String childId);
  Stream<List<ChatMessage>> watchMessages(String threadId);
  Future<void> send(String threadId, String text);
}
