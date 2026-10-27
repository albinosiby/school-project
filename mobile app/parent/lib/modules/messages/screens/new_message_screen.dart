import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../family/bloc/family_bloc.dart';
import '../../family/models/family_models.dart';
import '../bloc/new_message_bloc.dart';
import '../models/message_models.dart';
import 'widgets/contact_avatar.dart';
import 'widgets/file_upload_sheet.dart';

/// New Message (Figma 4.2): recipient (search, quick select, directory), message context, subject, body with
/// counter and tone, quick attachments (4.3 upload sheet, scan, voice note). Send creates a thread and opens it;
/// leaving with unsaved changes offers to keep a draft.
class NewMessageScreen extends StatelessWidget {
  const NewMessageScreen({super.key, this.contactId, this.draftId});
  final String? contactId, draftId;

  @override
  Widget build(BuildContext context) {
    final child = context.select<FamilyBloc, Child?>((b) => b.state.selected);
    if (child == null) {
      return const Scaffold(backgroundColor: C.surface, body: AppLoading());
    }
    return BlocProvider<NewMessageBloc>(
      key: ValueKey('new-message:${child.id}'),
      create: (_) => getIt<NewMessageBloc>()
        ..add(
          NewMessageStarted(child.id, draftId: draftId, contactId: contactId),
        ),
      child: _NewMessageView(child: child),
    );
  }
}

class _NewMessageView extends StatefulWidget {
  const _NewMessageView({required this.child});
  final Child child;

  @override
  State<_NewMessageView> createState() => _NewMessageViewState();
}

class _NewMessageViewState extends State<_NewMessageView> {
  static const tones = ['Respectful & Clear', 'Warm & Friendly', 'Formal'];

  final _form = GlobalKey<FormState>();
  final _to = TextEditingController();
  final _subject = TextEditingController();
  final _body = TextEditingController();
  String? _contactId;
  String? _draftId;
  MessageCategory _category = MessageCategory.academic;
  final List<MessageAttachment> _files = [];
  String _tone = tones.first;
  String? _recipientError;
  bool _prefilled = false, _dirty = false, _leaving = false;

  @override
  void initState() {
    super.initState();
    for (final c in [_subject, _body]) {
      c.addListener(() {
        if (!_dirty && _prefilled) setState(() => _dirty = true);
      });
    }
  }

  @override
  void dispose() {
    _to.dispose();
    _subject.dispose();
    _body.dispose();
    super.dispose();
  }

  void _prefill(NewMessageState s) {
    if (_prefilled) return;
    final d = s.draft;
    _contactId = s.contactId;
    if (d != null) {
      _draftId = d.id;
      _category = d.category;
      _subject.text = d.subject;
      _body.text = d.body;
      _files.addAll(d.attachments);
    }
    _prefilled = true;
  }

  void _edit(VoidCallback f) => setState(() {
    f();
    _dirty = true;
  });

  void _select(MessageContact c) => _edit(() {
    _contactId = _contactId == c.id ? null : c.id;
    _recipientError = null;
    _to.clear();
  });

  Future<void> _directory(List<MessageContact> contacts) async {
    final picked = await showAppSheet<MessageContact>(
      context,
      title: 'Directory',
      subtitle: 'Teachers and offices for ${widget.child.firstName}',
      builder: (ctx) => Column(
        children: [
          for (final c in contacts)
            ListTile(
              key: ValueKey('directory-${c.id}'),
              contentPadding: EdgeInsets.zero,
              minTileHeight: 56.h,
              leading: ContactAvatar(
                name: c.name,
                kind: c.kind,
                size: 40,
                online: c.online,
              ),
              title: Text(
                c.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: T.bodyStrong,
              ),
              subtitle: Text(
                c.role,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: T.small,
              ),
              trailing: c.id == _contactId
                  ? Icon(
                      Icons.check_circle_rounded,
                      color: C.primary,
                      size: 22.r,
                    )
                  : null,
              onTap: () => Navigator.pop(ctx, c),
            ),
        ],
      ),
    );
    if (picked != null && picked.id != _contactId) _select(picked);
  }

  Future<void> _pickTone() async {
    final t = await showAppSheet<String>(
      context,
      title: 'Message tone',
      subtitle: 'A gentle reminder of how the message should read.',
      builder: (ctx) => AppChoiceChips(
        items: tones,
        value: _tone,
        check: true,
        onChanged: (v) => Navigator.pop(ctx, v),
      ),
    );
    if (t != null) _edit(() => _tone = t);
  }

