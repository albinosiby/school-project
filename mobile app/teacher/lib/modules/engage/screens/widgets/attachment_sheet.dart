import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../design_system/design_system.dart';

/// A file chosen for sending: local path, display name, size and whether it is an image.
class PickedAttachment {
  const PickedAttachment({required this.path, required this.name, required this.bytes, required this.isImage, this.mimeType});
  final String path, name;
  final int bytes;
  final bool isImage;
  final String? mimeType;
  String get sizeLabel => bytes < 1024 * 1024 ? '${(bytes / 1024).ceil()} KB' : '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

const int kMaxAttachmentBytes = 15 * 1024 * 1024;

/// Pick one or more photos from the gallery.
Future<List<PickedAttachment>> pickPhotos() async {
  final files = await ImagePicker().pickMultiImage(imageQuality: 85, maxWidth: 2048);
  return _fromXFiles(files, isImage: true);
}

/// Pick documents (PDF, Office, images) from the file system.
Future<List<PickedAttachment>> pickDocuments() async {
  final r = await FilePicker.platform.pickFiles(allowMultiple: true, type: FileType.custom, allowedExtensions: const ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png', 'webp']);
  if (r == null) return const [];
  final out = <PickedAttachment>[];
  for (final f in r.files) {
    final p = f.path;
    if (p == null) continue;
    final ext = f.extension?.toLowerCase() ?? '';
    out.add(PickedAttachment(path: p, name: f.name, bytes: f.size, isImage: const {'jpg', 'jpeg', 'png', 'webp'}.contains(ext)));
  }
  return out;
}

Future<List<PickedAttachment>> _fromXFiles(List<XFile> files, {required bool isImage}) async {
  final out = <PickedAttachment>[];
  for (final f in files) {
    final len = await f.length();
    out.add(PickedAttachment(path: f.path, name: f.name.isEmpty ? f.path.split(Platform.pathSeparator).last : f.name, bytes: len, isImage: isImage, mimeType: f.mimeType));
  }
  return out;
}

/// Take a single photo with the camera.
Future<List<PickedAttachment>> pickCamera() async {
  final f = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 85, maxWidth: 2048);
  return f == null ? const [] : _fromXFiles([f], isImage: true);
}

/// Share sheet: camera, gallery, documents and (optionally) a meeting. Returns the picked files
/// (empty when dismissed or when [onMeeting] was chosen).
Future<List<PickedAttachment>> showAttachmentSheet(BuildContext context, {VoidCallback? onMeeting}) async {
  final choice = await showModalBottomSheet<String>(
    context: context,
    useSafeArea: true,
    backgroundColor: C.bg,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(R.xxl))),
    builder: (ctx) => Padding(
      padding: EdgeInsets.fromLTRB(16.w, 10.h, 16.w, 16.h),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 40.w, height: 4.h, margin: EdgeInsets.only(bottom: 16.h), decoration: BoxDecoration(color: C.border, borderRadius: BorderRadius.circular(2.r))),
        Row(children: [
          Expanded(child: _ShareTile(icon: Icons.photo_camera_rounded, label: 'Camera', tone: Tone.danger, onTap: () => Navigator.pop(ctx, 'camera'))),
          Expanded(child: _ShareTile(icon: Icons.photo_library_rounded, label: 'Gallery', tone: Tone.purple, onTap: () => Navigator.pop(ctx, 'photos'))),
          Expanded(child: _ShareTile(icon: Icons.description_rounded, label: 'Document', tone: Tone.brand, onTap: () => Navigator.pop(ctx, 'docs'))),
          if (onMeeting != null) Expanded(child: _ShareTile(icon: Icons.videocam_rounded, label: 'Meeting', tone: Tone.success, onTap: () => Navigator.pop(ctx, 'meeting'))),
        ]),
        SizedBox(height: 14.h),
        Container(
          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
          decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.info_outline_rounded, size: 14.r, color: C.slate),
            SizedBox(width: 6.w),
            Text('Photos, PDF and Office files up to 15 MB each', style: T.small.copyWith(color: C.slate)),
          ]),
        ),
      ]),
    ),
  );
  if (choice == null) return const [];
  if (choice == 'meeting') {
    onMeeting?.call();
    return const [];
  }
  final picked = switch (choice) { 'camera' => await pickCamera(), 'photos' => await pickPhotos(), _ => await pickDocuments() };
  final tooBig = picked.where((p) => p.bytes > kMaxAttachmentBytes).toList();
  if (tooBig.isNotEmpty && context.mounted) {
    AppDialogs.showSnackBar(context, message: tooBig.length == 1 ? '${tooBig.first.name} is over 15 MB and was skipped.' : '${tooBig.length} files are over 15 MB and were skipped.');
  }
  return picked.where((p) => p.bytes <= kMaxAttachmentBytes).toList();
}

/// One round action in the share sheet: a soft-toned circle with the icon and a label beneath.
class _ShareTile extends StatelessWidget {
  const _ShareTile({required this.icon, required this.label, required this.tone, required this.onTap});
  final IconData icon;
  final String label;
  final Tone tone;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        borderRadius: BorderRadius.circular(R.lg),
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 6.h),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 60.r,
              height: 60.r,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.bg, Color.lerp(c.bg, c.fg, .18)!]),
                boxShadow: [BoxShadow(color: c.fg.withValues(alpha: .18), blurRadius: 12, offset: const Offset(0, 4))],
              ),
              child: Icon(icon, size: 26.r, color: c.fg),
            ),
            SizedBox(height: 8.h),
            Text(label, style: T.small.copyWith(color: C.ink, fontWeight: FontWeight.w600)),
          ]),
        ),
      ),
    );
  }
}
