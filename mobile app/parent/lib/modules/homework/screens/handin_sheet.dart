import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../models/homework_models.dart';
import '../repositories/homework_repository_interface.dart';

/// Where a hand-in file comes from.
enum HandinSource { camera, gallery, pdf }

/// Picks files for a hand-in. Tests replace it with [handinPickerOverride].
typedef HandinPicker = Future<List<PickedHandin>> Function(HandinSource source);

/// Test seam: when set, used instead of the camera / gallery / file pickers.
HandinPicker? handinPickerOverride;

Future<List<PickedHandin>> _pick(HandinSource source) async {
  final override = handinPickerOverride;
  if (override != null) return override(source);
  switch (source) {
    case HandinSource.camera:
      final f = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 85, maxWidth: 2400);
      return f == null ? const [] : [await _fromXFile(f)];
    case HandinSource.gallery:
      final files = await ImagePicker().pickMultiImage(imageQuality: 85, maxWidth: 2400);
      return [for (final f in files) await _fromXFile(f)];
    case HandinSource.pdf:
      final r = await FilePicker.platform.pickFiles(allowMultiple: true, type: FileType.custom, allowedExtensions: const ['pdf']);
      if (r == null) return const [];
      return [
        for (final f in r.files)
          if (f.path != null) PickedHandin(name: f.name, mime: 'application/pdf', size: f.size, path: f.path),
      ];
  }
}

Future<PickedHandin> _fromXFile(XFile f) async {
  final name = f.name.isEmpty ? f.path.split(Platform.pathSeparator).last : f.name;
  return PickedHandin(
    name: name,
    mime: PickedHandin.mimeOf(name) ?? f.mimeType ?? 'image/jpeg',
    size: await f.length(),
    path: f.path,
  );
}

/// Bottom sheet to hand in (or replace) [h] for [childId]: photos (camera / gallery) and PDFs, an optional note,
/// then Submit. Returns true once handed in.
Future<bool?> showHandinSheet(BuildContext context, Homework h, {required String childId}) => showAppSheet<bool>(
  context,
  title: h.submitted ? 'Replace submission' : 'Submit homework',
  subtitle: '${h.subject} · ${h.title}',
  builder: (_) => _HandinForm(h: h, childId: childId),
);

class _HandinForm extends StatefulWidget {
  const _HandinForm({required this.h, required this.childId});
  final Homework h;
  final String childId;
  @override
  State<_HandinForm> createState() => _HandinFormState();
}

class _HandinFormState extends State<_HandinForm> {
  final _files = <PickedHandin>[];
  final _note = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _add(HandinSource source) async {
    try {
      final picked = await _pick(source);
      if (!mounted || picked.isEmpty) return;
      setState(() {
        _files.addAll(picked);
        _error = handinProblem(_files, _note.text) == 'Add at least one photo or PDF.' ? null : handinProblem(_files, _note.text);
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not open the ${source == HandinSource.pdf ? 'files' : 'camera / photos'}.');
    }
  }

  Future<void> _submit() async {
    final problem = handinProblem(_files, _note.text);
    if (problem != null) return setState(() => _error = problem);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await getIt<IHomeworkRepository>().submit(childId: widget.childId, homeworkId: widget.h.id, files: List.of(_files), note: _note.text);
      if (!mounted) return;
      Navigator.pop(context, true);
    } on AppException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not hand in. Try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Row(
        children: [
          Expanded(
            child: _SourceButton(
              key: const Key('handin-camera'),
              icon: Icons.photo_camera_outlined,
              label: 'Camera',
              onTap: _busy ? null : () => _add(HandinSource.camera),
            ),
          ),
          SizedBox(width: 8.w),
          Expanded(
            child: _SourceButton(
              key: const Key('handin-gallery'),
              icon: Icons.photo_library_outlined,
              label: 'Photos',
              onTap: _busy ? null : () => _add(HandinSource.gallery),
            ),
          ),
          SizedBox(width: 8.w),
          Expanded(
            child: _SourceButton(
              key: const Key('handin-pdf'),
              icon: Icons.picture_as_pdf_outlined,
              label: 'PDF',
              onTap: _busy ? null : () => _add(HandinSource.pdf),
            ),
          ),
        ],
      ),
      SizedBox(height: 12.h),
      if (_files.isEmpty)
        Text(
          widget.h.submitted
              ? 'Add the new pages. They replace what was handed in before.'
              : 'Take clear photos of each page, or add a PDF. Up to ${PickedHandin.maxFiles} files, 15 MB each.',
          style: T.small.copyWith(color: C.onSurfaceVariant),
        )
      else
        for (var i = 0; i < _files.length; i++)
          Padding(
            padding: EdgeInsets.only(bottom: 6.h),
            child: AppFileChip(
              name: _files[i].name,
              size: HandinFile(name: _files[i].name, size: _files[i].size).sizeLabel,
              tone: _files[i].mime == 'application/pdf' ? Tone.danger : Tone.brand,
              trailing: IconButton(
                tooltip: 'Remove ${_files[i].name}',
                onPressed: _busy ? null : () => setState(() => _files.removeAt(i)),
                icon: Icon(Icons.close_rounded, size: 18.r, color: C.onSurfaceVariant),
              ),
            ),
          ),
      SizedBox(height: 8.h),
      AppTextField(
        key: const Key('handin-note'),
        label: 'Note for the teacher (optional)',
        controller: _note,
        maxLines: 3,
        hint: 'e.g. Questions 1–10 done; 11 and 12 on the next page',
      ),
      if (_error != null) ...[
        SizedBox(height: 8.h),
        Text(_error!, style: T.small.copyWith(color: C.danger)),
      ],
      SizedBox(height: 14.h),
      AppButton(
        _busy ? 'Uploading…' : (widget.h.submitted ? 'Replace submission' : 'Submit homework'),
        key: const Key('handin-submit'),
        icon: Icons.upload_rounded,
        busy: _busy,
        onPressed: _busy || _files.isEmpty ? null : _submit,
      ),
    ],
  );
}

class _SourceButton extends StatelessWidget {
  const _SourceButton({super.key, required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: C.surface,
    borderRadius: BorderRadius.circular(R.md),
    child: InkWell(
      borderRadius: BorderRadius.circular(R.md),
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 12.h),
        child: Column(
          children: [
            Icon(icon, size: 22.r, color: C.primary),
            SizedBox(height: 4.h),
            Text(label, style: T.small.copyWith(color: C.onSurface, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    ),
  );
}
