import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../family/models/family_models.dart';
import '../../family/screens/widgets/parent_tab_header.dart';
import '../bloc/messages_bloc.dart';
import '../models/message_models.dart';
import 'widgets/thread_tile.dart';

enum _Sort { recent, unreadFirst }

/// Messages tab (Figma 4): search, filter tabs, conversations (pinned first, unread badges, role tags),
/// drafts and the New Chat button.
class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context) => Column(
    children: [
      const ParentTabHeader(title: 'Messages'),
      Expanded(
        child: ChildDataView<MessagesBloc, MessagesOverview>(
          create: () => getIt<MessagesBloc>(),
          refreshable: false,
          builder: (context, data, child) =>
              _MessagesBody(data: data, child: child),
        ),
      ),
    ],
  );
}

class _MessagesBody extends StatefulWidget {
  const _MessagesBody({required this.data, required this.child});
  final MessagesOverview data;
  final Child child;

  @override
  State<_MessagesBody> createState() => _MessagesBodyState();
}

class _MessagesBodyState extends State<_MessagesBody> {
  final _search = TextEditingController();
  String _query = '';
  MessageFilter _filter = MessageFilter.all;
  _Sort _sort = _Sort.recent;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<MessageThread> get _visible {
    final list = filterThreads(
      widget.data.threads,
      query: _query,
      filter: _filter,
    );
    if (_sort == _Sort.unreadFirst) {
      list.sort((a, b) {
        final u = (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0);
        return u != 0 ? u : b.lastAt.compareTo(a.lastAt);
      });
    }
    return list;
  }

  void _open(MessageThread t) =>
      context.push(RoutePaths.chatWith(t.id, teacher: t.teacher, role: t.role));

  Future<void> _threadActions(MessageThread t) async {
    final bloc = context.read<MessagesBloc>();
    final action = await showAppSheet<String>(
      context,
      useRootNavigator: true,
      title: t.teacher,
      subtitle: t.subtitle,
      builder: (ctx) => Column(
        children: [
          _SheetAction(
            icon: t.pinned ? Icons.push_pin_outlined : Icons.push_pin_rounded,
            label: t.pinned ? 'Unpin conversation' : 'Pin to top',
            onTap: () => Navigator.pop(ctx, 'pin'),
          ),
          if (t.unread > 0)
            _SheetAction(
              icon: Icons.mark_chat_read_outlined,
              label: 'Mark as read',
              onTap: () => Navigator.pop(ctx, 'read'),
            ),
          _SheetAction(
            icon: Icons.chat_outlined,
            label: 'Open conversation',
            onTap: () => Navigator.pop(ctx, 'open'),
          ),
        ],
      ),
    );
    if (!mounted) return;
    switch (action) {
      case 'pin':
        bloc.add(PinThread(t.id, pinned: !t.pinned));
        AppDialogs.showSnackBar(
          context,
          message: t.pinned ? 'Conversation unpinned' : 'Pinned to top',
        );
      case 'read':
        bloc.add(MarkThreadRead(t.id));
        AppDialogs.showSnackBar(context, message: 'Marked as read');
      case 'open':
        _open(t);
    }
  }

