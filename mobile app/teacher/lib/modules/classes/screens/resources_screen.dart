import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../engage/models/attachment_models.dart';
import '../../engage/screens/widgets/attachment_sheet.dart';
import '../../engage/screens/widgets/engage_widgets.dart' show openFileRef;
import '../../school/bloc/school_bloc.dart';
import '../../school/models/school_models.dart';
import '../bloc/resources_bloc.dart';
import '../bloc/resources_events.dart';
import '../bloc/resources_states.dart';
import '../models/classes_models.dart';
import '../models/student_metrics.dart';

const _mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
String _date(String iso) {
  final d = DateTime.tryParse(iso)?.toLocal();
  return d == null ? '' : '${d.day} ${_mon[d.month - 1]} ${d.year}';
}

enum _Filter { all, files, videos, links, shared, mine }

const _filterNames = {_Filter.all: 'All', _Filter.files: 'Files', _Filter.videos: 'Videos', _Filter.links: 'Links', _Filter.shared: 'Shared with parents', _Filter.mine: 'Only me'};

/// Class resources: files (images, PDF, Word, PowerPoint, Excel), YouTube videos and links (Google Drive or any web
/// page). Each is shared with the class's parents (parent app → Academics → Resources) or kept to the teacher.
class ResourcesScreen extends StatelessWidget {
  const ResourcesScreen({super.key, this.classId});
  final String? classId;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<ResourcesBloc>()..add(const ResourcesLoadRequested()),
    child: BlocListener<ResourcesBloc, ResourcesState>(
      listenWhen: (a, b) => b.noticeSeq > a.noticeSeq && b.notice != null,
      listener: (ctx, s) => AppDialogs.showSnackBar(ctx, message: s.notice!),
      child: _View(classId: classId),
    ),
  );
}

class _View extends StatefulWidget {
  const _View({this.classId});
  final String? classId;
  @override
  State<_View> createState() => _ViewState();
}

class _ViewState extends State<_View> {
  late String? _classId = widget.classId;
  _Filter _filter = _Filter.all;
  String _q = '';

  bool _in(SharedResource r) =>
      switch (_filter) {
        _Filter.all => true,
        _Filter.files => r.kind == ResourceKind.file,
        _Filter.videos => r.kind == ResourceKind.youtube,
        _Filter.links => r.kind == ResourceKind.link,
        _Filter.shared => r.forParents,
        _Filter.mine => !r.forParents,
      } &&
      (_q.isEmpty || '${r.title} ${r.subject} ${r.description} ${r.fileName}'.toLowerCase().contains(_q.toLowerCase()));

