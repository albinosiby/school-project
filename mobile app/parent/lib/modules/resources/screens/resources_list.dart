import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../academics/screens/widgets/academic_section_title.dart';
import '../bloc/resources_bloc.dart';
import '../models/resource_models.dart';

/// Look of a resource type: icon, tone and label.
({IconData icon, Tone tone, String label}) resourceLook(String type) => switch (type) {
  'video' => (icon: Icons.smart_display_rounded, tone: Tone.danger, label: 'Video'),
  'pdf' => (icon: Icons.picture_as_pdf_rounded, tone: Tone.danger, label: 'PDF'),
  'word' => (icon: Icons.description_rounded, tone: Tone.brand, label: 'Word'),
  'slides' => (icon: Icons.slideshow_rounded, tone: Tone.warning, label: 'Slides'),
  'sheet' => (icon: Icons.table_chart_rounded, tone: Tone.success, label: 'Sheet'),
  'image' => (icon: Icons.image_rounded, tone: Tone.success, label: 'Image'),
  'drive' => (icon: Icons.add_to_drive_rounded, tone: Tone.success, label: 'Drive'),
  'link' => (icon: Icons.link_rounded, tone: Tone.brand, label: 'Link'),
  _ => (icon: Icons.insert_drive_file_rounded, tone: Tone.neutral, label: 'File'),
};

/// Resources section of the Academics tab: what the child's teachers shared (videos, files, links).
class ResourcesList extends StatelessWidget {
  const ResourcesList({super.key});

  @override
  Widget build(BuildContext context) => ChildDataView<ResourcesBloc, List<ClassResource>>(
    create: () => getIt<ResourcesBloc>(),
    isEmpty: (d) => d.isEmpty,
    emptyTitle: 'No resources shared yet',
    emptyHint: 'Videos, files and links your child\'s teachers share will appear here.',
    emptyIcon: Icons.folder_open_rounded,
    builder: (context, data, child) => ResourcesBody(key: ValueKey(child.id), items: data),
  );
}

class ResourcesBody extends StatefulWidget {
  const ResourcesBody({super.key, required this.items});
  final List<ClassResource> items;

  @override
  State<ResourcesBody> createState() => _ResourcesBodyState();
}

class _ResourcesBodyState extends State<ResourcesBody> {
  static const _filters = ['All', 'Videos', 'Files', 'Links'];
  String _filter = 'All';

  bool _in(ClassResource r, String f) => switch (f) {
    'Videos' => r.type == 'video',
    'Files' => r.kind == ResourceKind.file && r.type != 'video',
    'Links' => r.kind == ResourceKind.link,
    _ => true,
  };

  @override
  Widget build(BuildContext context) {
    final items = ClassResource.sorted(widget.items);
    final shown = [for (final r in items) if (_in(r, _filter)) r];
    return ListView(
      key: const Key('section-list'),
      padding: academicListPadding(),
      children: [
        AppSolidChips(
          key: const Key('resource-filters'),
          items: _filters,
          value: _filter,
          labelOf: (f) => '$f (${items.where((r) => _in(r, f)).length})',
          onChanged: (v) => setState(() => _filter = v),
        ),
        AcademicSectionTitle('Shared by teachers', icon: Icons.folder_shared_rounded, caption: '${shown.length} shown'),
        if (shown.isEmpty)
          AppSurfaceCard(
            child: Center(child: AppEmptyState('No ${_filter.toLowerCase()} yet', hint: 'Try another filter.', icon: Icons.filter_alt_off_outlined)),
          )
        else
          for (final r in shown) _ResourceCard(r),
        academicListEnd(),
      ],
    );
  }
}

Future<void> openResource(BuildContext context, ClassResource r) async {
  final uri = Uri.tryParse(r.url);
  final ok = uri != null && await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open this resource.')));
  }
}

class _ResourceCard extends StatelessWidget {
  const _ResourceCard(this.r);
  final ClassResource r;

  @override
  Widget build(BuildContext context) {
    final look = resourceLook(r.type);
    final meta = [
      if (r.teacher.isNotEmpty) r.teacher,
      if (r.createdAt != null) fmtShort(r.createdAt!),
      if (r.sizeLabel.isNotEmpty) r.sizeLabel,
    ].join(' • ');
    final thumb = r.thumbnail;
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: Material(
        color: C.bg,
        borderRadius: BorderRadius.circular(R.lg),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          key: Key('resource-${r.id}'),
          onTap: () => openResource(context, r),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(R.lg),
              border: Border.all(color: C.outline.withValues(alpha: .6)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (thumb != null)
                  AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.network(
                          thumb,
                          key: Key('thumb-${r.id}'),
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => Container(color: C.surfaceLow, child: Icon(Icons.smart_display_rounded, size: 40.r, color: C.slate)),
                        ),
                        Center(
                          child: Container(
                            width: 54.r,
                            height: 54.r,
                            decoration: BoxDecoration(color: Colors.black.withValues(alpha: .55), shape: BoxShape.circle),
                            child: Icon(Icons.play_arrow_rounded, color: Colors.white, size: 34.r),
                          ),
                        ),
                      ],
                    ),
                  ),
                Padding(
                  padding: EdgeInsets.all(12.r),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (thumb == null) ...[
                        IconTile(look.icon, tone: look.tone, size: 44),
                        SizedBox(width: 12.w),
                      ],
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(child: Text(r.title, style: T.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis)),
                                if (r.pinned) Icon(Icons.push_pin_rounded, size: 16.r, color: C.primary),
                              ],
                            ),
                            if (r.description.isNotEmpty) ...[
                              SizedBox(height: 2.h),
                              Text(r.description, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
                            ],
                            SizedBox(height: 6.h),
                            Wrap(
                              spacing: 6.w,
                              runSpacing: 4.h,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Pill(look.label, tone: look.tone),
                                if (r.subject.isNotEmpty) AppTagChip(r.subject, icon: Icons.auto_stories_outlined),
                                if (meta.isNotEmpty) Text(meta, style: T.small.copyWith(fontSize: 11.5.sp)),
                              ],
                            ),
                          ],
                        ),
                      ),
                      SizedBox(width: 6.w),
                      Icon(r.kind == ResourceKind.file ? Icons.download_rounded : Icons.open_in_new_rounded, size: 18.r, color: C.slate),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
