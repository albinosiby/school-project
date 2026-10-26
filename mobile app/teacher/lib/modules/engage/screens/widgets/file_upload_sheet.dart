import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../models/attachment_models.dart';

/// Sample files "picked" by the simulated browser (no real file access).
const sampleUploadFiles = [
  FileRef(name: 'Optics_Lab_Manual_v2.pdf', size: '4.8 MB'),
  FileRef(name: 'Class_Schedule_Term2.png', size: '1.2 MB'),
  FileRef(name: 'Worksheet_4_5.pdf', size: '620 KB'),
  FileRef(name: 'Progress_Report.docx', size: '310 KB'),
];

/// Figma "File Upload Popup": tap the drop zone to add a (simulated) file, remove / clear, then Add.
/// Returns the full attachment list, or null when cancelled.
Future<List<FileRef>?> showFileUploadSheet(BuildContext context, List<FileRef> current) {
  var files = [...current];
  return showAppSheet<List<FileRef>>(context, title: 'Upload Attachment', builder: (ctx) => StatefulBuilder(builder: (ctx, set) {
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Semantics(
            button: true, label: 'Browse files',
            child: InkWell(
              borderRadius: BorderRadius.circular(R.lg),
              onTap: () => set(() => files = [...files, sampleUploadFiles[files.length % sampleUploadFiles.length]]),
              child: Container(
                width: double.infinity, padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 20.h),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
                child: Column(children: [
                  Container(
                    width: 44.r, height: 44.r, alignment: Alignment.center,
                    decoration: const BoxDecoration(color: C.bg, shape: BoxShape.circle),
                    child: Icon(Icons.upload_file_rounded, color: C.primary, size: 24.r),
                  ),
                  SizedBox(height: 10.h),
                  Text('Tap to browse or drop files', style: T.bodyStrong, textAlign: TextAlign.center),
                  Text('Supports PDF, Word, Images, Audio, ZIP up to 50 MB', style: T.small, textAlign: TextAlign.center),
                ]),
              ),
            ),
          ),
          SizedBox(height: 14.h),
          Row(children: [
            Expanded(child: Text('ATTACHED FILES (${files.length})', style: T.capsMuted)),
            if (files.isNotEmpty) TextButton(onPressed: () => set(() => files = []), child: Text('Clear all', style: T.smallStrong.copyWith(color: C.primary))),
          ]),
          if (files.isEmpty) Padding(padding: EdgeInsets.symmetric(vertical: 8.h), child: Text('No files attached yet', style: T.body)),
          for (var i = 0; i < files.length; i++)
            Padding(
              padding: EdgeInsets.only(bottom: 8.h),
              child: AppFileChip(
                name: files[i].name, size: files[i].size, sub: 'Ready', tone: Tone.brand,
                trailing: IconButton(tooltip: 'Remove file', icon: Icon(Icons.close_rounded, size: 18.r, color: C.slate), onPressed: () => set(() => files = [...files]..removeAt(i))),
              ),
            ),
          SizedBox(height: 10.h),
          Row(children: [
            Expanded(child: AppButton('Cancel', kind: BtnKind.outline, onPressed: () => Navigator.pop(ctx))),
            SizedBox(width: 10.w),
            Expanded(flex: 2, child: AppButton('Add', icon: Icons.send_outlined, onPressed: () => Navigator.pop(ctx, files))),
          ]),
        ]);
      }));
}