  Future<void> _add(SchoolClass c, {SharedResource? editing}) {
    final bloc = context.read<ResourcesBloc>();
    final teacher = context.read<SchoolBloc>().state.teacher?.name ?? '';
    return showAppSheet<void>(
      context,
      title: editing == null ? 'Add a resource' : 'Edit resource',
      subtitle: 'Class ${c.label}',
      builder: (_) => BlocProvider.value(value: bloc, child: _ResourceForm(cls: c, teacher: teacher, editing: editing)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final s = context.watch<ResourcesBloc>().state;
    final c = classOr(school.classes, _classId);
    if (c == null) {
      return DetailScaffold(title: 'Resources', fallbackRoute: RoutePaths.classes, body: const AppEmptyState('No classes assigned', icon: Icons.class_outlined));
    }
    final all = s.of(c.id);
    final list = all.where(_in).toList();
    final counts = {
      for (final f in _Filter.values)
        f: switch (f) {
          _Filter.all => all.length,
          _Filter.files => all.where((r) => r.kind == ResourceKind.file).length,
          _Filter.videos => all.where((r) => r.kind == ResourceKind.youtube).length,
          _Filter.links => all.where((r) => r.kind == ResourceKind.link).length,
          _Filter.shared => all.where((r) => r.forParents).length,
          _Filter.mine => all.where((r) => !r.forParents).length,
        },
    };
    final labels = {for (final f in _Filter.values) f: '${_filterNames[f]} (${counts[f]})'};
    return DetailScaffold(
      title: 'Resources',
      subtitle: 'Class ${c.label} • ${all.length} ${all.length == 1 ? 'item' : 'items'}',
      fallbackRoute: RoutePaths.classes,
      fab: FloatingActionButton.extended(
        key: const ValueKey('res-add'),
        heroTag: 'res-add',
        backgroundColor: C.primary,
        foregroundColor: Colors.white,
        onPressed: () => _add(c),
        icon: Icon(Icons.add_rounded, size: 22.r),
        label: Text('Add', style: T.button),
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 100.h),
        children: [
          if (school.classes.length > 1) ...[
            AppPickTile(
              icon: Icons.groups_rounded,
              plainIcon: true,
              label: 'Class ${c.label}',
              caption: c.subjectNames.isNotEmpty ? c.subjectNames.join(', ') : c.subject,
              onTap: () async {
                final r = await showPickSheet<SchoolClass>(context, title: 'Class', items: school.classes, label: (x) => 'Class ${x.label}', selected: c);
                if (r != null) setState(() => _classId = r.id);
              },
            ),
            SizedBox(height: 12.h),
          ],
          Row(
            children: [
              _Count(Icons.family_restroom_rounded, '${counts[_Filter.shared]}', 'Shared with parents', C.successDark),
              SizedBox(width: 8.w),
              _Count(Icons.lock_outline_rounded, '${counts[_Filter.mine]}', 'Only you', C.slate),
              SizedBox(width: 8.w),
              _Count(Icons.smart_display_outlined, '${counts[_Filter.videos]}', 'Videos', C.danger),
            ],
          ),
          SizedBox(height: 12.h),
          AppSearchField(hint: 'Search resources', onChanged: (v) => setState(() => _q = v.trim())),
          SizedBox(height: 10.h),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: AppChoiceChips(
              items: [for (final f in _Filter.values) labels[f]!],
              value: labels[_filter]!,
              dense: true,
              onChanged: (v) => setState(() => _filter = labels.entries.firstWhere((e) => e.value == v).key),
            ),
          ),
          SizedBox(height: 12.h),
          if (s.status != ResourcesStatus.loaded)
            const SchoolSkeletonList()
          else if (list.isEmpty)
            Padding(
              padding: EdgeInsets.only(top: 24.h),
              child: AppEmptyState(
                all.isEmpty ? 'No resources yet' : 'Nothing here',
                hint: all.isEmpty ? 'Add files, YouTube videos or Google Drive links for Class ${c.label}.' : 'Try another filter.',
                icon: Icons.folder_open_rounded,
              ),
            )
          else
            for (final r in list) _ResourceCard(r: r, onEdit: () => _add(c, editing: r)),
        ],
      ),
    );
  }
}