  Future<void> _attach() async {
    final files = await showFileUploadSheet(
      context,
      action: 'Attach',
      alreadyAttached: _files.length,
    );
    if (files == null || files.isEmpty) return;
    _edit(() => _files.addAll(files));
    if (mounted) {
      AppDialogs.showSnackBar(
        context,
        message: '${files.length} file${files.length == 1 ? '' : 's'} attached',
      );
    }
  }

  void _quickAdd(MessageAttachment f, String message) {
    final err = FileUploadRules.check(f, _files.length);
    if (err != null) {
      AppDialogs.showSnackBar(context, message: err, isError: true);
      return;
    }
    _edit(() => _files.add(f));
    AppDialogs.showSnackBar(context, message: message);
  }

  NewMessageRequest _request() => NewMessageRequest(
    childId: widget.child.id,
    contactId: _contactId ?? '',
    category: _category,
    subject: _subject.text,
    body: _body.text,
    attachments: List.of(_files),
    draftId: _draftId,
  );

  void _send() {
    final formOk = _form.currentState?.validate() ?? false;
    setState(
      () => _recipientError = _contactId == null
          ? 'Choose who to send this to'
          : null,
    );
    if (!formOk || _contactId == null) return;
    context.read<NewMessageBloc>().add(NewMessageSubmitted(_request()));
  }

