import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/messages_bloc.dart';
import '../bloc/messages_events.dart';
import '../bloc/messages_states.dart';
import '../models/message_models.dart';
import 'widgets/engage_widgets.dart';
import 'widgets/file_upload_sheet.dart';

/// Figma 5.11.2 View Message: conversation bubbles grouped by day, quick replies, schedule call,
/// attachments and the reply bar. Opening the thread clears its unread count.
class MessageDetailScreen extends StatelessWidget {
  const MessageDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MessagesBloc>()
          ..add(const MessagesLoadRequested())
          ..add(ThreadOpened(id)),
        child: NoticeListener<MessagesBloc, MessagesState>(child: _ThreadView(id: id)),
      );
}

class _ThreadView extends StatefulWidget {
  const _ThreadView({required this.id});
  final String id;
  @override
  State<_ThreadView> createState() => _ThreadViewState();
}

class _ThreadViewState extends State<_ThreadView> {
  final c = TextEditingController();
  static const _quick = ['Acknowledged 👍', 'Thank you', 'Noted on register 📝'];

  @override
  void dispose() {
    c.dispose();
    super.dispose();
  }

  MessagesBloc get _bloc => context.read<MessagesBloc>();

  void _send([String? quick]) {
    final text = (quick ?? c.text).trim();
    if (text.isEmpty) return;
    _bloc.add(ReplySent(widget.id, text));
    if (quick == null) c.clear();
  }

  Future<void> _attach() async {
    final bloc = _bloc;
    final r = await showFileUploadSheet(context, const []);
    if (r != null && r.isNotEmpty) bloc.add(FilesSent(widget.id, r));
  }

  Future<void> _scheduleCall(MessageThread t) async {
    final bloc = _bloc;
    const slots = ['Today, 5:00 PM', 'Tomorrow, 10:00 AM', 'Tomorrow, 4:30 PM'];
    final r = await showAppSheet<String>(context, title: 'Schedule a call', subtitle: 'with ${t.name}', builder: (ctx) => Column(children: [
          for (final sl in slots)
            Padding(padding: EdgeInsets.only(bottom: 8.h), child: AppButton(sl, kind: BtnKind.outline, icon: Icons.call_outlined, onPressed: () => Navigator.pop(ctx, sl))),
        ]));
    if (r != null) bloc.add(CallRequested(widget.id, r));
  }

