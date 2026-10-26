import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/engage_notice.dart';
import '../bloc/messages_bloc.dart';
import '../bloc/messages_events.dart';
import '../bloc/messages_states.dart';
import '../models/attachment_models.dart';
import '../models/message_models.dart';
import 'widgets/engage_widgets.dart';
import 'widgets/file_upload_sheet.dart';
import 'widgets/message_widgets.dart';

/// Figma 5.11.1 New Message: recipients (contacts, or students / guardians when searching), category, subject,
/// body with character count, attachments; Send or Save Draft. [draftId] reopens a draft, [to] preselects a recipient.
class MessageNewScreen extends StatelessWidget {
  const MessageNewScreen({super.key, this.draftId, this.to});
  final String? draftId, to;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MessagesBloc>()..add(const MessagesLoadRequested()),
        child: NoticeListener<MessagesBloc, MessagesState>(child: _ComposeView(draftId: draftId, to: to)),
      );
}

class _ComposeView extends StatefulWidget {
  const _ComposeView({this.draftId, this.to});
  final String? draftId, to;
  @override
  State<_ComposeView> createState() => _ComposeViewState();
}

class _ComposeViewState extends State<_ComposeView> {
  final subject = TextEditingController(), body = TextEditingController();
  List<String> to = [];
  List<FileRef> attach = [];
  String category = 'Academic Query', filter = 'All', q = '';
  String? err;
  bool filled = false;
  static const max = 800;
  static const _filters = ['All', 'Parents (10-B)', 'Students', 'Teachers / Staff', 'Broadcast Group'];
  static const _categories = ['Academic Query', 'Attendance Notice', 'Fee / Admin', 'Urgent'];

  @override
  void initState() {
    super.initState();
    if (widget.to != null) to = [widget.to!];
  }

  @override
  void dispose() {
    subject.dispose();
    body.dispose();
    super.dispose();
  }

  /// Fills the form from the draft once the BLoC has loaded.
  void _fill(MessagesState s) {
    if (filled || s.status != EngageStatus.loaded) return;
    filled = true;
    final d = widget.draftId == null ? null : s.draft(widget.draftId!);
    if (d == null) return;
    to = [...d.to];
    subject.text = d.subject;
    body.text = d.body;
    if (d.category.isNotEmpty) category = d.category;
    attach = [...d.attach];
  }

  void _toggle(String id) => setState(() {
        to.contains(id) ? to.remove(id) : to.add(id);
        err = null;
      });

  void _saveDraft(MessagesState s) {
    if (to.isEmpty && subject.text.trim().isEmpty && body.text.trim().isEmpty) {
      setState(() => err = 'Add a recipient or some text before saving a draft');
      return;
    }
    final first = to.isEmpty ? null : s.recipient(to.first);
    final names = [for (final id in to) s.recipient(id)?.name ?? ''];
    context.read<MessagesBloc>().add(DraftSaved(MessageDraft(
          id: widget.draftId ?? '', to: [...to],
          toLabel: names.isEmpty ? 'No recipient' : (names.length > 2 ? '${names.first} +${names.length - 1}' : names.join(', ')),
          role: first?.role ?? '', sub: first?.sub ?? '', kind: first?.kind ?? 'parent', category: category,
          subject: subject.text.trim(), body: body.text.trim(), attach: [...attach],
        )));
  }

  void _send() {
    final text = body.text.trim();
    if (to.isEmpty) return setState(() => err = 'Select at least one recipient');
    if (text.isEmpty) return setState(() => err = 'Write a message before sending');
    if (text.length > max) return setState(() => err = 'Message is longer than $max characters');
    context.read<MessagesBloc>().add(MessageSent(to: [...to], text: text, subject: subject.text, attach: [...attach], draftId: widget.draftId));
  }