  void _close() {
    _leaving = true;
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(RoutePaths.messages);
    }
  }

  Future<void> _leave() async {
    if (!_dirty) return _close();
    final choice = await showAppSheet<String>(
      context,
      title: 'Keep this message?',
      subtitle: 'Save it as a draft to finish later from Messages › Drafts.',
      builder: (ctx) => Row(
        children: [
          Expanded(
            child: AppButton(
              'Discard',
              kind: BtnKind.outline,
              onPressed: () => Navigator.pop(ctx, 'discard'),
            ),
          ),
          SizedBox(width: 12.w),
          Expanded(
            child: AppButton(
              'Save draft',
              icon: Icons.save_outlined,
              onPressed: () => Navigator.pop(ctx, 'save'),
            ),
          ),
        ],
      ),
    );
    if (!mounted) return;
    if (choice == 'discard') _close();
    if (choice == 'save') {
      context.read<NewMessageBloc>().add(
        NewMessageDraftSaved(
          MessageDraft(
            id: _draftId ?? '',
            childId: widget.child.id,
            contactId: _contactId,
            category: _category,
            subject: _subject.text.trim(),
            body: _body.text.trim(),
            attachments: List.of(_files),
            updatedAt: DateTime.now(),
          ),
        ),
      );
    }
  }

  void _onState(BuildContext context, NewMessageState s) {
    switch (s.submit) {
      case SubmitStatus.sent:
        final t = s.thread!;
        _leaving = true;
        AppDialogs.showSnackBar(
          context,
          message: 'Message sent to ${t.teacher}',
        );
        context.pushReplacement(
          RoutePaths.chatWith(t.id, teacher: t.teacher, role: t.role),
        );
      case SubmitStatus.draftSaved:
        AppDialogs.showSnackBar(context, message: 'Draft saved');
        _close();
      case SubmitStatus.failed:
        AppDialogs.showSnackBar(
          context,
          message: s.error ?? 'Could not send. Please try again.',
          isError: true,
        );
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final guardian = context.select<FamilyBloc, String>(
      (b) => b.state.guardian?.name ?? 'Parent',
    );
    return BlocConsumer<NewMessageBloc, NewMessageState>(
      listenWhen: (a, b) => a.submit != b.submit,
      listener: _onState,
      builder: (context, state) {
        if (state.status == LoadStatus.loaded) _prefill(state);
        return PopScope(
          canPop: !_dirty || _leaving,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) _leave();
          },
          child: Scaffold(
            backgroundColor: C.surface,
            appBar: _Header(
              userName: guardian,
              onBack: _leave,
              onBell: () => context.push(RoutePaths.notifications),
              onAvatar: () => context.push(RoutePaths.profile),
            ),
            body: switch (state.status) {
              LoadStatus.loading => const AppLoading(rows: 4),
              LoadStatus.error => AppErrorWidget(
                message: state.error ?? 'Could not load teachers.',
                onRetry: () => context.read<NewMessageBloc>().add(
                  NewMessageStarted(widget.child.id),
                ),
              ),
              LoadStatus.loaded => _buildForm(state),
            },
            bottomNavigationBar: SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(S.page * 4, 8.h, S.page * 4, 12.h),
                child: AppButton(
                  'Send Message',
                  key: const Key('new-message-send'),
                  icon: Icons.send_rounded,
                  busy: state.submit == SubmitStatus.sending,
                  onPressed: state.status == LoadStatus.loaded ? _send : null,
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildForm(NewMessageState state) {
    final contacts = state.contacts;
    final selected = contacts.where((c) => c.id == _contactId).firstOrNull;
    final query = _to.text.trim();
    final suggestions = query.isEmpty
        ? const <MessageContact>[]
        : contacts.where((c) => c.matches(query)).take(4).toList();
    final faculty = contacts.where((c) => c.kind.isPerson).toList();
    return Form(
      key: _form,
      child: ListView(
        key: const Key('new-message-form'),
        padding: EdgeInsets.fromLTRB(S.page, 8.h, S.page, 24.h),
        children: [
          _Card(
            children: [
              Container(
                padding: EdgeInsets.fromLTRB(14.w, 8.h, 6.w, 8.h),
                decoration: BoxDecoration(
                  color: C.surface,
                  borderRadius: BorderRadius.circular(R.md),
                  border: Border.all(
                    color: _recipientError == null ? C.outline : C.danger,
                  ),
                ),
                child: Row(
                  children: [
                    Text('To:', style: T.bodyStrong.copyWith(color: C.slate)),
                    SizedBox(width: 10.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (selected != null)
                            _RecipientChip(
                              contact: selected,
                              onRemove: () => _edit(() => _contactId = null),
                            ),
                          TextField(
                            key: const Key('new-message-to'),
                            controller: _to,
                            onChanged: (_) => setState(() {}),
                            style: T.body.copyWith(color: C.ink),
                            decoration: InputDecoration(
                              hintText: 'Search teacher or role...',
                              filled: false,
                              isDense: true,
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              contentPadding: EdgeInsets.symmetric(
                                vertical: 8.h,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Open directory',
                      onPressed: () => _directory(contacts),
                      icon: Icon(
                        Icons.person_add_alt_1_outlined,
                        color: C.primary,
                        size: 22.r,
                      ),
                    ),
                  ],
                ),
              ),
              if (_recipientError != null)
                Padding(
                  padding: EdgeInsets.only(top: 6.h, left: 4.w),
                  child: Text(
                    _recipientError!,
                    style: T.small.copyWith(color: C.danger),
                  ),
                ),
              for (final c in suggestions)
                ListTile(
                  key: ValueKey('suggest-${c.id}'),
                  contentPadding: EdgeInsets.zero,
                  minTileHeight: 52.h,
                  leading: ContactAvatar(name: c.name, kind: c.kind, size: 36),
                  title: Text(
                    c.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.bodyStrong,
                  ),
                  subtitle: Text(
                    c.role,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.small,
                  ),
                  onTap: () => _select(c),
                ),
              if (query.isNotEmpty && suggestions.isEmpty)
                Padding(
                  padding: EdgeInsets.only(top: 8.h),
                  child: Text(
                    'No teacher or office matches "$query"',
                    style: T.small,
                  ),
                ),
              SizedBox(height: 14.h),
              Row(
                children: [
                  Expanded(
                    child: Text('QUICK SELECT FACULTY', style: T.capsMuted),
                  ),
                  TextButton(
                    key: const Key('new-message-directory'),
                    onPressed: () => _directory(contacts),
                    child: Text(
                      'Directory →',
                      style: T.smallStrong.copyWith(color: C.primary),
                    ),
                  ),
                ],
              ),
              SizedBox(
                height: 64.h,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: faculty.length,
                  separatorBuilder: (_, _) => SizedBox(width: 10.w),
                  itemBuilder: (_, i) => _FacultyCard(
                    contact: faculty[i],
                    selected: faculty[i].id == _contactId,
                    onTap: () => _select(faculty[i]),
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 18.h),
          Text('MESSAGE CONTEXT', style: T.capsMuted),
          SizedBox(height: 8.h),
          AppSolidChips(
            items: [for (final c in MessageCategory.values) c.label],
            value: _category.label,
            onChanged: (l) => _edit(
              () => _category = MessageCategory.values.firstWhere(
                (c) => c.label == l,
              ),
            ),
          ),
          SizedBox(height: 14.h),
          _Card(
            children: [
              Text('SUBJECT LINE', style: T.capsMuted),
              TextFormField(
                key: const Key('new-message-subject'),
                controller: _subject,
                maxLength: NewMessageRequest.subjectMax,
                validator: NewMessageRequest.validateSubject,
                textInputAction: TextInputAction.next,
                style: T.bodyStrong.copyWith(fontWeight: FontWeight.w500),
                decoration: _bare('Subject: e.g. Math remedial class'),
              ),
            ],
          ),
          SizedBox(height: 14.h),
          _Card(
            children: [
              Row(
                children: [
                  Expanded(child: Text('DETAILED QUERY', style: T.capsMuted)),
                  Flexible(
                    child: Text(
                      selected?.kind.isPerson == false
                          ? selected!.shortName
                          : 'Class ${widget.child.className} Faculty Desk',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.small,
                    ),
                  ),
                ],
              ),
              TextFormField(
                key: const Key('new-message-body'),
                controller: _body,
                minLines: 5,
                maxLines: 10,
                validator: NewMessageRequest.validateBody,
                style: T.body.copyWith(color: C.onSurface, height: 1.6),
                decoration: _bare(
                  'Write your message to the teacher (at least 10 characters)…',
                ),
              ),
              SizedBox(height: 8.h),
              Material(
                color: C.surface,
                borderRadius: BorderRadius.circular(R.md),
                child: InkWell(
                  key: const Key('new-message-tone'),
                  borderRadius: BorderRadius.circular(R.md),
                  onTap: _pickTone,
                  child: Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: 12.w,
                      vertical: 12.h,
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.auto_awesome_rounded,
                          size: 18.r,
                          color: C.primary,
                        ),
                        SizedBox(width: 8.w),
                        Expanded(
                          child: Text(
                            'Tone: $_tone',
                            style: T.smallStrong.copyWith(
                              color: C.primary,
                              fontSize: 13.sp,
                            ),
                          ),
                        ),
                        ValueListenableBuilder(
                          valueListenable: _body,
                          builder: (_, v, _) {
                            final n = v.text.trim().length;
                            return Text(
                              '$n/${NewMessageRequest.bodyMax}',
                              style: T.small.copyWith(
                                color: n > NewMessageRequest.bodyMax
                                    ? C.danger
                                    : C.slate,
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              SizedBox(height: 10.h),
              const Divider(),
              SizedBox(height: 6.h),
              Row(
                children: [
                  Expanded(child: Text('Quick attachments', style: T.small)),
                  Container(
                    decoration: BoxDecoration(
                      color: C.surfaceLow,
                      borderRadius: BorderRadius.circular(R.pill),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          key: const Key('new-message-attach'),
                          tooltip: 'Attach files',
                          onPressed: _attach,
                          icon: Icon(
                            Icons.attach_file_rounded,
                            size: 20.r,
                            color: C.ink,
                          ),
                        ),
                        IconButton(
                          key: const Key('new-message-camera'),
                          tooltip: 'Scan with camera',
                          onPressed: () => _quickAdd(
                            SimulatedPicker.pick(UploadSource.scan),
                            'Scan attached (demo: camera is simulated)',
                          ),
                          icon: Icon(
                            Icons.photo_camera_outlined,
                            size: 20.r,
                            color: C.ink,
                          ),
                        ),
                        IconButton(
                          key: const Key('new-message-voice'),
                          tooltip: 'Record a voice note',
                          onPressed: () => _quickAdd(
                            const MessageAttachment(
                              name: 'Voice_note.m4a',
                              sizeKb: 84,
                            ),
                            'Voice note attached (demo: recording is simulated)',
                          ),
                          icon: Icon(
                            Icons.mic_none_rounded,
                            size: 20.r,
                            color: C.ink,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              for (final f in _files) ...[
                SizedBox(height: 8.h),
                AppFileChip(
                  name: f.name,
                  size: f.sizeLabel,
                  sub: 'Ready to send',
                  trailing: IconButton(
                    tooltip: 'Remove ${f.name}',
                    onPressed: () => _edit(() => _files.remove(f)),
                    icon: Icon(Icons.close_rounded, size: 18.r, color: C.slate),
                  ),
                ),
              ],
            ],
          ),
          SizedBox(height: 12.h),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.schedule_rounded, size: 14.r, color: C.muted),
              SizedBox(width: 6.w),
              Expanded(
                child: Text(
                  'Teacher active hours: 8:00 AM – 3:30 PM IST • Typical reply within 24 hrs',
                  style: T.small.copyWith(fontSize: 11.sp),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  InputDecoration _bare(String hint) => InputDecoration(
    hintText: hint,
    filled: false,
    isDense: true,
    counterText: '',
    border: InputBorder.none,
    enabledBorder: InputBorder.none,
    focusedBorder: InputBorder.none,
    errorBorder: InputBorder.none,
    focusedErrorBorder: InputBorder.none,
    contentPadding: EdgeInsets.symmetric(vertical: 10.h),
  );
}

class _Header extends StatelessWidget implements PreferredSizeWidget {
  const _Header({
    required this.userName,
    required this.onBack,
    required this.onBell,
    required this.onAvatar,
  });
  final String userName;
  final VoidCallback onBack, onBell, onAvatar;

  @override
  Size get preferredSize => Size.fromHeight(68.h);

  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: Container(
      height: 68.h,
      color: C.surface,
      padding: EdgeInsets.symmetric(horizontal: 16.w),
      child: Row(
        children: [
          Tooltip(
            message: 'Back',
            child: Material(
              color: C.bg,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(R.lg),
                side: const BorderSide(color: C.border),
              ),
              child: InkWell(
                key: const Key('new-message-back'),
                borderRadius: BorderRadius.circular(R.lg),
                onTap: onBack,
                child: SizedBox(
                  width: 44.r,
                  height: 44.r,
                  child: Icon(
                    Icons.arrow_back_rounded,
                    color: C.ink,
                    size: 22.r,
                  ),
                ),
              ),
            ),
          ),
          SizedBox(width: 12.w),
          Expanded(
            child: Text(
              'MESSAGES',
              style: T.capsMuted.copyWith(fontSize: 12.sp),
            ),
          ),
          AppHeaderActions(
            userName: userName,
            onBell: onBell,
            onAvatar: onAvatar,
          ),
        ],
      ),
    ),
  );
}

class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(R.xl),
      boxShadow: const [
        BoxShadow(color: C.cardShadow, blurRadius: 10, offset: Offset(0, 2)),
      ],
    ),
    child: Material(
      color: C.bg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(R.xl),
        side: const BorderSide(color: C.cardBorder),
      ),
      child: Padding(
        padding: EdgeInsets.all(16.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: children,
        ),
      ),
    ),
  );
}

class _RecipientChip extends StatelessWidget {
  const _RecipientChip({required this.contact, required this.onRemove});
  final MessageContact contact;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) => Container(
    key: const Key('new-message-recipient'),
    padding: EdgeInsets.fromLTRB(10.w, 2.h, 2.w, 2.h),
    decoration: BoxDecoration(
      color: C.indigoSoft,
      borderRadius: BorderRadius.circular(R.pill),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6.r,
          height: 6.r,
          decoration: const BoxDecoration(
            color: C.primary,
            shape: BoxShape.circle,
          ),
        ),
        SizedBox(width: 6.w),
        Flexible(
          child: Text(
            contact.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: T.smallStrong.copyWith(
              color: C.primaryDark,
              fontSize: 13.sp,
            ),
          ),
        ),
        IconButton(
          tooltip: 'Remove ${contact.name}',
          onPressed: onRemove,
          visualDensity: VisualDensity.compact,
          icon: Icon(Icons.cancel_rounded, size: 18.r, color: C.slate),
        ),
      ],
    ),
  );
}

class _FacultyCard extends StatelessWidget {
  const _FacultyCard({
    required this.contact,
    required this.selected,
    required this.onTap,
  });
  final MessageContact contact;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    label: '${contact.name}, ${contact.role}',
    excludeSemantics: true,
    child: Material(
      color: selected ? C.primarySoft : C.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(R.lg),
        side: BorderSide(color: selected ? C.panelBorder : C.outline),
      ),
      child: InkWell(
        key: ValueKey('faculty-${contact.id}'),
        borderRadius: BorderRadius.circular(R.lg),
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 10.w),
          child: Row(
            children: [
              ContactAvatar(
                name: contact.name,
                kind: contact.kind,
                size: 36,
                online: contact.online,
              ),
              SizedBox(width: 8.w),
              ConstrainedBox(
                constraints: BoxConstraints(maxWidth: 96.w),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      contact.shortName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.smallStrong.copyWith(fontSize: 13.sp),
                    ),
                    Text(
                      contact.role.split('•').last.trim(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.small.copyWith(
                        fontSize: 11.sp,
                        color: selected ? C.primary : C.slate,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(width: 6.w),
              Icon(
                selected ? Icons.check_circle_rounded : Icons.add_rounded,
                size: 18.r,
                color: selected ? C.primary : C.muted,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
