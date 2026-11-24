import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../home/screens/widgets/teacher_tab_header.dart';
import '../bloc/engage_notice.dart';
import '../bloc/messages_bloc.dart';
import '../bloc/messages_events.dart';
import '../bloc/messages_states.dart';
import '../models/message_models.dart';
import 'widgets/engage_widgets.dart';
import 'widgets/message_widgets.dart';

/// Figma 5.11 Messages, shown as the Chat tab: searchable, filterable inbox with pinned conversations first.
class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key, this.tab = false});
  /// True on the Chat tab (tab header, dock padding); false when pushed (back arrow).
  final bool tab;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MessagesBloc>()..add(const MessagesLoadRequested()),
        child: NoticeListener<MessagesBloc, MessagesState>(child: _MessagesView(tab: tab)),
      );
}

class _MessagesView extends StatefulWidget {
  const _MessagesView({required this.tab});
  final bool tab;
  @override
  State<_MessagesView> createState() => _MessagesViewState();
}

class _MessagesViewState extends State<_MessagesView> {
  int tab = 0, sort = 0;
  String q = '';

  static const _sorts = ['Recent', 'Unread first', 'Name'];

  List<MessageThread> _rows(List<MessageThread> all) {
    final query = q.toLowerCase();
    final rows = all.where((t) {
      final hit = q.isEmpty || '${t.name} ${t.studentName} ${t.role} ${t.subject} ${t.last?.text ?? ''}'.toLowerCase().contains(query);
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
    final pinned = rows.where((t) => t.pinned).toList(), others = rows.where((t) => !t.pinned).toList();
    int kindCount(bool Function(MessageThread) f) => all.where(f).length;
    final tabs = ['All (${all.length})', 'Unread (${s.unreadThreads})', 'Parents', 'Students', 'Faculty & Staff'];
    final tabIcons = [Icons.forum_outlined, Icons.mark_chat_unread_outlined, Icons.family_restroom_rounded, Icons.school_outlined, Icons.badge_outlined];
    final tabCounts = [null, null, kindCount((t) => t.kind == 'parent' || t.broadcast), kindCount((t) => t.kind == 'student'), kindCount((t) => t.kind == 'staff')];
    final dock = widget.tab && AppNavScope.hasDock(context);

    final fab = FloatingActionButton.extended(
      tooltip: 'New chat',
      backgroundColor: C.primary,
      foregroundColor: Colors.white,
      onPressed: () => context.push(RoutePaths.messageNew),
      icon: Icon(Icons.edit_outlined, size: 20.r),
      label: Text('New', style: T.button),
    );

    final controls = Padding(
      padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        AppSearchField(hint: 'Search parents, teachers, notices…', onChanged: (v) => setState(() => q = v.trim())),
        SizedBox(height: 12.h),
        _FilterBar(items: tabs, icons: tabIcons, counts: tabCounts, index: tab, onChanged: (i) => setState(() => tab = i)),
        SizedBox(height: 4.h),
        // Toolbar: unread summary and sort.
        Row(children: [
          Expanded(
            child: Text(
              s.unreadThreads == 0 ? 'All caught up' : '${s.unreadThreads} unread conversation${s.unreadThreads == 1 ? '' : 's'}',
              style: T.small,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          PopupMenuButton<int>(
            tooltip: 'Sort conversations',
            initialValue: sort,
            onSelected: (v) => setState(() => sort = v),
            itemBuilder: (_) => [for (var i = 0; i < _sorts.length; i++) PopupMenuItem(value: i, child: Text(_sorts[i]))],
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 8.h),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.swap_vert_rounded, size: 18.r, color: C.slate),
                SizedBox(width: 4.w),
                Text(_sorts[sort], style: T.smallStrong.copyWith(color: C.slate)),
              ]),
            ),
          ),
        ]),
      ]),
    );

    final body = s.status != EngageStatus.loaded
        ? EngageStatusBody(status: s.status, error: s.error, onRetry: () => context.read<MessagesBloc>().add(const MessagesLoadRequested()))
        : ListView(
            padding: EdgeInsets.only(bottom: dock ? 150.h : 96.h),
            children: [
              controls,
              if (rows.isEmpty)
                Padding(
                  padding: EdgeInsets.all(S.page),
                  child: AppCard(
                    child: AppEmptyState(
                      q.isNotEmpty ? 'No matches' : 'No conversations',
                      hint: q.isNotEmpty ? 'Try another name or keyword.' : 'Tap New to start a conversation.',
                      icon: Icons.chat_bubble_outline_rounded,
                    ),
                  ),
                ),
              if (pinned.isNotEmpty) ...[
                _GroupLabel('Pinned', Icons.push_pin_rounded),
                _ThreadList(pinned),
              ],
              if (others.isNotEmpty) ...[
                _GroupLabel(pinned.isNotEmpty ? 'Recent' : 'Conversations', Icons.forum_outlined),
                _ThreadList(others),
              ],
            ],
          );

    if (!widget.tab) return DetailScaffold(title: 'Messages', fab: fab, body: body);
    // Chat tab: the shell's scaffold hosts the dock, so only the header, body and FAB are built here.
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(children: [
        const TeacherTabHeader(title: 'Chat', subtitle: 'Parents, students and staff', icon: Icons.chat_bubble_outline_rounded),
        Expanded(child: body),
      ]),
      floatingActionButton: Padding(padding: EdgeInsets.only(bottom: dock ? 104.h : 0), child: fab),
    );
  }
}