  Future<void> _options() async {
    final bloc = context.read<MessagesBloc>();
    final unread = widget.data.unreadThreads;
    final result = await showAppSheet<Object>(
      context,
      useRootNavigator: true,
      title: 'Sort & filter',
      subtitle: 'Choose how conversations are listed.',
      builder: (ctx) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('SORT BY', style: T.capsMuted),
          SizedBox(height: 8.h),
          AppChoiceChips(
            items: const ['Most recent', 'Unread first'],
            value: _sort == _Sort.recent ? 'Most recent' : 'Unread first',
            check: true,
            onChanged: (v) => Navigator.pop(
              ctx,
              v == 'Most recent' ? _Sort.recent : _Sort.unreadFirst,
            ),
          ),
          SizedBox(height: 18.h),
          AppButton(
            unread == 0 ? 'Everything is read' : 'Mark all as read ($unread)',
            icon: Icons.done_all_rounded,
            kind: BtnKind.soft,
            onPressed: unread == 0 ? null : () => Navigator.pop(ctx, 'all'),
          ),
        ],
      ),
    );
    if (!mounted) return;
    if (result is _Sort) setState(() => _sort = result);
    if (result == 'all') {
      bloc.add(const MarkAllThreadsRead());
      AppDialogs.showSnackBar(
        context,
        message: 'All conversations marked as read',
      );
    }
  }

  Future<void> _drafts() async {
    final bloc = context.read<MessagesBloc>();
    final drafts = widget.data.drafts;
    final picked = await showAppSheet<Object>(
      context,
      useRootNavigator: true,
      title: 'Drafts',
      subtitle: drafts.isEmpty
          ? 'No unsent messages.'
          : 'Tap a draft to continue writing.',
      builder: (ctx) => Column(
        children: [
          for (final d in drafts)
            Padding(
              padding: EdgeInsets.only(bottom: 10.h),
              child: AppFileChip(
                key: ValueKey('draft-${d.id}'),
                name: d.title,
                icon: Icons.edit_note_rounded,
                tone: Tone.brand,
                size: d.category.label,
                sub: 'Saved ${relTime(d.updatedAt)}',
                onTap: () => Navigator.pop(ctx, d),
                trailing: IconButton(
                  tooltip: 'Delete draft',
                  onPressed: () => Navigator.pop(ctx, 'delete:${d.id}'),
                  icon: Icon(
                    Icons.delete_outline_rounded,
                    size: 20.r,
                    color: C.slate,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
    if (!mounted) return;
    if (picked is MessageDraft) {
      context.push(RoutePaths.newMessageWith(draft: picked.id));
    } else if (picked is String && picked.startsWith('delete:')) {
      bloc.add(DeleteDraft(picked.substring(7)));
      AppDialogs.showSnackBar(context, message: 'Draft deleted');
    }
  }

  @override
  Widget build(BuildContext context) {
    final threads = _visible;
    final data = widget.data;
    return Stack(
      children: [
        ListView(
          key: const Key('messages-list'),
          padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 170.h),
          children: [
            AppSearchField(
              controller: _search,
              hint: 'Search teachers, office, notices...',
              onChanged: (v) => setState(() => _query = v),
              trailing: Tooltip(
                message: 'Sort & filter',
                child: Material(
                  color: C.bg,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(R.md),
                    side: const BorderSide(color: C.border),
                  ),
                  child: InkWell(
                    key: const Key('messages-options'),
                    borderRadius: BorderRadius.circular(R.md),
                    onTap: _options,
                    child: SizedBox(
                      width: 48.r,
                      height: 48.r,
                      child: Icon(Icons.tune_rounded, size: 22.r, color: C.ink),
                    ),
                  ),
                ),
              ),
            ),
            SizedBox(height: 10.h),
            AppSolidChips(
              items: [for (final f in MessageFilter.values) f.label],
              value: _filter.label,
              labelOf: (l) {
                if (l != MessageFilter.unread.label) return l;
                final n = data.unreadThreads;
                return n == 0 ? l : '$l  $n';
              },
              onChanged: (l) => setState(
                () => _filter = MessageFilter.values.firstWhere(
                  (f) => f.label == l,
                ),
              ),
            ),
            SizedBox(height: 10.h),
            if (threads.isEmpty)
              AppEmptyState(
                _query.isNotEmpty
                    ? 'No matches for "$_query"'
                    : (_filter == MessageFilter.unread
                          ? 'All caught up'
                          : 'No conversations yet'),
                hint: _query.isNotEmpty
                    ? 'Try a teacher name, office or subject.'
                    : 'Start a new chat with a teacher or the school office.',
                icon: _filter == MessageFilter.unread
                    ? Icons.mark_chat_read_outlined
                    : Icons.chat_bubble_outline_rounded,
              ),
            for (final t in threads)
              Padding(
                padding: EdgeInsets.only(bottom: 12.h),
                child: ThreadTile(
                  key: ValueKey('thread-${t.id}'),
                  thread: t,
                  onTap: () => _open(t),
                  onLongPress: () => _threadActions(t),
                ),
              ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                key: const Key('messages-drafts'),
                onPressed: _drafts,
                child: Text(
                  'Drafts (${data.drafts.length})',
                  style: T.bodyStrong.copyWith(color: C.primary),
                ),
              ),
            ),
          ],
        ),
        Positioned(
          right: S.page,
          bottom: 100.h,
          child: FloatingActionButton.extended(
            key: const Key('messages-new-chat'),
            heroTag: 'messages-new-chat',
            onPressed: () => context.push(RoutePaths.newMessage),
            backgroundColor: C.primary,
            foregroundColor: Colors.white,
            elevation: 6,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(R.pill),
            ),
            icon: Icon(Icons.edit_square, size: 20.r),
            label: Text('New Chat', style: T.button),
          ),
        ),
      ],
    );
  }
}

class _SheetAction extends StatelessWidget {
  const _SheetAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    minTileHeight: 52.h,
    leading: IconTile(icon, size: 40),
    title: Text(label, style: T.bodyStrong),
    onTap: onTap,
  );
}
