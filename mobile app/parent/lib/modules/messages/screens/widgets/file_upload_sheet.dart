import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../models/message_models.dart';

/// Upload sources of the "Share Document" sheet (Figma 4.3). Picking is simulated: each source hands out
/// sample files in turn (Device Files includes one over the size limit to show the validation).
enum UploadSource {
  scan('Scan Homework', 'Camera auto-crop', Icons.document_scanner_outlined),
  photos('Photo Library', 'JPG, PNG photos', Icons.photo_library_outlined),
  files('Device Files', 'PDF or Word DOC', Icons.folder_open_rounded),
  templates(
    'Leave / Medical',
    'Official templates',
    Icons.assignment_turned_in_outlined,
  );

  const UploadSource(this.title, this.hint, this.icon);
  final String title, hint;
  final IconData icon;
}

class FileUploadRules {
  FileUploadRules._();
  static const maxKb = 15 * 1024;
  static const maxFiles = 5;
  static const allowed = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'm4a'];

  static String? check(MessageAttachment f, int alreadyPicked) {
    final ext = f.name.split('.').last.toLowerCase();
    if (f.sizeKb > maxKb) return '${f.name} is larger than 15MB';
    if (!allowed.contains(ext)) return '${f.name}: file type not supported';
    if (alreadyPicked >= maxFiles)
      return 'You can attach up to $maxFiles files';
    return null;
  }
}

/// Simulated device picker.
class SimulatedPicker {
  SimulatedPicker._();
  static final Map<UploadSource, int> _next = {};

  static const _pool = {
    UploadSource.scan: [
      MessageAttachment(name: 'Homework_Scan.jpg', sizeKb: 1150),
      MessageAttachment(name: 'Worksheet_Page_2.jpg', sizeKb: 980),
    ],
    UploadSource.photos: [
      MessageAttachment(name: 'Science_Model_Photo.png', sizeKb: 2048),
      MessageAttachment(name: 'Class_Activity.jpg', sizeKb: 1740),
    ],
    UploadSource.files: [
      MessageAttachment(name: 'Quadratic_Equation_Homework.pdf', sizeKb: 2458),
      MessageAttachment(name: 'Annual_Day_Rehearsal.mp4', sizeKb: 48000),
      MessageAttachment(name: 'Project_Report.docx', sizeKb: 1220),
    ],
    UploadSource.templates: [
      MessageAttachment(name: 'Medical_Certificate.pdf', sizeKb: 310),
      MessageAttachment(name: 'Leave_Application_Form.docx', sizeKb: 96),
    ],
  };

  static MessageAttachment pick(UploadSource s) {
    final list = _pool[s]!;
    final i = _next[s] ?? 0;
    _next[s] = i + 1;
    return list[i % list.length];
  }

  /// Tests start from the first sample of each source.
  static void reset() => _next.clear();
}

/// Opens the "Share Document" sheet; resolves to the uploaded files (null when cancelled).
/// [action] is the confirm label ("Attach & Send" in a chat, "Attach" in New Message).
Future<List<MessageAttachment>?> showFileUploadSheet(
  BuildContext context, {
  String action = 'Attach & Send',
  int alreadyAttached = 0,
}) => showModalBottomSheet<List<MessageAttachment>>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  backgroundColor: C.bg,
  shape: RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(R.xxl)),
  ),
  builder: (_) =>
      _UploadSheet(action: action, alreadyAttached: alreadyAttached),
);

class _Pending {
  _Pending(this.file, this.key);
  final MessageAttachment file;
  final Key key;
  bool done = false;
}

class _UploadSheet extends StatefulWidget {
  const _UploadSheet({required this.action, required this.alreadyAttached});
  final String action;
  final int alreadyAttached;

  @override
  State<_UploadSheet> createState() => _UploadSheetState();
}

class _UploadSheetState extends State<_UploadSheet> {
  final List<_Pending> _files = [];
  String? _error;
  int _seq = 0;

  /// Simulated upload time per file.
  static const uploadTime = Duration(milliseconds: 900);

  void _pick(UploadSource s) {
    final f = SimulatedPicker.pick(s);
    final err = FileUploadRules.check(
      f,
      widget.alreadyAttached + _files.length,
    );
    setState(() {
      _error = err;
      if (err == null) _files.add(_Pending(f, ValueKey('upload-${_seq++}')));
    });
  }