/// Horizontal filter pills with an icon and, for the kinds, a count badge.
class _FilterBar extends StatelessWidget {
  const _FilterBar({required this.items, required this.icons, required this.counts, required this.index, required this.onChanged});
  final List<String> items;
  final List<IconData> icons;
  final List<int?> counts;
  final int index;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 38.h,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          clipBehavior: Clip.none,
          itemCount: items.length,
          separatorBuilder: (_, _) => SizedBox(width: 8.w),
          itemBuilder: (_, i) {
            final on = i == index;
            return Semantics(
              button: true,
              selected: on,
              label: items[i],
              child: InkWell(
                borderRadius: BorderRadius.circular(R.pill),
                onTap: () => onChanged(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: EdgeInsets.symmetric(horizontal: 12.w),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: on ? C.primary : C.bg, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: on ? C.primary : C.border)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(icons[i], size: 15.r, color: on ? Colors.white : C.slate),
                    SizedBox(width: 6.w),
                    Text(items[i], style: T.smallStrong.copyWith(color: on ? Colors.white : C.ink, fontSize: 12.5.sp)),
                    if (counts[i] != null && counts[i]! > 0) ...[
                      SizedBox(width: 6.w),
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 1.h),
                        decoration: BoxDecoration(color: on ? Colors.white.withValues(alpha: .22) : C.surface, borderRadius: BorderRadius.circular(R.pill)),
                        child: Text('${counts[i]}', style: T.small.copyWith(color: on ? Colors.white : C.slate, fontWeight: FontWeight.w800, fontSize: 10.5.sp)),
                      ),
                    ],
                  ]),
                ),
              ),
            );
          },
        ),
      );
}

class _GroupLabel extends StatelessWidget {
  const _GroupLabel(this.title, this.icon);
  final String title;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(S.page + 2.w, 16.h, S.page, 6.h),
        child: Row(children: [
          Icon(icon, size: 14.r, color: C.slate),
          SizedBox(width: 6.w),
          Text(title.toUpperCase(), style: T.capsMuted),
        ]),
      );
}

/// Flat, full-width conversation rows separated by hairlines (messenger style).
class _ThreadList extends StatelessWidget {
  const _ThreadList(this.threads);
  final List<MessageThread> threads;
  @override
  Widget build(BuildContext context) => Column(children: [
        for (var i = 0; i < threads.length; i++) ...[
          if (i > 0) Divider(height: 1, color: C.border, indent: S.page + 64.w, endIndent: S.page),
          _ThreadRow(threads[i]),
        ],
      ]);
}

class _ThreadRow extends StatelessWidget {
  const _ThreadRow(this.t);
  final MessageThread t;
  @override
  Widget build(BuildContext context) {
    final msg = t.last;
    final unread = t.unread;
    final mine = msg?.mine ?? false;
    final preview = msg == null
        ? ''
        : msg.text.isNotEmpty
            ? msg.text
            : msg.meeting != null
                ? (msg.meeting!.cancelled ? '📅 Meeting cancelled' : '📅 Meeting scheduled')
                : msg.attach == null
                    ? ''
                    : msg.attach!.isAudio
                        ? '🎤 Voice note'
                        : msg.attach!.isImage
                            ? '📷 Photo'
                            : '📎 ${msg.attach!.name}';
    final who = t.broadcast && !mine && msg != null ? '${msg.sender}: ' : (mine ? 'You: ' : '');
    final tone = kindTone(t.kind);
    return Material(
      color: unread > 0 ? C.primarySoft.withValues(alpha: .4) : Colors.transparent,
      child: InkWell(
        onTap: () => context.push(RoutePaths.message(t.id)),
        child: Padding(
          padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 12.h),
          child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
            RecipientAvatar(name: t.name, kind: t.kind, online: t.online, size: 52, image: t.photo),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                  if (t.pinned) Padding(padding: EdgeInsets.only(right: 4.w), child: Icon(Icons.push_pin_rounded, size: 13.r, color: C.primary, semanticLabel: 'Pinned')),
                  Expanded(
                    child: Text(t.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: T.bodyStrong.copyWith(fontSize: 15.5.sp, fontWeight: unread > 0 ? FontWeight.w800 : FontWeight.w600)),
                  ),
                  SizedBox(width: 8.w),
                  Text(relTime(msg?.ts), style: T.small.copyWith(fontSize: 11.sp, color: unread > 0 ? C.primary : C.muted, fontWeight: unread > 0 ? FontWeight.w700 : FontWeight.w500)),
                ]),
                SizedBox(height: 3.h),
                Row(children: [
                  Container(width: 6.r, height: 6.r, margin: EdgeInsets.only(right: 6.w), decoration: BoxDecoration(color: toneColors(tone).fg, shape: BoxShape.circle)),
                  Expanded(
                    child: Text(
                      [t.subtitle, if (t.subject.isNotEmpty) t.subject].join(' • '),
                      style: T.small.copyWith(fontSize: 11.5.sp),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ]),
                SizedBox(height: 3.h),
                Row(children: [
                  if (mine) Padding(padding: EdgeInsets.only(right: 4.w), child: Icon(Icons.done_all_rounded, size: 15.r, color: C.primary)),
                  Expanded(
                    child: Text('$who$preview', maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: T.body.copyWith(fontSize: 13.5.sp, color: unread > 0 ? C.ink : C.slate, fontWeight: unread > 0 ? FontWeight.w600 : FontWeight.w400)),
                  ),
                  if (unread > 0)
                    Container(
                      margin: EdgeInsets.only(left: 8.w),
                      constraints: BoxConstraints(minWidth: 22.r),
                      padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 3.h),
                      decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(R.pill)),
                      child: Text('$unread', textAlign: TextAlign.center, style: T.small.copyWith(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 10.5.sp)),
                    )
                  else if (t.hasAttachment)
                    Padding(padding: EdgeInsets.only(left: 6.w), child: Icon(Icons.attach_file_rounded, size: 16.r, color: C.muted, semanticLabel: 'Has attachment')),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
