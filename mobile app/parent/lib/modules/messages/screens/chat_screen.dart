import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/chat_bloc.dart';
import '../models/message_models.dart';

/// Chat with one teacher.
class ChatScreen extends StatelessWidget {
  const ChatScreen({
    super.key,
    required this.threadId,
    this.teacher,
    this.role,
  });
  final String threadId;
  final String? teacher, role;

  @override
  Widget build(BuildContext context) => BlocProvider<ChatBloc>(
    create: (_) => getIt<ChatBloc>()..add(OpenChat(threadId)),
    child: Scaffold(
      appBar: DetailHeader(
        teacher ?? 'Conversation',
        subtitle: role,
        fallbackRoute: '${RoutePaths.inbox}?section=messages',
      ),
      body: Column(
        children: [
          Expanded(
            child: BlocBuilder<ChatBloc, ChatState>(
              builder: (context, state) {
                if (state.status == LoadStatus.error)
                  return AppErrorWidget(
                    message: state.error ?? 'Could not load messages.',
                    onRetry: () =>
                        context.read<ChatBloc>().add(OpenChat(threadId)),
                  );
                if (state.status == LoadStatus.loading)
                  return const AppLoading(rows: 3);
                if (state.messages.isEmpty)
                  return Center(
                    child: AppEmptyState(
                      'Say hello',
                      hint: 'Send your first message to the teacher.',
                      icon: Icons.waving_hand_outlined,
                    ),
                  );
                final msgs = state.messages.reversed.toList();
                return ListView.builder(
                  reverse: true,
                  padding: EdgeInsets.all(S.page),
                  itemCount: msgs.length,
                  itemBuilder: (_, i) => _Bubble(message: msgs[i]),
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: EdgeInsets.fromLTRB(16.w, 10.h, 16.w, 12.h),
              decoration: const BoxDecoration(
                color: C.bg,
                border: Border(top: BorderSide(color: C.border)),
              ),
              child: const _Composer(),
            ),
          ),
        ],
      ),
    ),
  );
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});
  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final mine = message.fromParent;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: 290.w),
        margin: EdgeInsets.only(bottom: 10.h),
        padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 10.h),
        decoration: BoxDecoration(
          color: mine ? C.primary : C.surface,
          border: mine ? null : Border.all(color: C.border),
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(R.lg),
            topRight: Radius.circular(R.lg),
            bottomLeft: Radius.circular(mine ? R.lg : 4.r),
            bottomRight: Radius.circular(mine ? 4.r : R.lg),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              message.text,
              style: T.body.copyWith(color: mine ? Colors.white : C.ink),
            ),
            SizedBox(height: 4.h),
            Text(
              '${fmtDay(message.at)}, ${fmtClock(message.at)}',
              style: T.small.copyWith(
                fontSize: 10.sp,
                color: mine ? Colors.white70 : C.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Composer extends StatefulWidget {
  const _Composer();

  @override
  State<_Composer> createState() => _ComposerState();
}

class _ComposerState extends State<_Composer> {
  final _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _send() {
    final t = _text.text.trim();
    if (t.isEmpty) return;
    context.read<ChatBloc>().add(SendChatMessage(t));
    _text.clear();
  }

  @override
  Widget build(BuildContext context) => BlocBuilder<ChatBloc, ChatState>(
    builder: (context, state) => Row(
      children: [
        Expanded(
          child: TextField(
            key: const Key('chat-input'),
            controller: _text,
            minLines: 1,
            maxLines: 4,
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => _send(),
            decoration: const InputDecoration(hintText: 'Write a message'),
          ),
        ),
        SizedBox(width: 8.w),
        IconButton.filled(
          key: const Key('chat-send'),
          tooltip: 'Send',
          onPressed: state.sending ? null : _send,
          style: IconButton.styleFrom(
            backgroundColor: C.primary,
            foregroundColor: Colors.white,
            minimumSize: Size(48.r, 48.r),
          ),
          icon: const Icon(Icons.send_rounded),
        ),
      ],
    ),
  );
}