class _Count extends StatelessWidget {
  const _Count(this.icon, this.value, this.label, this.color);
  final IconData icon;
  final String value, label;
  final Color color;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: EdgeInsets.all(10.r),
      decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
      child: Row(
        children: [
          Icon(icon, size: 18.r, color: color),
          SizedBox(width: 6.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: T.h3.copyWith(color: color)),
                Text(label, style: T.small.copyWith(fontSize: 10.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

/// Badge of a resource: colour, icon and short label by type.
({Color color, IconData icon, String label}) resourceBadge(SharedResource r) {
  if (r.kind == ResourceKind.youtube) return (color: const Color(0xFFDC2626), icon: Icons.play_arrow_rounded, label: 'YouTube');
  if (r.kind == ResourceKind.link) {
    return r.isDrive
        ? (color: const Color(0xFF0F9D58), icon: Icons.add_to_drive_rounded, label: 'Drive')
        : (color: C.slate, icon: Icons.link_rounded, label: 'Link');
  }
  return switch (r.fileType) {
    'pdf' => (color: const Color(0xFFDC2626), icon: Icons.picture_as_pdf_rounded, label: 'PDF'),
    'doc' => (color: const Color(0xFF2563EB), icon: Icons.description_rounded, label: 'Word'),
    'ppt' => (color: const Color(0xFFEA580C), icon: Icons.slideshow_rounded, label: 'Slides'),
    'xls' => (color: const Color(0xFF16A34A), icon: Icons.table_chart_rounded, label: 'Excel'),
    'image' => (color: C.purple, icon: Icons.image_rounded, label: 'Image'),
    final t => (color: C.slate, icon: Icons.insert_drive_file_rounded, label: t.toUpperCase()),
  };
}

Future<void> openResource(BuildContext context, SharedResource r) async {
  if (r.kind == ResourceKind.file) {
    if (!r.url.startsWith('http')) {
      AppDialogs.showSnackBar(context, message: 'This file is not uploaded yet.');
      return;
    }
    await openFileRef(context, FileRef(name: r.fileName.isEmpty ? r.title : r.fileName, url: r.url, path: r.path, contentType: r.mime, bytes: r.sizeBytes));
    return;
  }
  final u = Uri.tryParse(r.url);
  if (u == null || !await launchUrl(u, mode: LaunchMode.externalApplication)) {
    if (context.mounted) AppDialogs.showSnackBar(context, message: 'Could not open the link.');
  }
}

class _ResourceCard extends StatelessWidget {
  const _ResourceCard({required this.r, required this.onEdit});
  final SharedResource r;
  final VoidCallback onEdit;

  Future<void> _menu(BuildContext context, String v) async {
    final bloc = context.read<ResourcesBloc>();
    switch (v) {
      case 'open':
        await openResource(context, r);
      case 'share':
        bloc.add(ResourceVisibilityToggled(r));
      case 'pin':
        bloc.add(ResourcePinToggled(r));
      case 'edit':
        onEdit();
      case 'delete':
        final ok = await AppDialogs.showConfirmDialog(
          context,
          title: 'Delete "${r.title}"?',
          message: r.forParents ? 'It disappears for you and for the parents of the class.' : 'It is removed from your resources.',
          confirm: 'Delete',
          danger: true,
        );
        if (ok) bloc.add(ResourceDeleted(r));
    }
  }

  @override
  Widget build(BuildContext context) {
    final b = resourceBadge(r);
    final meta = [
      b.label,
      if (r.subject.isNotEmpty) r.subject,
      if (r.kind == ResourceKind.file && r.sizeBytes > 0) FileRef.sizeLabel(r.sizeBytes),
      if (r.createdAt.isNotEmpty) _date(r.createdAt),
    ].join(' • ');
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppCard(
        key: ValueKey('res-${r.id}'),
        radius: R.xl,
        padding: EdgeInsets.all(12.r),
        onTap: () => openResource(context, r),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (r.kind == ResourceKind.youtube && r.thumbnail.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(R.md),
                child: SizedBox(
                  width: 112.w,
                  height: 63.w,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Image.network(r.thumbnail, fit: BoxFit.cover, errorBuilder: (_, _, _) => Container(color: C.surface)),
                      Center(
                        child: Container(
                          padding: EdgeInsets.all(5.r),
                          decoration: BoxDecoration(color: b.color, borderRadius: BorderRadius.circular(R.sm)),
                          child: Icon(Icons.play_arrow_rounded, color: Colors.white, size: 18.r),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              Container(
                width: 52.r,
                height: 52.r,
                decoration: BoxDecoration(color: b.color.withValues(alpha: .12), borderRadius: BorderRadius.circular(R.lg)),
                child: Icon(b.icon, color: b.color, size: 26.r),
              ),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (r.pinned) ...[Icon(Icons.push_pin_rounded, size: 14.r, color: C.primary), SizedBox(width: 4.w)],
                      Expanded(child: Text(r.title, style: T.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis)),
                    ],
                  ),
                  SizedBox(height: 2.h),
                  Text(meta, style: T.small.copyWith(fontSize: 11.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (r.description.isNotEmpty) ...[
                    SizedBox(height: 4.h),
                    Text(r.description, style: T.small.copyWith(color: C.ink), maxLines: 2, overflow: TextOverflow.ellipsis),
                  ],
                  SizedBox(height: 8.h),
                  GestureDetector(
                    key: ValueKey('res-vis-${r.id}'),
                    onTap: () => context.read<ResourcesBloc>().add(ResourceVisibilityToggled(r)),
                    child: Pill(
                      r.forParents ? 'Parents can see' : 'Only you',
                      tone: r.forParents ? Tone.success : Tone.neutral,
                      icon: r.forParents ? Icons.family_restroom_rounded : Icons.lock_outline_rounded,
                    ),
                  ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              tooltip: 'More',
              onSelected: (v) => _menu(context, v),
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'open', child: Text('Open')),
                PopupMenuItem(value: 'share', child: Text(r.forParents ? 'Make visible only to me' : 'Share with parents')),
                PopupMenuItem(value: 'pin', child: Text(r.pinned ? 'Unpin' : 'Pin to top')),
                const PopupMenuItem(value: 'edit', child: Text('Edit')),
                const PopupMenuItem(value: 'delete', child: Text('Delete')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Add (or edit) a resource: pick the type — upload a file, a YouTube video, or a link (Google Drive / web) — then
/// title, note, subject and who can see it.
class _ResourceForm extends StatefulWidget {
  const _ResourceForm({required this.cls, required this.teacher, this.editing});
  final SchoolClass cls;
  final String teacher;
  final SharedResource? editing;
  @override
  State<_ResourceForm> createState() => _ResourceFormState();
}

class _ResourceFormState extends State<_ResourceForm> {
  late ResourceKind? _kind = widget.editing?.kind;
  late final _title = TextEditingController(text: widget.editing?.title ?? '');
  late final _desc = TextEditingController(text: widget.editing?.description ?? '');
  late final _url = TextEditingController(text: widget.editing?.kind == ResourceKind.file ? '' : widget.editing?.url ?? '');
  late String _subject = widget.editing?.subject ?? (_subjects.isEmpty ? '' : _subjects.first);
  late bool _parents = widget.editing?.forParents ?? true;
  PickedAttachment? _file;
  String? _error;

  List<String> get _subjects => widget.cls.subjectNames.isNotEmpty ? widget.cls.subjectNames : [if (widget.cls.subject.isNotEmpty) widget.cls.subject];

  @override
  void dispose() {
    _title.dispose();
    _desc.dispose();
    _url.dispose();
    super.dispose();
  }

  Future<void> _pick(bool photo) async {
    final r = photo ? await pickPhotos() : await pickDocuments();
    if (r.isEmpty) return;
    final f = r.first;
    if (f.bytes > 25 * 1024 * 1024) {
      setState(() => _error = 'Files can be up to 25 MB');
      return;
    }
    setState(() {
      _file = f;
      _error = null;
      if (_title.text.trim().isEmpty) {
        final dot = f.name.lastIndexOf('.');
        _title.text = (dot > 0 ? f.name.substring(0, dot) : f.name).replaceAll(RegExp(r'[_-]+'), ' ');
      }
    });
  }

  void _save() {
    final kind = _kind!;
    final title = _title.text.trim();
    final url = _url.text.trim();
    String? err;
    if (kind == ResourceKind.file && widget.editing == null && _file == null) err = 'Choose a file to upload';
    if (kind == ResourceKind.youtube && youtubeId(url) == null) err = 'Paste a YouTube video link (youtube.com or youtu.be)';
    if (kind == ResourceKind.link && !(Uri.tryParse(url)?.isAbsolute == true && url.startsWith(RegExp('https?://')))) {
      err = 'Paste a full link starting with https://';
    }
    if (title.length < 2) err ??= 'Give it a title';
    if (err != null) {
      setState(() => _error = err);
      return;
    }
    final bloc = context.read<ResourcesBloc>();
    final base = widget.editing;
    if (base != null) {
      bloc.add(ResourceUpdated(base.copyWith(
        title: title,
        description: _desc.text.trim(),
        subject: _subject,
        visibility: _parents ? 'parents' : 'private',
        url: kind == ResourceKind.file ? null : url,
      )));
      return;
    }
    bloc.add(ResourceAdded(
      SharedResource(
        classId: widget.cls.id,
        title: title,
        description: _desc.text.trim(),
        subject: _subject,
        kind: kind,
        url: kind == ResourceKind.file ? '' : url,
        visibility: _parents ? 'parents' : 'private',
        teacher: widget.teacher,
        createdAt: DateTime.now().toIso8601String(),
      ),
      file: kind == ResourceKind.file ? _file : null,
    ));
  }

  @override
  Widget build(BuildContext context) => BlocConsumer<ResourcesBloc, ResourcesState>(
    listenWhen: (a, b) => b.savedSeq > a.savedSeq,
    listener: (ctx, _) => Navigator.pop(ctx),
    builder: (ctx, s) {
      final kind = _kind;
      if (kind == null) {
        return Column(
          children: [
            _TypeOption(
              key: const ValueKey('res-type-file'),
              icon: Icons.upload_file_rounded,
              color: C.primary,
              title: 'Upload a file',
              sub: 'Images, PDF, Word, PowerPoint, Excel — up to 25 MB',
              onTap: () => setState(() => _kind = ResourceKind.file),
            ),
            _TypeOption(
              key: const ValueKey('res-type-youtube'),
              icon: Icons.smart_display_rounded,
              color: const Color(0xFFDC2626),
              title: 'YouTube video',
              sub: 'Paste a video link — parents play it in YouTube',
              onTap: () => setState(() => _kind = ResourceKind.youtube),
            ),
            _TypeOption(
              key: const ValueKey('res-type-link'),
              icon: Icons.add_to_drive_rounded,
              color: const Color(0xFF0F9D58),
              title: 'Google Drive or web link',
              sub: 'A Drive file or folder, Docs/Slides, or any website',
              onTap: () => setState(() => _kind = ResourceKind.link),
            ),
          ],
        );
      }
      final vid = kind == ResourceKind.youtube ? youtubeId(_url.text) : null;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (kind == ResourceKind.file) ...[
            if (widget.editing != null)
              _Picked(name: widget.editing!.fileName, size: FileRef.sizeLabel(widget.editing!.sizeBytes))
            else if (_file != null)
              _Picked(name: _file!.name, size: _file!.sizeLabel, onClear: s.saving ? null : () => setState(() => _file = null))
            else
              Row(
                children: [
                  Expanded(child: AppButton('Choose file', key: const ValueKey('res-pick-file'), kind: BtnKind.outline, icon: Icons.attach_file_rounded, onPressed: () => _pick(false))),
                  SizedBox(width: 10.w),
                  Expanded(child: AppButton('Photo', kind: BtnKind.outline, icon: Icons.photo_outlined, onPressed: () => _pick(true))),
                ],
              ),
            SizedBox(height: 12.h),
          ] else ...[
            TextField(
              key: const ValueKey('res-url'),
              controller: _url,
              keyboardType: TextInputType.url,
              decoration: InputDecoration(
                labelText: kind == ResourceKind.youtube ? 'YouTube link' : 'Link',
                hintText: kind == ResourceKind.youtube ? 'https://youtu.be/…' : 'https://drive.google.com/…',
                isDense: true,
                prefixIcon: Icon(kind == ResourceKind.youtube ? Icons.smart_display_rounded : Icons.link_rounded, size: 20.r),
              ),
              onChanged: (_) => setState(() => _error = null),
            ),
            if (vid != null) ...[
              SizedBox(height: 8.h),
              ClipRRect(
                borderRadius: BorderRadius.circular(R.md),
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Image.network('https://img.youtube.com/vi/$vid/hqdefault.jpg', fit: BoxFit.cover, errorBuilder: (_, _, _) => Container(color: C.surface)),
                ),
              ),
            ],
            if (kind == ResourceKind.link && isDriveLink(_url.text))
              Padding(
                padding: EdgeInsets.only(top: 6.h),
                child: Text('Make sure the Drive file is shared as "Anyone with the link can view".', style: T.small.copyWith(color: C.warningDark, fontSize: 11.5.sp)),
              ),
            SizedBox(height: 12.h),
          ],
          TextField(
            key: const ValueKey('res-title'),
            controller: _title,
            maxLength: 120,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Title', isDense: true, counterText: ''),
            onChanged: (_) => setState(() => _error = null),
          ),
          SizedBox(height: 10.h),
          TextField(
            controller: _desc,
            minLines: 1,
            maxLines: 3,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Note (optional)', hintText: 'What it is for, pages to read…', isDense: true),
          ),
          if (_subjects.length > 1) ...[
            SizedBox(height: 12.h),
            AppChoiceChips(items: _subjects, value: _subject.isEmpty ? _subjects.first : _subject, dense: true, onChanged: (v) => setState(() => _subject = v)),
          ],
          SizedBox(height: 14.h),
          Text('Who can see it', style: T.smallStrong),
          SizedBox(height: 6.h),
          AppSegmented(
            items: ['Parents of ${widget.cls.label}', 'Only me'],
            value: _parents ? 'Parents of ${widget.cls.label}' : 'Only me',
            track: true,
            onChanged: (v) => setState(() => _parents = v != 'Only me'),
          ),
          SizedBox(height: 4.h),
          Text(
            _parents ? 'Shown in the parent app (Academics → Resources); parents get a notification.' : 'Kept in your resources; share it any time.',
            style: T.small.copyWith(fontSize: 11.5.sp),
          ),
          if (_error != null) Padding(padding: EdgeInsets.only(top: 8.h), child: Text(_error!, style: T.small.copyWith(color: C.danger))),
          SizedBox(height: 14.h),
          AppButton(
            s.saving ? (kind == ResourceKind.file ? 'Uploading…' : 'Saving…') : (widget.editing == null ? 'Add resource' : 'Save'),
            key: const ValueKey('res-save'),
            icon: Icons.check_rounded,
            busy: s.saving,
            onPressed: s.saving ? null : _save,
          ),
        ],
      );
    },
  );
}

class _TypeOption extends StatelessWidget {
  const _TypeOption({super.key, required this.icon, required this.color, required this.title, required this.sub, required this.onTap});
  final IconData icon;
  final Color color;
  final String title, sub;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 10.h),
    child: AppCard(
      radius: R.lg,
      padding: EdgeInsets.all(14.r),
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 46.r,
            height: 46.r,
            decoration: BoxDecoration(color: color.withValues(alpha: .12), borderRadius: BorderRadius.circular(R.md)),
            child: Icon(icon, color: color, size: 24.r),
          ),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: T.bodyStrong),
                Text(sub, style: T.small.copyWith(fontSize: 11.5.sp)),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: C.muted, size: 22.r),
        ],
      ),
    ),
  );
}

class _Picked extends StatelessWidget {
  const _Picked({required this.name, required this.size, this.onClear});
  final String name, size;
  final VoidCallback? onClear;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.only(left: 12.w),
    decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
    child: Row(
      children: [
        Icon(Icons.insert_drive_file_outlined, color: C.primary, size: 20.r),
        SizedBox(width: 8.w),
        Expanded(child: Text(name, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
        if (size.isNotEmpty) Text(size, style: T.small.copyWith(fontSize: 11.sp)),
        if (onClear != null) IconButton(tooltip: 'Remove', onPressed: onClear, icon: Icon(Icons.close_rounded, size: 18.r)) else SizedBox(width: 12.w, height: 40.h),
      ],
    ),
  );
}