  bool get _ready => _files.isNotEmpty && _files.every((f) => f.done);

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(20.w, 10.h, 20.w, 16.h),
    child: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40.w,
              height: 4.h,
              margin: EdgeInsets.only(bottom: 14.h),
              decoration: BoxDecoration(
                color: C.border,
                borderRadius: BorderRadius.circular(2.r),
              ),
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text('Share Document', style: T.h2),
                        SizedBox(width: 6.w),
                        Icon(
                          Icons.verified_outlined,
                          size: 18.r,
                          color: C.primary,
                        ),
                      ],
                    ),
                    SizedBox(height: 4.h),
                    Text(
                      'Max file size: 15MB • PDF, DOCX, JPG, PNG',
                      style: T.small,
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Close',
                onPressed: () => Navigator.pop(context),
                style: IconButton.styleFrom(
                  backgroundColor: C.surfaceLow,
                  minimumSize: Size(44.r, 44.r),
                ),
                icon: Icon(Icons.close_rounded, size: 20.r, color: C.slate),
              ),
            ],
          ),
          SizedBox(height: 16.h),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12.h,
            crossAxisSpacing: 12.w,
            childAspectRatio: 1.55,
            children: [
              for (final s in UploadSource.values)
                _SourceTile(source: s, onTap: () => _pick(s)),
            ],
          ),
          if (_error != null) ...[
            SizedBox(height: 12.h),
            Row(
              children: [
                Icon(Icons.error_outline_rounded, size: 16.r, color: C.danger),
                SizedBox(width: 6.w),
                Expanded(
                  child: Text(
                    _error!,
                    style: T.small.copyWith(color: C.danger),
                  ),
                ),
              ],
            ),
          ],
          for (final p in _files) ...[
            SizedBox(height: 12.h),
            TweenAnimationBuilder<double>(
              key: p.key,
              tween: Tween(begin: 0, end: 1),
              duration: uploadTime,
              onEnd: () => setState(() => p.done = true),
              builder: (context, v, _) {
                final done = p.done || v >= 1;
                return Column(
                  children: [
                    AppFileChip(
                      name: p.file.name,
                      size: p.file.sizeLabel,
                      sub: done
                          ? 'Ready to send'
                          : 'Uploading ${(v * 100).round()}%',
                      trailing: IconButton(
                        tooltip: 'Remove ${p.file.name}',
                        onPressed: () => setState(() => _files.remove(p)),
                        icon: Icon(
                          Icons.delete_outline_rounded,
                          size: 20.r,
                          color: C.slate,
                        ),
                      ),
                    ),
                    if (!done) ...[
                      SizedBox(height: 6.h),
                      AppProgress(v, height: 4),
                    ],
                  ],
                );
              },
            ),
          ],
          SizedBox(height: 20.h),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: AppButton(
                  'Cancel',
                  kind: BtnKind.ghost,
                  onPressed: () => Navigator.pop(context),
                ),
              ),
              SizedBox(width: 12.w),
              Expanded(
                flex: 3,
                child: AppButton(
                  widget.action,
                  key: const Key('upload-confirm'),
                  icon: Icons.send_rounded,
                  onPressed: _ready
                      ? () => Navigator.pop(context, [
                          for (final p in _files) p.file,
                        ])
                      : null,
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class _SourceTile extends StatelessWidget {
  const _SourceTile({required this.source, required this.onTap});
  final UploadSource source;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final highlight = source == UploadSource.files;
    final muted = source == UploadSource.templates;
    final iconBg = switch (source) {
      UploadSource.files => C.teal,
      UploadSource.templates => C.surfaceLow,
      _ => C.primary,
    };
    return Semantics(
      button: true,
      label: '${source.title}, ${source.hint}',
      excludeSemantics: true,
      child: Material(
        color: highlight ? C.primarySoft : (muted ? C.surfaceLow : C.panel),
        borderRadius: BorderRadius.circular(R.lg),
        child: InkWell(
          borderRadius: BorderRadius.circular(R.lg),
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.all(12.w),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: 36.r,
                  height: 36.r,
                  decoration: BoxDecoration(
                    color: iconBg,
                    borderRadius: BorderRadius.circular(R.sm),
                  ),
                  child: Icon(
                    source.icon,
                    size: 20.r,
                    color: muted ? C.primary : Colors.white,
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      source.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.bodyStrong,
                    ),
                    Text(
                      source.hint,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.small,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
