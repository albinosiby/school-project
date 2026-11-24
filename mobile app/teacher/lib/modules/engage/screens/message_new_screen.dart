import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/engage_notice.dart';
import '../bloc/messages_bloc.dart';
import '../bloc/messages_events.dart';
import '../bloc/messages_states.dart';
import '../models/message_models.dart';
import 'widgets/engage_widgets.dart';
import 'widgets/message_widgets.dart';

/// New chat: search the students the teacher teaches (grouped by class) and the staff contacts, and tap a tile
/// to open the conversation. A student's tile chats with the student's parent; the thread itself is created by
/// the first message, so nothing is stored until something is sent.
class MessageNewScreen extends StatelessWidget {
  const MessageNewScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MessagesBloc>()..add(const MessagesLoadRequested()),
        child: const _PickerView(),
      );
}

class _PickerView extends StatefulWidget {
  const _PickerView();
  @override
  State<_PickerView> createState() => _PickerViewState();
}

/// A student row: the student plus the guardian recipient the chat goes to.
class _Pupil {
  const _Pupil({required this.student, required this.guardian, required this.cls, required this.roll});
  final Recipient student;
  final Recipient? guardian;
  final String cls, roll;
  bool get canChat => guardian != null && guardian!.available;
  String get blocked => guardian == null ? 'No parent record' : guardian!.blocked;
  /// "Mr. Sharma" from the guardian recipient's "Mr. Sharma Sharma" (guardian + student surname).
  String get parentName => guardian == null ? '' : guardian!.name.split(' ').takeWhile((w) => w != student.name.split(' ').last).join(' ').trim();
  bool matches(String q) => '${student.name} $cls $roll ${guardian?.name ?? ''}'.toLowerCase().contains(q);
}

class _PickerViewState extends State<_PickerView> {
  final search = TextEditingController();
  String q = '';

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  /// Students by class label ("Class 10-B"), in the order the recipients arrive (class, then roll).
  Map<String, List<_Pupil>> _byClass(MessagesState s) {
    final out = <String, List<_Pupil>>{};
    for (final r in s.recipients.where((r) => r.kind == 'student')) {
      final parts = r.sub.split(' • ');
      final p = _Pupil(student: r, guardian: s.recipient('g_${r.id}'), cls: parts.first, roll: parts.length > 1 ? parts[1] : '');
      if (q.isNotEmpty && !p.matches(q)) continue;
      (out[p.cls] ??= []).add(p);
    }
    return out;
  }

  List<Recipient> _contacts(MessagesState s) => [
        for (final r in s.contacts)
          if (q.isEmpty || '${r.name} ${r.sub} ${r.role} ${r.extra}'.toLowerCase().contains(q)) r,
      ];

  void _open(String id) => context.pushReplacement(RoutePaths.message(id));

  @override
  Widget build(BuildContext context) {
    final s = context.watch<MessagesBloc>().state;
    final classes = _byClass(s);
    final contacts = _contacts(s);
    final total = classes.values.fold<int>(0, (n, l) => n + l.length);
    return DetailScaffold(
      title: 'New chat',
      body: s.status != EngageStatus.loaded
          ? EngageStatusBody(status: s.status, error: s.error)
          : Column(children: [
              Padding(
                padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 4.h),
                child: AppSearchField(
                  hint: 'Search student, parent or staff name',
                  controller: search,
                  onChanged: (v) => setState(() => q = v.trim().toLowerCase()),
                  trailing: q.isEmpty
                      ? null
                      : IconButton(
                          tooltip: 'Clear search',
                          icon: Icon(Icons.close_rounded, size: 18.r, color: C.slate),
                          onPressed: () => setState(() {
                            q = '';
                            search.clear();
                          }),
                        ),
                ),
              ),
              Expanded(
                child: classes.isEmpty && contacts.isEmpty
                    ? AppEmptyState(q.isEmpty ? 'No one to chat with yet' : 'No one matches', hint: q.isEmpty ? 'Students of your classes appear here once synced.' : 'Try another name, roll number or class.', icon: Icons.person_search_rounded)
                    : ListView(padding: EdgeInsets.fromLTRB(S.page, 8.h, S.page, 24.h), children: [
                        if (classes.isNotEmpty) _SectionLabel('Students you teach', count: total),
                        for (final e in classes.entries) ...[
                          _ClassHeader(label: e.key, count: e.value.length),
                          AppCard(
                            radius: R.xl,
                            padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 4.h),
                            child: Column(children: [
                              for (var i = 0; i < e.value.length; i++) ...[
                                if (i > 0) Divider(height: 1, color: C.border, indent: 58.w),
                                _StudentTile(e.value[i], onTap: e.value[i].canChat ? () => _open(e.value[i].guardian!.id) : null),
                              ],
                            ]),
                          ),
                          SizedBox(height: 10.h),
                        ],
                        if (contacts.isNotEmpty) ...[
                          _SectionLabel('Staff & contacts', count: contacts.length),
                          AppCard(
                            radius: R.xl,
                            padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 4.h),
                            child: Column(children: [
                              for (var i = 0; i < contacts.length; i++) ...[
                                if (i > 0) Divider(height: 1, color: C.border, indent: 58.w),
                                _ContactTile(contacts[i], onTap: contacts[i].available ? () => _open(contacts[i].id) : null),
                              ],
                            ]),
                          ),
                        ],
                      ]),
              ),
            ]),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text, {required this.count});
  final String text;
  final int count;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(4.w, 10.h, 4.w, 8.h),
        child: Row(children: [
          Expanded(child: Text(text.toUpperCase(), style: T.capsMuted)),
          Text('$count', style: T.capsMuted),
        ]),
      );
}