  List<Recipient> _options(MessagesState s) {
    final query = q.toLowerCase();
    final contacts = s.contacts;
    final out = <Recipient>[...contacts];
    if (q.length >= 2) {
      out.addAll(s.recipients.skip(contacts.length).where((r) => '${r.name} ${r.sub}'.toLowerCase().contains(query)).take(40));
    }
    return out.where((r) {
      final kindOk = switch (filter) {
        'Parents (10-B)' => r.kind == 'parent', 'Students' => r.kind == 'student', 'Teachers / Staff' => r.kind == 'staff', 'Broadcast Group' => r.broadcast, _ => true,
      };
      return kindOk && (q.isEmpty || '${r.name} ${r.sub} ${r.role}'.toLowerCase().contains(query));
    }).toList();
  }

  Future<void> _attach() async {
    final r = await showFileUploadSheet(context, attach);
    if (r != null) setState(() => attach = r);
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<MessagesBloc>().state;
    _fill(s);
    final opts = _options(s);
    final len = body.text.length;
    final noBorder = InputBorder.none;
    return DetailScaffold(
      title: 'New Message',
      actions: [TextButton(onPressed: () => _saveDraft(s), child: Text('Save Draft', style: T.bodyStrong.copyWith(color: C.primary)))],
      bottom: AppButton('Send Message', icon: Icons.send_rounded, onPressed: _send),
      body: s.status != EngageStatus.loaded
          ? EngageStatusBody(status: s.status, error: s.error)
          : ListView(padding: EdgeInsets.all(S.page), children: [
              if (err != null) Padding(padding: EdgeInsets.only(bottom: 10.h), child: Text(err!, style: T.small.copyWith(color: C.danger, fontWeight: FontWeight.w700))),
              AppCard(
                padding: EdgeInsets.all(12.w),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(padding: EdgeInsets.only(top: 8.h), child: Text('To:', style: T.bodyStrong.copyWith(color: C.slate))),
                    SizedBox(width: 8.w),
                    Expanded(
                      child: Wrap(spacing: 6.w, runSpacing: 6.h, children: [
                        for (final id in to)
                          InputChip(
                            label: Text(s.recipient(id)?.name ?? id, style: T.small.copyWith(color: C.primary, fontWeight: FontWeight.w700)),
                            backgroundColor: C.primarySoft, side: BorderSide.none, deleteIconColor: C.primary,
                            deleteButtonTooltipMessage: 'Remove ${s.recipient(id)?.name ?? id}', onDeleted: () => _toggle(id),
                          ),
                      ]),
                    ),
                    Icon(Icons.person_add_alt_1_outlined, color: C.primary, size: 22.r),
                  ]),
                  TextField(
                    onChanged: (v) => setState(() => q = v.trim()),
                    decoration: InputDecoration(
                      hintText: 'Type name, roll no, or role...', prefixIcon: Icon(Icons.search_rounded, size: 20.r),
                      filled: false, border: noBorder, enabledBorder: noBorder, focusedBorder: noBorder,
                    ),
                  ),
                  FilterChips(items: _filters, value: filter, onChanged: (f) => setState(() => filter = f)),
                ]),
              ),
              SectionHeader('Recent & Frequent', caps: true, action: 'Browse All', onAction: () => setState(() {
                    filter = 'All';
                    q = '';
                  })),
              SizedBox(
                height: 48.h,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal, itemCount: s.contacts.take(5).length, separatorBuilder: (_, _) => SizedBox(width: 8.w),
                  itemBuilder: (_, i) {
                    final r = s.contacts[i];
                    final on = to.contains(r.id);
                    return Semantics(
                      button: true, selected: on, label: on ? 'Remove ${r.name}' : 'Add ${r.name}',
                      child: InkWell(
                        borderRadius: BorderRadius.circular(R.pill),
                        onTap: () => _toggle(r.id),
                        child: Container(
                          padding: EdgeInsets.fromLTRB(4.w, 4.h, 10.w, 4.h),
                          decoration: BoxDecoration(color: on ? C.primarySoft : C.bg, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: on ? C.primary : C.border)),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            RecipientAvatar(name: r.name, kind: r.kind, size: 32, selected: on),
                            SizedBox(width: 6.w),
                            Text(r.name.split(' ').take(2).join(' '), style: T.smallStrong.copyWith(color: on ? C.primary : C.ink)),
                            SizedBox(width: 4.w),
                            Icon(on ? Icons.check_rounded : Icons.add_rounded, size: 16.r, color: on ? C.primary : C.slate),
                          ]),
                        ),
                      ),
                    );
                  },
                ),
              ),
              SizedBox(height: 16.h),
              AppCard(
                padding: EdgeInsets.all(12.w),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('CONTEXT / CATEGORY', style: T.capsMuted),
                  SizedBox(height: 8.h),
                  AppChoiceChips(items: _categories, value: category, onChanged: (v) => setState(() => category = v)),
                  SizedBox(height: 14.h),
                  AppTextField(label: 'Subject Line (Optional)', controller: subject, hint: 'e.g. Regarding Math Remedial Class'),
                  Container(
                    padding: EdgeInsets.all(12.w),
                    decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      TextField(
                        controller: body, maxLines: 6, minLines: 4, onChanged: (_) => setState(() => err = null),
                        decoration: InputDecoration(hintText: 'Write your message...', filled: false, isDense: true, border: noBorder, enabledBorder: noBorder, focusedBorder: noBorder),
                      ),
                      Row(children: [
                        Icon(Icons.auto_awesome_rounded, size: 14.r, color: len > 0 ? C.successDark : C.muted),
                        SizedBox(width: 4.w),
                        Expanded(
                          child: Text(len > 0 ? 'AI Assist: Tone checked (Polite & Encouraging)' : 'AI Assist: waiting for your message',
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small.copyWith(color: len > 0 ? C.successDark : C.slate, fontSize: 11.sp)),
                        ),
                        Text('$len/$max', style: T.small.copyWith(color: len > max ? C.danger : C.slate)),
                      ]),
                    ]),
                  ),
                  SizedBox(height: 10.h),
                  Row(children: [
                    Expanded(child: Text('Add to message:', style: T.small)),
                    for (final (icon, tip) in const [(Icons.attach_file_rounded, 'Attach file'), (Icons.photo_camera_outlined, 'Attach photo'), (Icons.mic_none_rounded, 'Attach voice note')])
                      Padding(
                        padding: EdgeInsets.only(left: 6.w),
                        child: IconButton.filledTonal(
                          tooltip: tip, onPressed: _attach, icon: Icon(icon, color: C.primary, size: 20.r),
                          style: IconButton.styleFrom(backgroundColor: C.surface, minimumSize: Size(44.r, 44.r)),
                        ),
                      ),
                  ]),
                  for (var i = 0; i < attach.length; i++)
                    Padding(
                      padding: EdgeInsets.only(top: 8.h),
                      child: AppFileChip(
                        name: attach[i].name, size: attach[i].size,
                        trailing: IconButton(tooltip: 'Remove attachment', icon: Icon(Icons.close_rounded, size: 18.r), onPressed: () => setState(() => attach = [...attach]..removeAt(i))),
                      ),
                    ),
                ]),
              ),
              SectionHeader('Select Recipients', caps: true, action: '${opts.length} Available'),
              if (opts.isEmpty) const AppEmptyState('No recipients found', icon: Icons.person_search_outlined),
              for (final r in opts.take(30)) _RecipientRow(r, selected: to.contains(r.id), onTap: () => _toggle(r.id)),
            ]),
    );
  }
}

class _RecipientRow extends StatelessWidget {
  const _RecipientRow(this.r, {required this.selected, required this.onTap});
  final Recipient r;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 8.h),
        child: Semantics(
          selected: selected,
          child: AppCard(
            padding: EdgeInsets.all(10.w), radius: R.lg, color: selected ? C.primarySoft : C.bg, border: selected ? C.primary.withValues(alpha: .4) : C.border, onTap: onTap,
            child: Row(children: [
              RecipientAvatar(name: r.name, kind: r.kind, online: r.online, size: 44),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(child: Text(r.name, style: T.bodyStrong.copyWith(fontSize: 14.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    if (r.sub.isNotEmpty) ...[SizedBox(width: 6.w), Flexible(child: Pill(r.sub, tone: kindTone(r.kind)))],
                  ]),
                  if (r.extra.isNotEmpty) Text(r.extra, style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                ]),
              ),
              Icon(selected ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded, color: selected ? C.primary : C.muted, size: 24.r),
            ]),
          ),
        ),
      );
}