  Future<void> _menu(String v, MessageThread t) async {
    final bloc = _bloc;
    switch (v) {
      case 'unread':
        bloc.add(ThreadMarkedUnread(t.id));
      case 'pin':
        bloc.add(ThreadPinToggled(t.id));
      case 'delete':
        final ok = await confirmAction(context, title: 'Delete conversation?', message: 'All ${t.msgs.length} messages with ${t.name} will be deleted.', confirm: 'Delete', danger: true);
        if (ok) bloc.add(ThreadDeleted(t.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<MessagesBloc>().state;
    final t = s.thread(widget.id);
    if (t == null) {
      return DetailScaffold(title: 'Messages', body: EngageStatusBody(status: s.status, error: s.error, notFound: 'Conversation not found'));
    }
    return DetailScaffold(
      title: t.name,
      subtitle: t.subject.isNotEmpty ? t.subject : '${t.role}${t.online ? ' • Active now' : ''}',
      actions: [
        IconButton(tooltip: 'Schedule call', onPressed: () => _scheduleCall(t), icon: Icon(Icons.call_outlined, color: C.ink, size: 22.r)),
        PopupMenuButton<String>(
          tooltip: 'Conversation options', icon: Icon(Icons.more_vert_rounded, color: C.ink, size: 22.r),
          onSelected: (v) => _menu(v, t),
          itemBuilder: (_) => [
            const PopupMenuItem(value: 'unread', child: Text('Mark as unread')),
            PopupMenuItem(value: 'pin', child: Text(t.pinned ? 'Unpin' : 'Pin to top')),
            const PopupMenuItem(value: 'delete', child: Text('Delete conversation')),
          ],
        ),
      ],
      body: Column(children: [
        Expanded(
          child: t.msgs.isEmpty
              ? const AppEmptyState('No messages yet', hint: 'Write the first message below.')
              : ListView(reverse: true, padding: EdgeInsets.all(S.page), children: _bubbles(t).reversed.toList()),
        ),
        Container(
          decoration: const BoxDecoration(color: C.bg, border: Border(top: BorderSide(color: C.border))),
          padding: EdgeInsets.fromLTRB(12.w, 8.h, 12.w, 8.h),
          child: SafeArea(
            top: false,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              SizedBox(
                height: 40.h,
                child: ListView(scrollDirection: Axis.horizontal, children: [
                  ActionChip(avatar: Icon(Icons.call_outlined, size: 16.r, color: C.primary), label: const Text('Schedule Call'), onPressed: () => _scheduleCall(t)),
                  for (final q in _quick) Padding(padding: EdgeInsets.only(left: 8.w), child: ActionChip(label: Text(q), onPressed: () => _send(q))),
                ]),
              ),
              SizedBox(height: 6.h),
              Row(children: [
                IconButton(tooltip: 'Attach file', icon: Icon(Icons.attach_file_rounded, color: C.ink, size: 22.r), onPressed: _attach),
                IconButton(tooltip: 'Attach photo', icon: Icon(Icons.photo_camera_outlined, color: C.ink, size: 22.r), onPressed: _attach),
                Expanded(
                  child: TextField(
                    controller: c, textInputAction: TextInputAction.send, onSubmitted: (_) => _send(),
                    decoration: InputDecoration(
                      hintText: 'Write a message...', fillColor: C.surface,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(R.pill), borderSide: BorderSide.none),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(R.pill), borderSide: BorderSide.none),
                      contentPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
                    ),
                  ),
                ),
                SizedBox(width: 6.w),
                IconButton.filled(
                  tooltip: 'Send', onPressed: () => _send(), icon: Icon(Icons.send_rounded, size: 20.r),
                  style: IconButton.styleFrom(backgroundColor: C.primary, minimumSize: Size(48.r, 48.r)),
                ),
              ]),
            ]),
          ),
        ),
      ]),
    );
  }

  List<Widget> _bubbles(MessageThread t) {
    final out = <Widget>[];
    String? day;
    final maxW = MediaQuery.sizeOf(context).width * .78;
    for (final m in t.msgs) {
      final d = DateTime.tryParse(m.ts);
      final key = d == null ? '' : isoOf(d);
      if (key != day && d != null) {
        day = key;
        out.add(Center(
          child: Container(
            margin: EdgeInsets.symmetric(vertical: 10.h), padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 5.h),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: C.border)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.calendar_today_outlined, size: 13.r, color: C.slate), SizedBox(width: 6.w),
              Text(key == todayIso() ? 'Today, ${DateFormat('d MMMM yyyy').format(d)}' : DateFormat('EEE, d MMMM yyyy').format(d), style: T.small),
            ]),
          ),
        ));
      }
      final mine = m.mine;
      final att = m.attach;
      out.add(Align(
        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          constraints: BoxConstraints(maxWidth: maxW), margin: EdgeInsets.symmetric(vertical: 4.h), padding: EdgeInsets.all(12.w),
          decoration: BoxDecoration(
            color: mine ? C.primary : C.bg,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(R.lg), topRight: Radius.circular(R.lg),
              bottomLeft: Radius.circular(mine ? R.lg : 4.r), bottomRight: Radius.circular(mine ? 4.r : R.lg),
            ),
            border: mine ? null : Border.all(color: C.border),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (!mine && t.broadcast) Text(m.sender, style: T.smallStrong.copyWith(color: C.primary)),
            if (m.text.isNotEmpty) Text(m.text, style: T.body.copyWith(color: mine ? Colors.white : C.ink, fontSize: 14.sp)),
            if (att != null) Padding(padding: EdgeInsets.only(top: 8.h), child: AppFileChip(name: att.name, size: att.size, sub: 'PDF Document')),
            SizedBox(height: 4.h),
            Align(
              alignment: Alignment.centerRight,
              widthFactor: 1,
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(clock(m.ts), style: T.small.copyWith(color: mine ? Colors.white70 : C.slate, fontSize: 10.5.sp)),
                if (mine) ...[SizedBox(width: 4.w), Icon(Icons.done_all_rounded, size: 13.r, color: Colors.white70)],
              ]),
            ),
          ]),
        ),
      ));
    }
    return out;
  }
}
