import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/engage_notice.dart';
import '../bloc/messages_bloc.dart';
import '../bloc/messages_events.dart';
import '../bloc/messages_states.dart';
import '../models/message_models.dart';
import 'widgets/engage_widgets.dart';
import 'widgets/message_widgets.dart';

/// Figma 5.11 Messages: searchable, filterable, sortable inbox (pinned first).
class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MessagesBloc>()..add(const MessagesLoadRequested()),
        child: const NoticeListener<MessagesBloc, MessagesState>(child: _MessagesView()),
      );
}

class _MessagesView extends StatefulWidget {
  const _MessagesView();
  @override
  State<_MessagesView> createState() => _MessagesViewState();
}

class _MessagesViewState extends State<_MessagesView> {
  int tab = 0, sort = 0;
  String q = '';

  static const _sorts = ['Recent', 'Unread', 'Name'];

  List<MessageThread> _rows(List<MessageThread> all) {
    final query = q.toLowerCase();
    final rows = all.where((t) {
      final hit = q.isEmpty || '${t.name} ${t.role} ${t.subject} ${t.last?.text ?? ''}'.toLowerCase().contains(query);
      final ok = switch (tab) { 1 => t.unread > 0, 2 => t.kind == 'parent' || t.broadcast, 3 => t.kind == 'student', 4 => t.kind == 'staff', _ => true };
      return hit && ok;
    }).toList();
    rows.sort((a, b) {
      if (b.pinned != a.pinned) return b.pinned ? 1 : -1;
      return switch (sort) {
        1 => b.unread != a.unread ? b.unread.compareTo(a.unread) : b.lastAt.compareTo(a.lastAt),
        2 => a.name.compareTo(b.name),
        _ => b.lastAt.compareTo(a.lastAt),
      };
    });
    return rows;
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<MessagesBloc>().state;
    final all = s.threads;
    final rows = _rows(all);
    final tabs = ['All (${all.length})', 'Unread (${s.unreadThreads})', 'Parents', 'Students', 'Faculty & Staff'];
    return DetailScaffold(
      title: 'Messages',
      fab: FloatingActionButton(
        tooltip: 'New message', backgroundColor: C.primary, foregroundColor: Colors.white,
        onPressed: () => context.push(RoutePaths.messageNew), child: Icon(Icons.add_rounded, size: 26.r),
      ),
      body: s.status != EngageStatus.loaded
          ? EngageStatusBody(status: s.status, error: s.error, onRetry: () => context.read<MessagesBloc>().add(const MessagesLoadRequested()))
          : ListView(padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 96.h), children: [
              AppSearchField(hint: 'Search parents, teachers, notices...', onChanged: (v) => setState(() => q = v.trim())),
              SizedBox(height: 12.h),
              IdxChips(items: tabs, index: tab, onChanged: (i) => setState(() => tab = i)),
              Padding(
                padding: EdgeInsets.fromLTRB(2.w, 18.h, 2.w, 10.h),
                child: Row(children: [
                  Flexible(child: Text('All Conversations', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  SizedBox(width: 8.w),
                  Pill('${rows.length} chat${rows.length == 1 ? '' : 's'}', tone: Tone.brand),
                  const Spacer(),
                  PopupMenuButton<int>(
                    tooltip: 'Sort conversations', initialValue: sort, onSelected: (v) => setState(() => sort = v),
                    itemBuilder: (_) => [for (var i = 0; i < _sorts.length; i++) PopupMenuItem(value: i, child: Text(i == 1 ? 'Unread first' : _sorts[i]))],
                    child: ConstrainedBox(
                      constraints: BoxConstraints(minHeight: 44.h),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Text('Sort by ${_sorts[sort]}', style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.sp)),
                        Icon(Icons.keyboard_arrow_down_rounded, color: C.primary, size: 18.r),
                      ]),
                    ),
                  ),
                ]),
              ),
              if (rows.isEmpty)
                AppEmptyState(q.isNotEmpty ? 'No matches' : 'No conversations',
                    hint: q.isNotEmpty ? 'Try another name or keyword.' : 'Tap + to start a new message.', icon: Icons.chat_bubble_outline_rounded),
              for (final t in rows) _ThreadCard(t),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => context.push(RoutePaths.messageDrafts),
                  child: Text('Drafts (${s.drafts.length})', style: T.bodyStrong.copyWith(color: C.primary)),
                ),
              ),
            ]),
    );
  }
}

class _ThreadCard extends StatelessWidget {
  const _ThreadCard(this.t);
  final MessageThread t;
  @override
  Widget build(BuildContext context) {
    final last = t.last;
    final unread = t.unread;
    final mine = last?.mine ?? false;
    final preview = last == null ? '' : (last.text.isEmpty && last.attach != null ? '📎 ${last.attach!.name}' : last.text);
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppCard(
        padding: EdgeInsets.all(12.w), radius: R.lg, onTap: () => context.push(RoutePaths.message(t.id)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          RecipientAvatar(name: t.name, kind: t.kind, online: t.online),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                if (t.pinned) Padding(padding: EdgeInsets.only(right: 4.w), child: Icon(Icons.push_pin_rounded, size: 13.r, color: C.primary, semanticLabel: 'Pinned')),
                Flexible(
                  child: Text(t.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: T.bodyStrong.copyWith(fontWeight: unread > 0 ? FontWeight.w800 : FontWeight.w700)),
                ),
                if (!t.broadcast) ...[SizedBox(width: 6.w), Flexible(child: Pill(t.role, tone: kindTone(t.kind)))],
                SizedBox(width: 6.w),
                Text(relTime(last?.ts), style: T.small.copyWith(color: unread > 0 ? C.primary : C.slate, fontWeight: unread > 0 ? FontWeight.w800 : FontWeight.w500)),
              ]),
              SizedBox(height: 3.h),
              if (t.subject.isNotEmpty) Text(t.subject, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
              Row(children: [
                if (mine) Padding(padding: EdgeInsets.only(right: 4.w), child: Icon(Icons.done_all_rounded, size: 15.r, color: C.primary)),
                Expanded(
                  child: Text(t.broadcast && !mine && last != null ? '${last.sender}: $preview' : preview,
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: T.body.copyWith(fontSize: 13.sp)),
                ),
                if (unread > 0)
                  Container(
                    margin: EdgeInsets.only(left: 6.w), padding: EdgeInsets.all(6.r),
                    decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle),
                    child: Text('$unread', style: T.small.copyWith(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 10.5.sp)),
                  )
                else if (t.hasAttachment)
                  Padding(padding: EdgeInsets.only(left: 6.w), child: Icon(Icons.attach_file_rounded, size: 16.r, color: C.slate, semanticLabel: 'Has attachment')),
              ]),
              if (t.broadcast) Padding(padding: EdgeInsets.only(top: 6.h), child: Pill(t.role, tone: Tone.neutral)),
            ]),
          ),
        ]),
      ),
    );
  }
}
