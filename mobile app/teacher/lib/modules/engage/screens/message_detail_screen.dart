import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/engage_notice.dart';
import '../bloc/messages_bloc.dart';
import '../bloc/messages_events.dart';
import '../bloc/messages_states.dart';
import '../models/attachment_models.dart';
import '../models/message_models.dart';
import 'widgets/attachment_sheet.dart';
import 'widgets/engage_widgets.dart';
import 'widgets/message_widgets.dart';
import 'widgets/schedule_meeting_sheet.dart';
import 'widgets/voice_bubble.dart';
import 'widgets/voice_recorder.dart';

/// Figma 5.11.2 View Message: a messenger-style conversation. Avatar header with a phone call button,
/// day separators, bubbles grouped by sender (text, photos, documents, voice notes, meeting cards),
/// quick replies and a composer with attachments, voice recording and meeting scheduling.
/// Opening the thread clears its unread count and marks the teacher present (no push while reading).
class MessageDetailScreen extends StatelessWidget {
  const MessageDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<MessagesBloc>()
      ..add(const MessagesLoadRequested())
      ..add(ThreadOpened(id))
      ..add(ChatPresenceChanged(id)),
    child: NoticeListener<MessagesBloc, MessagesState>(
      child: _ThreadView(id: id),
    ),
  );
}

class _ThreadView extends StatefulWidget {
  const _ThreadView({required this.id});
  final String id;
  @override
  State<_ThreadView> createState() => _ThreadViewState();
}

class _ThreadViewState extends State<_ThreadView> with WidgetsBindingObserver {
  final c = TextEditingController();
  bool _hasText = false, _recording = false;
  int _lastCount = -1;

