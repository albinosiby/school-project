import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/chat_bloc.dart';
import '../models/message_models.dart';
import 'widgets/contact_avatar.dart';
import 'widgets/file_upload_sheet.dart';
import 'widgets/voice_bubble.dart';

/// Conversation with a teacher or office (Figma 4.1): date separators, bubbles with attachments and
/// read ticks, quick replies, attach / voice note / send. Opening it marks the thread read.
class ChatScreen extends StatelessWidget {
  const ChatScreen({
    super.key,
    required this.threadId,
    this.teacher,
    this.role,
  });
  final String threadId;

  /// Shown until the thread has loaded (passed in the route's query).
  final String? teacher, role;

  @override
  Widget build(BuildContext context) => BlocProvider<ChatBloc>(
    create: (_) => getIt<ChatBloc>()..add(OpenChat(threadId)),
    child: BlocListener<ChatBloc, ChatState>(
      listenWhen: (a, b) =>
          b.status == LoadStatus.loaded &&
          b.error != null &&
          a.error != b.error,
      listener: (context, s) =>
          AppDialogs.showSnackBar(context, message: s.error!, isError: true),
      child: _PresenceScope(
        child: Scaffold(
        backgroundColor: C.surface,
        appBar: _ChatHeader(fallbackName: teacher ?? 'Conversation'),
        body: Column(
          children: [
            Expanded(
              child: BlocBuilder<ChatBloc, ChatState>(
                builder: (context, state) {
                  if (state.status == LoadStatus.error) {
                    return AppErrorWidget(
                      message: state.error ?? 'Could not load messages.',
                      onRetry: () =>
                          context.read<ChatBloc>().add(OpenChat(threadId)),
                    );
                  }
                  final thread = state.thread;
                  if (thread == null) return const AppLoading(rows: 3);
                  if (state.messages.isEmpty) {
                    return Center(
                      child: AppEmptyState(
                        'Say hello',
                        hint: 'Send your first message to ${thread.teacher}.',
                        icon: Icons.waving_hand_outlined,
                      ),
                    );
                  }
                  return _MessageList(thread: thread, messages: state.messages);
                },
              ),
            ),
            const _Composer(),
          ],
        ),
        ),
      ),
    ),
  );
}

/// Clears the guardian's chat presence when the screen is left or the app goes to the background.
class _PresenceScope extends StatefulWidget {
  const _PresenceScope({required this.child});
  final Widget child;
  @override
  State<_PresenceScope> createState() => _PresenceScopeState();
}

class _PresenceScopeState extends State<_PresenceScope> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    final bloc = context.read<ChatBloc>();
    if (s == AppLifecycleState.resumed) {
      final id = bloc.state.threadId;
      if (id != null) bloc.add(OpenChat(id));
    } else if (s == AppLifecycleState.paused) {
      bloc.add(const LeaveChat());
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    onPopInvokedWithResult: (_, _) => context.read<ChatBloc>().add(const LeaveChat()),
    child: widget.child,
  );
}

class _ChatHeader extends StatelessWidget implements PreferredSizeWidget {
  const _ChatHeader({required this.fallbackName});
  final String fallbackName;

  @override
  Size get preferredSize => Size.fromHeight(72.h);