/// "Class 10-B · 32 students" above each class group.
class _ClassHeader extends StatelessWidget {
  const _ClassHeader({required this.label, required this.count});
  final String label;
  final int count;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(4.w, 2.h, 4.w, 6.h),
        child: Row(children: [
          Container(
            padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
            decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.pill)),
            child: Text(label, style: T.smallStrong.copyWith(color: C.primary)),
          ),
          SizedBox(width: 8.w),
          Text(count == 1 ? '1 student' : '$count students', style: T.small),
        ]),
      );
}

/// A student of one of the teacher's classes; tapping starts the chat with the parent. Disabled with the reason
/// when the parent has no app login yet.
class _StudentTile extends StatelessWidget {
  const _StudentTile(this.p, {required this.onTap});
  final _Pupil p;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final ok = onTap != null;
    final sub = ok ? [if (p.roll.isNotEmpty) p.roll, if (p.parentName.isNotEmpty) 'Parent: ${p.parentName}'].join(' • ') : p.blocked;
    return Semantics(
      button: true,
      enabled: ok,
      label: 'Chat with parent of ${p.student.name}',
      child: Opacity(
        opacity: ok ? 1 : .55,
        child: InkWell(
          borderRadius: BorderRadius.circular(R.md),
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 4.w, vertical: 8.h),
            child: Row(children: [
              RecipientAvatar(name: p.student.name, kind: 'student', size: 44),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p.student.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                  SizedBox(height: 2.h),
                  Text(sub, style: T.small.copyWith(color: ok ? C.slate : C.danger, fontWeight: ok ? FontWeight.w500 : FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
                ]),
              ),
              SizedBox(width: 6.w),
              Icon(ok ? Icons.chat_bubble_outline_rounded : Icons.block_rounded, color: ok ? C.primary : C.muted, size: 20.r),
            ]),
          ),
        ),
      ),
    );
  }
}

class _ContactTile extends StatelessWidget {
  const _ContactTile(this.r, {required this.onTap});
  final Recipient r;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final ok = onTap != null;
    return Semantics(
      button: true,
      enabled: ok,
      label: 'Chat with ${r.name}',
      child: Opacity(
        opacity: ok ? 1 : .55,
        child: InkWell(
          borderRadius: BorderRadius.circular(R.md),
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 4.w, vertical: 8.h),
            child: Row(children: [
              RecipientAvatar(name: r.name, kind: r.kind, online: r.online, size: 44),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(r.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                  SizedBox(height: 2.h),
                  Text(
                    ok ? [if (r.sub.isNotEmpty) r.sub else if (r.role.isNotEmpty) r.role, if (r.extra.isNotEmpty) r.extra].join(' • ') : r.blocked,
                    style: T.small.copyWith(color: ok ? C.slate : C.danger, fontWeight: ok ? FontWeight.w500 : FontWeight.w700),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ]),
              ),
              SizedBox(width: 6.w),
              Icon(ok ? Icons.chat_bubble_outline_rounded : Icons.block_rounded, color: ok ? C.primary : C.muted, size: 20.r),
            ]),
          ),
        ),
      ),
    );
  }
}