  /// The thread id events are sent with: the recipient key until the first message creates the thread, then its id.
  late String _id = widget.id;
  static const _quick = [
    'Acknowledged 👍',
    'Thank you',
    'Noted on register 📝',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    c.addListener(() {
      final v = c.text.trim().isNotEmpty;
      if (v != _hasText) setState(() => _hasText = v);
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    c.dispose();
    super.dispose();
  }

  MessagesBloc get _bloc => context.read<MessagesBloc>();

  // Presence follows the app: leaving to the background clears it, coming back restores it.
  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    _bloc.add(ChatPresenceChanged(s == AppLifecycleState.resumed ? _id : null));
  }

  void _send([String? quick]) {
    final text = (quick ?? c.text).trim();
    if (text.isEmpty) return;
    _bloc.add(ReplySent(_id, text));
    if (quick == null) c.clear();
  }

  Future<void> _attach(MessageThread t) async {
    final bloc = _bloc;
    final files = await showAttachmentSheet(
      context,
      onMeeting: t.kind == 'parent' ? () => _schedule(t) : null,
    );
    if (files.isNotEmpty) bloc.add(AttachmentsSent(_id, files));
  }

  Future<void> _photos() async {
    final bloc = _bloc;
    final files = await pickPhotos();
    if (files.isNotEmpty) bloc.add(AttachmentsSent(_id, files));
  }

  Future<void> _call(MessageThread t) async {
    final digits = t.phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (digits.isEmpty) {
      AppDialogs.showSnackBar(
        context,
        message: 'No phone number on file for ${t.name}.',
      );
      return;
    }
    final uri = Uri(scheme: 'tel', path: digits);
    if (!await launchUrl(uri) && mounted) {
      AppDialogs.showSnackBar(context, message: 'Could not open the dialer.');
    }
  }

  Future<void> _schedule(MessageThread t, {ChatMeeting? existing}) async {
    final bloc = _bloc;
    final draft = await showScheduleMeetingSheet(
      context,
      withName: t.name,
      existing: existing == null
          ? null
          : MeetingDraft(
              date: existing.date,
              time: existing.time,
              link: existing.link,
              note: existing.note,
            ),
    );
    if (draft == null) return;
    final next = ChatMeeting(
      threadId: _id,
      date: draft.date,
      time: draft.time,
      link: draft.link,
      note: draft.note,
    );
    if (existing == null) {
      bloc.add(MeetingScheduled(_id, next));
    } else {
      bloc.add(MeetingRescheduled(existing.id, next));
    }
  }

  Future<void> _cancelMeeting(ChatMeeting m) async {
    final bloc = _bloc;
    final ok = await confirmAction(
      context,
      title: 'Cancel this meeting?',
      message:
          'The parent will be told the meeting on ${fmtDate(m.date, year: true)} at ${fmtTime(m.time)} is cancelled.',
      confirm: 'Cancel meeting',
      danger: true,
    );
    if (ok) bloc.add(MeetingCancelled(m.id));
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<MessagesBloc>().state;
    final found = s.thread(widget.id);
    // opened from the contact list before any message: a placeholder thread for the recipient, created on the first message
    final r = found == null && s.status == EngageStatus.loaded
        ? s.recipient(widget.id)
        : null;
    final t =
        found ??
        (r == null
            ? null
            : MessageThread(
                key: r.id,
                name: r.name,
                role: r.role,
                kind: r.kind,
                online: r.online,
                phone: r.phone,
                studentId: r.id.startsWith('g_') ? r.id.substring(2) : '',
                studentName: r.studentName,
                photo: r.photo,
              ));
    if (t == null) {
      return DetailScaffold(
        title: 'Messages',
        body: EngageStatusBody(
          status: s.status,
          error: s.error,
          notFound: 'Conversation not found',
        ),
      );
    }
    final id = t.id.isEmpty ? widget.id : t.id;
    if (id != _id) {
      // the thread now exists (first message sent): presence and meetings follow its real id
      _id = id;
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _bloc.add(ChatPresenceChanged(id)),
      );
    }
    // a message that arrived while the thread is open is read immediately
    if (t.msgs.length != _lastCount) {
      _lastCount = t.msgs.length;
      if (t.unread > 0) {
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => _bloc.add(ThreadOpened(id)),
        );
      }
    }
    final status = t.online
        ? 'Active now'
        : (t.broadcast ? '${t.members} members' : t.subtitle);
    final meetings = s.upcomingMeetings(id);
    final blocked = r?.available == false ? r!.blocked : '';
    return PopScope(
      onPopInvokedWithResult: (_, _) =>
          _bloc.add(const ChatPresenceChanged(null)),
      child: Scaffold(
        backgroundColor: C.surface,
        appBar: _ThreadHeader(
          thread: t,
          status: status,
          onCall: t.broadcast ? null : () => _call(t),
          onMeeting: t.kind == 'parent' && t.id.isNotEmpty
              ? () => _schedule(t)
              : null,
        ),
        body: Column(
          children: [
            if (meetings.isNotEmpty)
              _MeetingBanner(
                meeting: meetings.first,
                onReschedule: () => _schedule(t, existing: meetings.first),
                onCancel: () => _cancelMeeting(meetings.first),
              ),
            Expanded(
              child: t.msgs.isEmpty
                  ? AppEmptyState(
                      blocked.isEmpty
                          ? 'No messages yet'
                          : 'Cannot message yet',
                      hint: blocked.isEmpty
                          ? 'Write the first message below.'
                          : '$blocked. Messages will be delivered once the parent app is set up.',
                      icon: blocked.isEmpty
                          ? Icons.chat_bubble_outline_rounded
                          : Icons.block_rounded,
                    )
                  : ListView(
                      reverse: true,
                      padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 12.h),
                      children: _bubbles(t, s).reversed.toList(),
                    ),
            ),
            if (s.uploading > 0)
              Container(
                color: C.bg,
                padding: EdgeInsets.symmetric(
                  horizontal: S.page,
                  vertical: 6.h,
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 14.r,
                      height: 14.r,
                      child: const CircularProgressIndicator(strokeWidth: 2),
                    ),
                    SizedBox(width: 8.w),
                    Text(
                      s.uploading == 1
                          ? 'Sending 1 file…'
                          : 'Sending ${s.uploading} files…',
                      style: T.small,
                    ),
                  ],
                ),
              ),
            _Composer(
              controller: c,
              hasText: _hasText,
              recording: _recording,
              quick: _quick,
              onQuick: _send,
              onAttach: () => _attach(t),
              onPhotos: _photos,
              onMic: () => setState(() => _recording = true),
              onRecordCancel: () => setState(() => _recording = false),
              onRecordDone: (clip) {
                setState(() => _recording = false);
                _bloc.add(VoiceSent(_id, clip));
              },
              onSend: _send,
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _bubbles(MessageThread t, MessagesState s) {
    final out = <Widget>[];
    String? day;
    final maxW = MediaQuery.sizeOf(context).width * .78;
    final msgs = t.msgs;
    for (var i = 0; i < msgs.length; i++) {
      final m = msgs[i];
      final d = DateTime.tryParse(m.ts);
      final key = d == null ? '' : isoOf(d);
      final newDay = key != day && d != null;
      if (newDay) {
        day = key;
        out.add(_DayChip(d));
      }
      final prev = i > 0 ? msgs[i - 1] : null;
      final next = i + 1 < msgs.length ? msgs[i + 1] : null;
      final sameAsPrev = !newDay && prev != null && prev.from == m.from;
      final sameAsNext =
          next != null &&
          next.from == m.from &&
          (DateTime.tryParse(next.ts) == null ||
              isoOf(DateTime.tryParse(next.ts)!) == key);
      if (m.meeting != null) {
        out.add(
          _MeetingCard(
            message: m,
            live: s.meeting(m.meeting!.id) ?? m.meeting!,
            onReschedule: m.mine
                ? () => _schedule(
                    t,
                    existing: s.meeting(m.meeting!.id) ?? m.meeting!,
                  )
                : null,
            onCancel: m.mine
                ? () => _cancelMeeting(s.meeting(m.meeting!.id) ?? m.meeting!)
                : null,
          ),
        );
        continue;
      }
      out.add(
        _Bubble(
          m: m,
          thread: t,
          maxWidth: maxW,
          first: !sameAsPrev,
          last: !sameAsNext,
        ),
      );
    }
    for (final p in s.pendingOf(t.id)) {
      out.add(
        _Bubble(
          m: p,
          thread: t,
          maxWidth: maxW,
          first: true,
          last: true,
          sending: true,
        ),
      );
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Header & meeting banner
// ---------------------------------------------------------------------------

class _ThreadHeader extends StatelessWidget implements PreferredSizeWidget {
  const _ThreadHeader({
    required this.thread,
    required this.status,
    required this.onCall,
    required this.onMeeting,
  });
  final MessageThread thread;
  final String status;
  final VoidCallback? onCall, onMeeting;
  @override
  Size get preferredSize => Size.fromHeight(68.h);
  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: Container(
      height: 68.h,
      padding: EdgeInsets.symmetric(horizontal: 6.w),
      decoration: const BoxDecoration(
        color: C.bg,
        border: Border(bottom: BorderSide(color: C.border)),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Back',
            onPressed: () => context.canPop()
                ? context.pop()
                : context.go(RoutePaths.messages),
            icon: Icon(Icons.arrow_back_rounded, color: C.ink, size: 24.r),
          ),
          RecipientAvatar(
            name: thread.name,
            kind: thread.kind,
            online: thread.online,
            size: 40,
            image: thread.photo,
          ),
          SizedBox(width: 10.w),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  thread.name,
                  style: T.h3,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  status,
                  style: T.small.copyWith(
                    color: thread.online ? C.successDark : C.slate,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (onMeeting != null)
            IconButton(
              tooltip: 'Schedule meeting',
              onPressed: onMeeting,
              icon: Icon(Icons.video_call_outlined, color: C.ink, size: 24.r),
            ),
          if (onCall != null)
            IconButton(
              tooltip: 'Call',
              onPressed: onCall,
              icon: Icon(Icons.call_outlined, color: C.ink, size: 24.r),
            ),
        ],
      ),
    ),
  );
}

class _MeetingBanner extends StatelessWidget {
  const _MeetingBanner({
    required this.meeting,
    required this.onReschedule,
    required this.onCancel,
  });
  final ChatMeeting meeting;
  final VoidCallback onReschedule, onCancel;
  @override
  Widget build(BuildContext context) {
    final start = meeting.startsAt;
    final soon =
        start != null &&
        start.difference(DateTime.now()) < const Duration(minutes: 15);
    return Material(
      color: C.primarySoft,
      child: InkWell(
        onTap: () => launchUrl(
          Uri.parse(meeting.link),
          mode: LaunchMode.externalApplication,
        ),
        child: Padding(
          padding: EdgeInsets.fromLTRB(S.page, 10.h, 8.w, 10.h),
          child: Row(
            children: [
              IconTile(
                Icons.video_call_rounded,
                size: 36,
                tone: soon ? Tone.success : Tone.brand,
              ),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      soon ? 'Meeting starting soon' : 'Upcoming meeting',
                      style: T.smallStrong.copyWith(color: C.primaryDark),
                    ),
                    Text(
                      '${fmtDate(meeting.date, year: true)} • ${fmtTime(meeting.time)} • Google Meet',
                      style: T.small,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              PopupMenuButton<String>(
                tooltip: 'Meeting options',
                icon: Icon(
                  Icons.more_horiz_rounded,
                  color: C.primary,
                  size: 22.r,
                ),
                onSelected: (v) => v == 'cancel' ? onCancel() : onReschedule(),
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'reschedule', child: Text('Reschedule')),
                  PopupMenuItem(value: 'cancel', child: Text('Cancel meeting')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

class _DayChip extends StatelessWidget {
  const _DayChip(this.d);
  final DateTime d;
  @override
  Widget build(BuildContext context) {
    final key = isoOf(d);
    final label = key == todayIso()
        ? 'Today'
        : DateFormat(
            d.year == DateTime.now().year ? 'EEE, d MMM' : 'd MMM yyyy',
          ).format(d);
    return Center(
      child: Container(
        margin: EdgeInsets.symmetric(vertical: 12.h),
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 5.h),
        decoration: BoxDecoration(
          color: C.bg,
          borderRadius: BorderRadius.circular(R.pill),
          border: Border.all(color: C.border),
        ),
        child: Text(
          label,
          style: T.small.copyWith(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({
    required this.m,
    required this.thread,
    required this.maxWidth,
    required this.first,
    required this.last,
    this.sending = false,
  });
  final ThreadMessage m;
  final MessageThread thread;
  final double maxWidth;
  final bool first, last;

  /// A local placeholder whose upload is still running.
  final bool sending;
  @override
  Widget build(BuildContext context) {
    final mine = m.mine;
    final att = m.attach;
    final big = R.lg, small = 6.r;
    final radius = BorderRadius.only(
      topLeft: Radius.circular(mine || first ? big : small),
      topRight: Radius.circular(!mine || first ? big : small),
      bottomLeft: Radius.circular(mine || last ? big : small),
      bottomRight: Radius.circular(!mine || last ? big : small),
    );
    final image = att != null && att.isImage && att.url.isNotEmpty;
    return Padding(
      padding: EdgeInsets.only(top: first ? 8.h : 2.h, bottom: last ? 4.h : 0),
      child: Row(
        mainAxisAlignment: mine
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!mine && thread.broadcast)
            Padding(
              padding: EdgeInsets.only(right: 8.w, bottom: 2.h),
              child: last
                  ? Avatar(m.sender, size: 28, tone: Tone.neutral)
                  : SizedBox(width: 28.r),
            ),
          Flexible(
            child: Container(
              constraints: BoxConstraints(maxWidth: maxWidth),
              padding: image
                  ? EdgeInsets.all(4.r)
                  : EdgeInsets.fromLTRB(12.w, 9.h, 12.w, 7.h),
              decoration: BoxDecoration(
                color: mine ? C.primary : C.bg,
                borderRadius: radius,
                boxShadow: [
                  BoxShadow(
                    color: C.ink.withValues(alpha: .04),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (!mine && thread.broadcast && first && !image)
                    Padding(
                      padding: EdgeInsets.only(bottom: 2.h),
                      child: Text(
                        m.sender,
                        style: T.smallStrong.copyWith(color: C.primary),
                      ),
                    ),
                  if (image)
                    _ImageAttachment(
                      att,
                      radius: radius,
                      maxWidth: maxWidth - 8.r,
                    ),
                  if (att != null && att.isAudio)
                    VoiceBubble(
                      source: att.url.isNotEmpty ? att.url : att.path,
                      duration: att.duration,
                      mine: mine,
                    ),
                  if (att != null && !att.isImage && !att.isAudio)
                    _FileAttachment(att, mine: mine),
                  if (m.text.isNotEmpty)
                    Padding(
                      padding: EdgeInsets.only(
                        top: att == null ? 0 : 6.h,
                        left: image ? 8.w : 0,
                        right: image ? 8.w : 0,
                      ),
                      child: Text(
                        m.text,
                        style: T.body.copyWith(
                          color: mine ? Colors.white : C.ink,
                          fontSize: 14.5.sp,
                          height: 1.35,
                        ),
                      ),
                    ),
                  SizedBox(height: 3.h),
                  Padding(
                    padding: EdgeInsets.only(
                      left: image ? 8.w : 0,
                      right: image ? 8.w : 0,
                      bottom: image ? 4.h : 0,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          sending ? 'Sending…' : clock(m.ts),
                          style: T.small.copyWith(
                            color: mine ? Colors.white70 : C.muted,
                            fontSize: 10.5.sp,
                          ),
                        ),
                        if (mine) ...[
                          SizedBox(width: 4.w),
                          sending
                              ? SizedBox(
                                  width: 12.r,
                                  height: 12.r,
                                  child: const CircularProgressIndicator(
                                    strokeWidth: 1.5,
                                    color: Colors.white70,
                                  ),
                                )
                              : Icon(
                                  Icons.done_all_rounded,
                                  size: 14.r,
                                  color: Colors.white70,
                                ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ImageAttachment extends StatelessWidget {
  const _ImageAttachment(
    this.att, {
    required this.radius,
    required this.maxWidth,
  });
  final FileRef att;
  final BorderRadius radius;
  final double maxWidth;
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: () => showDialog<void>(
      context: context,
      builder: (_) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: Stack(
          children: [
            Center(
              child: InteractiveViewer(
                maxScale: 5,
                child: _netImage(att.url, fit: BoxFit.contain),
              ),
            ),
            Positioned(
              top: 8,
              right: 8,
              child: SafeArea(
                child: IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(
                    Icons.close_rounded,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(R.md),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth, maxHeight: 260.h),
        child: _netImage(att.url, fit: BoxFit.cover),
      ),
    ),
  );

  Widget _netImage(String url, {required BoxFit fit}) => url.startsWith('http')
      ? Image.network(
          url,
          fit: fit,
          loadingBuilder: (_, child, p) => p == null
              ? child
              : SizedBox(
                  width: 180.w,
                  height: 140.h,
                  child: const Center(
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
          errorBuilder: (_, _, _) => _broken(),
        )
      : url.startsWith('/')
      ? Image.file(File(url), fit: fit, errorBuilder: (_, _, _) => _broken())
      : Image.asset(url, fit: fit, errorBuilder: (_, _, _) => _broken());

  Widget _broken() => Container(
    width: 180.w,
    height: 120.h,
    color: C.surface,
    child: Icon(Icons.broken_image_outlined, color: C.muted, size: 32.r),
  );
}

class _FileAttachment extends StatelessWidget {
  const _FileAttachment(this.att, {required this.mine});
  final FileRef att;
  final bool mine;
  @override
  Widget build(BuildContext context) {
    final fg = mine ? Colors.white : C.ink;
    return InkWell(
      borderRadius: BorderRadius.circular(R.md),
      onTap: att.url.startsWith('http')
          ? () => launchUrl(
              Uri.parse(att.url),
              mode: LaunchMode.externalApplication,
            )
          : null,
      child: Container(
        padding: EdgeInsets.all(8.r),
        decoration: BoxDecoration(
          color: mine ? Colors.white.withValues(alpha: .16) : C.surface,
          borderRadius: BorderRadius.circular(R.md),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36.r,
              height: 36.r,
              decoration: BoxDecoration(
                color: mine ? Colors.white.withValues(alpha: .2) : C.dangerSoft,
                borderRadius: BorderRadius.circular(R.sm),
              ),
              child: Icon(
                AppFileChip.iconFor(att.name),
                size: 20.r,
                color: mine ? Colors.white : C.danger,
              ),
            ),
            SizedBox(width: 10.w),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    att.name,
                    style: T.smallStrong.copyWith(color: fg),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    [
                      if (att.size.isNotEmpty) att.size,
                      if (att.url.startsWith('http')) 'Tap to open',
                    ].join(' • '),
                    style: T.small.copyWith(
                      color: mine ? Colors.white70 : C.slate,
                      fontSize: 11.sp,
                    ),
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

/// A meeting card posted into the conversation. [live] is the meeting's current state (so a cancelled
/// or rescheduled meeting updates every earlier card).
class _MeetingCard extends StatelessWidget {
  const _MeetingCard({
    required this.message,
    required this.live,
    required this.onReschedule,
    required this.onCancel,
  });
  final ThreadMessage message;
  final ChatMeeting live;
  final VoidCallback? onReschedule, onCancel;
  @override
  Widget build(BuildContext context) {
    final cancelled = live.cancelled;
    final over = live.past && !cancelled;
    final tone = cancelled
        ? Tone.danger
        : over
        ? Tone.neutral
        : Tone.brand;
    final c = toneColors(tone);
    return Center(
      child: Container(
        width: 300.w,
        margin: EdgeInsets.symmetric(vertical: 8.h),
        decoration: BoxDecoration(
          color: C.bg,
          borderRadius: BorderRadius.circular(R.xl),
          border: Border.all(color: cancelled ? C.dangerSoft : C.panelBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 10.h),
              decoration: BoxDecoration(
                color: c.bg,
                borderRadius: BorderRadius.vertical(top: Radius.circular(R.xl)),
              ),
              child: Row(
                children: [
                  Icon(
                    cancelled
                        ? Icons.event_busy_rounded
                        : Icons.video_call_rounded,
                    color: c.fg,
                    size: 20.r,
                  ),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: Text(
                      cancelled
                          ? 'Meeting cancelled'
                          : over
                          ? 'Past meeting'
                          : 'Google Meet',
                      style: T.smallStrong.copyWith(color: c.fg),
                    ),
                  ),
                  Text(
                    clock(message.ts),
                    style: T.small.copyWith(fontSize: 10.5.sp),
                  ),
                ],
              ),
            ),
            Padding(
              padding: EdgeInsets.all(14.r),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    fmtDate(live.date, year: true),
                    style: T.h3.copyWith(
                      decoration: cancelled ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  Text(
                    fmtTime(live.time),
                    style: T.bodyStrong.copyWith(
                      color: cancelled ? C.slate : C.primary,
                      decoration: cancelled ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  if (live.note.isNotEmpty) ...[
                    SizedBox(height: 6.h),
                    Text(
                      live.note,
                      style: T.small,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (!cancelled) ...[
                    SizedBox(height: 12.h),
                    AppButton(
                      'Join meeting',
                      icon: Icons.videocam_rounded,
                      small: true,
                      kind: over ? BtnKind.outline : BtnKind.primary,
                      onPressed: () => launchUrl(
                        Uri.parse(live.link),
                        mode: LaunchMode.externalApplication,
                      ),
                    ),
                    if (!over &&
                        (onReschedule != null || onCancel != null)) ...[
                      SizedBox(height: 6.h),
                      Row(
                        children: [
                          if (onReschedule != null)
                            Expanded(
                              child: TextButton.icon(
                                onPressed: onReschedule,
                                icon: Icon(
                                  Icons.edit_calendar_outlined,
                                  size: 16.r,
                                ),
                                label: const Text('Reschedule'),
                              ),
                            ),
                          if (onCancel != null)
                            Expanded(
                              child: TextButton.icon(
                                style: TextButton.styleFrom(
                                  foregroundColor: C.danger,
                                ),
                                onPressed: onCancel,
                                icon: Icon(Icons.close_rounded, size: 16.r),
                                label: const Text('Cancel'),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.hasText,
    required this.recording,
    required this.quick,
    required this.onQuick,
    required this.onAttach,
    required this.onPhotos,
    required this.onMic,
    required this.onRecordCancel,
    required this.onRecordDone,
    required this.onSend,
  });
  final TextEditingController controller;
  final bool hasText, recording;
  final List<String> quick;
  final ValueChanged<String> onQuick;
  final VoidCallback onAttach, onPhotos, onMic, onRecordCancel, onSend;
  final ValueChanged<VoiceClip> onRecordDone;
  @override
  Widget build(BuildContext context) => Container(
    decoration: const BoxDecoration(
      color: C.bg,
      border: Border(top: BorderSide(color: C.border)),
    ),
    padding: EdgeInsets.fromLTRB(10.w, 6.h, 10.w, 6.h),
    child: SafeArea(
      top: false,
      child: recording
          ? VoiceRecorderBar(onCancel: onRecordCancel, onDone: onRecordDone)
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  height: 32.h,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      for (final q in quick)
                        _QuickChip(label: q, onTap: () => onQuick(q)),
                    ],
                  ),
                ),
                SizedBox(height: 6.h),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Container(
                        constraints: BoxConstraints(minHeight: 42.r),
                        padding: EdgeInsets.symmetric(horizontal: 2.w),
                        decoration: BoxDecoration(
                          color: C.surface,
                          borderRadius: BorderRadius.circular(21.r),
                          border: Border.all(color: C.border),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            _ComposerIcon(
                              icon: Icons.attach_file_rounded,
                              tooltip: 'Attach file',
                              onTap: onAttach,
                            ),
                            Expanded(
                              child: Padding(
                                padding: EdgeInsets.symmetric(vertical: 2.h),
                                child: TextField(
                                  controller: controller,
                                  minLines: 1,
                                  maxLines: 5,
                                  textInputAction: TextInputAction.newline,
                                  textCapitalization:
                                      TextCapitalization.sentences,
                                  style: T.body.copyWith(
                                    color: C.ink,
                                    fontSize: 15.sp,
                                    height: 1.3,
                                  ),
                                  decoration: InputDecoration(
                                    hintText: 'Message',
                                    hintStyle: T.body.copyWith(
                                      color: C.muted,
                                      fontSize: 15.sp,
                                    ),
                                    filled: false,
                                    isDense: true,
                                    isCollapsed: true,
                                    border: InputBorder.none,
                                    enabledBorder: InputBorder.none,
                                    focusedBorder: InputBorder.none,
                                    contentPadding: EdgeInsets.symmetric(
                                      horizontal: 6.w,
                                      vertical: 8.h,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    SizedBox(width: 8.w),
                    // Send when there is text, otherwise record a voice note.
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 150),
                      child: Container(
                        key: ValueKey(hasText),
                        width: 42.r,
                        height: 42.r,
                        decoration: BoxDecoration(
                          color: C.primary,
                          shape: BoxShape.circle,
                        ),
                        child: hasText
                            ? IconButton(
                                tooltip: 'Send',
                                padding: EdgeInsets.zero,
                                onPressed: onSend,
                                icon: Icon(
                                  Icons.send_rounded,
                                  size: 19.r,
                                  color: Colors.white,
                                ),
                              )
                            : IconButton(
                                tooltip: 'Record voice note',
                                padding: EdgeInsets.zero,
                                onPressed: onMic,
                                icon: Icon(
                                  Icons.mic_rounded,
                                  size: 21.r,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
    ),
  );
}

/// Round 40px icon button that lines up with the text field's first line.
class _ComposerIcon extends StatelessWidget {
  const _ComposerIcon({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 2.r),
    child: IconButton(
      tooltip: tooltip,
      onPressed: onTap,
      padding: EdgeInsets.zero,
      constraints: BoxConstraints.tightFor(width: 36.r, height: 36.r),
      icon: Icon(icon, color: C.slate, size: 21.r),
    ),
  );
}

class _QuickChip extends StatelessWidget {
  const _QuickChip({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(right: 8.w),
    child: InkWell(
      borderRadius: BorderRadius.circular(R.pill),
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 12.w),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: C.primarySoft,
          borderRadius: BorderRadius.circular(R.pill),
          border: Border.all(color: C.panelBorder),
        ),
        child: Text(label, style: T.smallStrong.copyWith(color: C.primary)),
      ),
    ),
  );
}