  Widget _round(
    BuildContext context, {
    required String label,
    required VoidCallback onTap,
    required Widget child,
    Key? key,
  }) => Tooltip(
    message: label,
    child: Semantics(
      button: true,
      label: label,
      child: Material(
        key: key,
        color: C.bg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(R.lg),
          side: const BorderSide(color: C.border),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(R.lg),
          onTap: onTap,
          child: SizedBox(
            width: 44.r,
            height: 44.r,
            child: Center(child: child),
          ),
        ),
      ),
    ),
  );

  void _call(BuildContext context, String name) => AppDialogs.showSnackBar(
    context,
    message: 'Calling $name… (demo: calls are simulated)',
  );

  Future<void> _info(BuildContext context, MessageThread t) async {
    final action = await showAppSheet<String>(
      context,
      title: t.teacher,
      subtitle: t.subtitle,
      builder: (ctx) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Pill(t.role, tone: toneOfKind(t.kind)),
          SizedBox(height: 12.h),
          Row(
            children: [
              Icon(Icons.schedule_rounded, size: 16.r, color: C.slate),
              SizedBox(width: 6.w),
              Expanded(
                child: Text(
                  'Active hours: 8:00 AM – 3:30 PM IST • Typical reply within 24 hrs',
                  style: T.small,
                ),
              ),
            ],
          ),
          SizedBox(height: 18.h),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  'Call',
                  icon: Icons.call_outlined,
                  kind: BtnKind.outline,
                  onPressed: () => Navigator.pop(ctx, 'call'),
                ),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: AppButton(
                  'New topic',
                  icon: Icons.edit_square,
                  onPressed: () => Navigator.pop(ctx, 'new'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
    if (!context.mounted) return;
    if (action == 'call') _call(context, t.teacher);
    if (action == 'new') {
      context.push(RoutePaths.newMessageWith(to: t.contactId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.select<ChatBloc, MessageThread?>((b) => b.state.thread);
    final name = t?.teacher ?? fallbackName;
    return SafeArea(
      bottom: false,
      child: Container(
        height: 72.h,
        color: C.surface,
        padding: EdgeInsets.symmetric(horizontal: 16.w),
        child: Row(
          children: [
            _round(
              context,
              label: 'Back',
              onTap: () => context.canPop()
                  ? context.pop()
                  : context.go(RoutePaths.messages),
              child: Icon(Icons.arrow_back_rounded, color: C.ink, size: 22.r),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'MESSAGES',
                    style: T.capsMuted.copyWith(fontSize: 11.sp),
                  ),
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.h3,
                  ),
                ],
              ),
            ),
            _round(
              context,
              key: const Key('chat-call'),
              label: 'Call $name',
              onTap: () => _call(context, name),
              child: Icon(Icons.call_outlined, color: C.ink, size: 20.r),
            ),
            SizedBox(width: 10.w),
            if (t != null)
              Semantics(
                button: true,
                label: 'About ${t.teacher}',
                child: InkResponse(
                  key: const Key('chat-contact'),
                  onTap: () => _info(context, t),
                  radius: 26.r,
                  child: ContactAvatar(
                    name: t.teacher,
                    kind: t.kind,
                    size: 44,
                    online: t.online,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Oldest-first messages rendered bottom-up with day separators.
class _MessageList extends StatelessWidget {
  const _MessageList({required this.thread, required this.messages});
  final MessageThread thread;
  final List<ChatMessage> messages;

  static String dayLabel(DateTime d) {
    final day = fmtDay(d);
    final full = DateFormat('d MMMM yyyy').format(d);
    return day == 'Today' || day == 'Yesterday'
        ? '$day, $full'
        : DateFormat('EEE, d MMMM yyyy').format(d);
  }

  @override
  Widget build(BuildContext context) {
    final items = <Widget>[];
    for (var i = 0; i < messages.length; i++) {
      final m = messages[i];
      final prev = i == 0 ? null : messages[i - 1];
      final newDay = prev == null || !sameDay(prev.at, m.at);
      if (newDay) items.add(_DayPill(dayLabel(m.at)));
      final firstOfGroup = newDay || prev.fromParent != m.fromParent;
      if (m.meeting != null) {
        items.add(_MeetingCard(key: ValueKey('msg-${m.id}'), card: m.meeting!, time: fmtClock(m.at)));
        continue;
      }
      final media = m.media;
      items.add(
        AppChatBubble(
          key: ValueKey('msg-${m.id}'),
          text: m.text,
          time: fmtClock(m.at),
          mine: m.fromParent,
          read: m.read,
          sender: !m.fromParent && firstOfGroup
              ? (i == 0 || newDay) && thread.kind.isPerson
                    ? '${thread.teacher} • Faculty'
                    : thread.teacher
              : null,
          avatar: !m.fromParent && firstOfGroup
              ? ContactAvatar(
                  name: thread.teacher,
                  kind: thread.kind,
                  size: 32,
                  online: thread.online,
                )
              : null,
          attachments: [
            if (media != null && media.isImage) _ImageAttachment(media),
            if (media != null && media.isAudio) VoiceBubble(url: media.url, duration: media.duration, mine: m.fromParent),
            if (media != null && !media.isImage && !media.isAudio)
              AppFileChip(
                name: media.name,
                size: media.sizeLabel,
                tone: Tone.brand,
                onTap: () => launchUrl(Uri.parse(media.url), mode: LaunchMode.externalApplication),
              ),
            for (final a in m.attachments)
              AppFileChip(
                name: a.name,
                size: a.sizeLabel,
                tone: Tone.brand,
                onTap: () => AppDialogs.showSnackBar(
                  context,
                  message: 'Opening ${a.name} (demo preview)',
                ),
              ),
          ],
        ),
      );
    }
    final reversed = items.reversed.toList();
    return ListView.builder(
      key: const Key('chat-list'),
      reverse: true,
      padding: EdgeInsets.fromLTRB(S.page, 8.h, S.page, 8.h),
      itemCount: reversed.length,
      itemBuilder: (_, i) => reversed[i],
    );
  }
}

/// A photo shared in the chat; tap to view full screen.
class _ImageAttachment extends StatelessWidget {
  const _ImageAttachment(this.media);
  final ChatMedia media;
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: () => showDialog<void>(
      context: context,
      builder: (_) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: Stack(children: [
          Center(child: InteractiveViewer(maxScale: 5, child: Image.network(media.url, fit: BoxFit.contain))),
          Positioned(top: 8, right: 8, child: SafeArea(child: IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28)))),
        ]),
      ),
    ),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(R.md),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: 240.w, maxHeight: 240.h),
        child: Image.network(
          media.url,
          fit: BoxFit.cover,
          loadingBuilder: (_, child, p) => p == null ? child : SizedBox(width: 180.w, height: 140.h, child: const Center(child: CircularProgressIndicator(strokeWidth: 2))),
          errorBuilder: (_, _, _) => Container(width: 180.w, height: 120.h, color: C.surface, child: Icon(Icons.broken_image_outlined, color: C.muted, size: 32.r)),
        ),
      ),
    ),
  );
}

/// A meeting the teacher scheduled: date, time, Google Meet link. Reminders arrive as notifications.
class _MeetingCard extends StatelessWidget {
  const _MeetingCard({super.key, required this.card, required this.time});
  final ChatMeetingCard card;
  final String time;
  @override
  Widget build(BuildContext context) {
    final cancelled = card.cancelled;
    final start = card.startsAt;
    final over = !cancelled && start != null && start.add(const Duration(hours: 1)).isBefore(DateTime.now());
    final tone = cancelled ? Tone.danger : over ? Tone.neutral : Tone.brand;
    final c = toneColors(tone);
    final day = start == null ? card.date : DateFormat('EEE, d MMM yyyy').format(start);
    final clock = start == null ? card.time : DateFormat('h:mm a').format(start);
    return Center(
      child: Container(
        width: 300.w,
        margin: EdgeInsets.only(bottom: 12.h),
        decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.xl), border: Border.all(color: cancelled ? C.dangerSoft : C.panelBorder)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 10.h),
            decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.vertical(top: Radius.circular(R.xl))),
            child: Row(children: [
              Icon(cancelled ? Icons.event_busy_rounded : Icons.video_call_rounded, color: c.fg, size: 20.r),
              SizedBox(width: 8.w),
              Expanded(child: Text(cancelled ? 'Meeting cancelled' : over ? 'Past meeting' : 'Meeting with your teacher', style: T.smallStrong.copyWith(color: c.fg))),
              Text(time, style: T.small.copyWith(fontSize: 10.5.sp)),
            ]),
          ),
          Padding(
            padding: EdgeInsets.all(14.r),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(day, style: T.h3.copyWith(decoration: cancelled ? TextDecoration.lineThrough : null)),
              Text(clock, style: T.bodyStrong.copyWith(color: cancelled ? C.slate : C.primary, decoration: cancelled ? TextDecoration.lineThrough : null)),
              if (card.note.isNotEmpty) ...[SizedBox(height: 6.h), Text(card.note, style: T.small, maxLines: 3, overflow: TextOverflow.ellipsis)],
              if (!cancelled) ...[
                SizedBox(height: 12.h),
                AppButton(over ? 'Open meeting link' : 'Join on Google Meet', icon: Icons.videocam_rounded, kind: over ? BtnKind.outline : BtnKind.primary,
                    onPressed: () => launchUrl(Uri.parse(card.link), mode: LaunchMode.externalApplication)),
                SizedBox(height: 6.h),
                Text('You will be reminded on the day, 1 hour before and 10 minutes before.', style: T.small.copyWith(fontSize: 11.sp), textAlign: TextAlign.center),
              ],
            ]),
          ),
        ]),
      ),
    );
  }
}

