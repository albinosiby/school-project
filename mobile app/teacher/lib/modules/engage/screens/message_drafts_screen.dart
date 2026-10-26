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

/// Figma 5.11.1.1 Message Drafts: search, filter by audience, reopen, delete one or all.
class MessageDraftsScreen extends StatelessWidget {
  const MessageDraftsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MessagesBloc>()..add(const MessagesLoadRequested()),
        child: const NoticeListener<MessagesBloc, MessagesState>(child: _DraftsView()),
      );
}

class _DraftsView extends StatefulWidget {
  const _DraftsView();
  @override
  State<_DraftsView> createState() => _DraftsViewState();
}

class _DraftsViewState extends State<_DraftsView> {
  int tab = 0;
  String q = '';

  @override
  Widget build(BuildContext context) {
    final s = context.watch<MessagesBloc>().state;
    final all = s.sortedDrafts;
    int n(String k) => all.where((d) => d.kind == k).length;
    final tabs = ['All Drafts (${all.length})', 'Parents (${n('parent')})', 'Staff & Admin (${n('staff')})', 'Class Broadcasts (${n('broadcast')})'];
    final query = q.toLowerCase();
    final shown = all.where((d) {
      final ok = switch (tab) { 1 => d.kind == 'parent', 2 => d.kind == 'staff', 3 => d.kind == 'broadcast', _ => true };
      return ok && (q.isEmpty || '${d.toLabel} ${d.subject} ${d.body}'.toLowerCase().contains(query));
    }).toList();
    final bloc = context.read<MessagesBloc>();
    return DetailScaffold(
      title: 'Drafts',
      bottom: Row(children: [
        Expanded(
          child: AppButton('Delete All', icon: Icons.delete_sweep_outlined, kind: BtnKind.outline, onPressed: all.isEmpty
              ? null
              : () async {
                  final ok = await confirmAction(context, title: 'Delete all drafts?', message: '${all.length} drafts will be permanently deleted.', confirm: 'Delete all', danger: true);
                  if (ok) bloc.add(const AllDraftsDeleted());
                }),
        ),
        SizedBox(width: 10.w),
        Expanded(child: AppButton('New Message', icon: Icons.edit_outlined, onPressed: () => context.push(RoutePaths.messageNew))),
      ]),
      body: s.status != EngageStatus.loaded
          ? EngageStatusBody(status: s.status, error: s.error)
          : ListView(padding: EdgeInsets.all(S.page), children: [
              AppSearchField(hint: 'Search drafts, recipients, subjects...', onChanged: (v) => setState(() => q = v.trim())),
              SizedBox(height: 12.h),
              IdxChips(items: tabs, index: tab, onChanged: (i) => setState(() => tab = i)),
              SizedBox(height: 12.h),
              AppCard(
                padding: EdgeInsets.all(12.w), color: C.primarySoft, border: C.panelBorder, radius: R.lg,
                child: Row(children: [
                  Icon(Icons.cloud_done_rounded, color: C.primary, size: 22.r),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Cloud Auto-Sync Active', style: T.bodyStrong.copyWith(color: C.primary)),
                      Text('${all.length} message draft${all.length == 1 ? '' : 's'} preserved safely across devices', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
                    ]),
                  ),
                  Icon(Icons.sync_rounded, color: C.primary.withValues(alpha: .5), size: 20.r),
                ]),
              ),
              SizedBox(height: 12.h),
              if (shown.isEmpty) const AppEmptyState('No drafts', hint: 'Drafts you save while composing appear here.', icon: Icons.drafts_outlined),
              for (final d in shown) _DraftCard(d),
            ]),
    );
  }
}

class _DraftCard extends StatelessWidget {
  const _DraftCard(this.d);
  final MessageDraft d;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 10.h),
        child: AppCard(
          padding: EdgeInsets.fromLTRB(12.w, 12.h, 4.w, 12.h), radius: R.lg,
          onTap: () => context.push(Uri(path: RoutePaths.messageNew, queryParameters: {'draft': d.id}).toString()),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            RecipientAvatar(name: d.toLabel, kind: d.kind, size: 44),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text(d.toLabel, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  if (d.role.isNotEmpty) ...[SizedBox(width: 6.w), Flexible(child: Pill(d.role, tone: kindTone(d.kind)))],
                ]),
                if (d.sub.isNotEmpty) Text(d.sub, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                SizedBox(height: 6.h),
                Row(children: [
                  Icon(Icons.subject_rounded, size: 15.r, color: C.primary),
                  SizedBox(width: 4.w),
                  Expanded(
                    child: Text(d.subject.isEmpty ? '(No subject)' : d.subject, style: T.smallStrong.copyWith(fontSize: 12.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                ]),
                Text(d.body, style: T.small.copyWith(fontSize: 11.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Padding(padding: EdgeInsets.only(right: 8.w), child: Text(relTime(d.ts), style: T.small.copyWith(fontSize: 11.sp))),
              IconButton(
                tooltip: 'Delete draft', icon: Icon(Icons.delete_outline, color: C.danger, size: 20.r),
                onPressed: () async {
                  final bloc = context.read<MessagesBloc>();
                  final ok = await confirmAction(context, title: 'Delete draft?', message: 'This draft will be permanently deleted.', confirm: 'Delete', danger: true);
                  if (ok) bloc.add(DraftDeleted(d.id));
                },
              ),
            ]),
          ]),
        ),
      );
}