class _DayPill extends StatelessWidget {
  const _DayPill(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Center(
    child: Container(
      margin: EdgeInsets.symmetric(vertical: 12.h),
      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 5.h),
      decoration: BoxDecoration(
        color: C.surfaceLow,
        borderRadius: BorderRadius.circular(R.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.calendar_today_outlined,
            size: 13.r,
            color: C.onSurfaceVariant,
          ),
          SizedBox(width: 6.w),
          Text(
            label,
            style: T.small.copyWith(
              color: C.onSurfaceVariant,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );
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

  void _send([List<MessageAttachment> files = const []]) {
    final t = _text.text.trim();
    if (t.isEmpty && files.isEmpty) return;
    context.read<ChatBloc>().add(SendChatMessage(t, attachments: files));
    _text.clear();
  }

  Future<void> _attach() async {
    final files = await showFileUploadSheet(context);
    if (!mounted || files == null || files.isEmpty) return;
    _send(files);
  }

  void _voice() {
    context.read<ChatBloc>().add(
      const SendChatMessage(
        '',
        attachments: [MessageAttachment(name: 'Voice_note.m4a', sizeKb: 84)],
      ),
    );
    AppDialogs.showSnackBar(
      context,
      message: 'Voice note sent (demo: recording is simulated)',
    );
  }

  @override
  Widget build(BuildContext context) {
    final thread = context.select<ChatBloc, MessageThread?>(
      (b) => b.state.thread,
    );
    final sending = context.select<ChatBloc, bool>((b) => b.state.sending);
    final sal = thread == null
        ? ''
        : ' ${thread.kind.isPerson ? (thread.teacher.toLowerCase().startsWith(RegExp('mrs|ms')) ? "Ma'am" : 'Sir') : 'team'}';
    final replies = [
      'Thank you$sal 🙏',
      'Will ensure it is done',
      'Noted, thanks!',
    ];
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(S.page, 4.h, S.page, 10.h),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              height: 40.h,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: replies.length,
                separatorBuilder: (_, _) => SizedBox(width: 8.w),
                itemBuilder: (_, i) => ActionChip(
                  key: ValueKey('quick-reply-$i'),
                  label: Text(
                    replies[i],
                    style: T.smallStrong.copyWith(color: C.onSurface),
                  ),
                  backgroundColor: C.bg,
                  side: const BorderSide(color: C.outline),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(R.pill),
                  ),
                  onPressed: thread == null
                      ? null
                      : () => context.read<ChatBloc>().add(
                          SendChatMessage(replies[i]),
                        ),
                ),
              ),
            ),
            SizedBox(height: 8.h),
            Container(
              padding: EdgeInsets.fromLTRB(4.w, 4.h, 6.w, 4.h),
              decoration: BoxDecoration(
                color: C.bg,
                borderRadius: BorderRadius.circular(R.xxl),
                border: Border.all(color: C.outline),
                boxShadow: const [
                  BoxShadow(
                    color: C.cardShadow,
                    blurRadius: 12,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  IconButton(
                    key: const Key('chat-attach'),
                    tooltip: 'Attach a file',
                    onPressed: thread == null ? null : _attach,
                    icon: Icon(
                      Icons.attach_file_rounded,
                      size: 22.r,
                      color: C.slate,
                    ),
                  ),
                  Expanded(
                    child: TextField(
                      key: const Key('chat-input'),
                      controller: _text,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      style: T.bodyStrong.copyWith(fontWeight: FontWeight.w500),
                      decoration: InputDecoration(
                        hintText: 'Type a message...',
                        filled: false,
                        isDense: true,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(vertical: 10.h),
                      ),
                    ),
                  ),
                  IconButton(
                    key: const Key('chat-voice'),
                    tooltip: 'Record a voice note',
                    onPressed: thread == null ? null : _voice,
                    icon: Icon(
                      Icons.mic_none_rounded,
                      size: 22.r,
                      color: C.slate,
                    ),
                  ),
                  SizedBox(width: 2.w),
                  IconButton.filled(
                    key: const Key('chat-send'),
                    tooltip: 'Send',
                    onPressed: sending || thread == null ? null : () => _send(),
                    style: IconButton.styleFrom(
                      backgroundColor: C.primary,
                      foregroundColor: Colors.white,
                      minimumSize: Size(46.r, 46.r),
                    ),
                    icon: Icon(Icons.send_rounded, size: 20.r),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
