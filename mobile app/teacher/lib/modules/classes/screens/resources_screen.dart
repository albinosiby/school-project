import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/models/school_models.dart';
import '../bloc/resources_bloc.dart';
import '../bloc/resources_events.dart';
import '../bloc/resources_states.dart';
import '../models/classes_models.dart';
import '../models/student_metrics.dart';
import 'widgets/classes_ui.dart';

const _cats = ['Worksheets', 'Notes & Formulas', 'Blueprints'];
const _capacityKb = 20 * 1024;

/// Figma 1153:10594 "3.2 Shared Resources".
class ResourcesScreen extends StatelessWidget {
  const ResourcesScreen({super.key, this.classId});
  final String? classId;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<ResourcesBloc>()..add(const ResourcesLoadRequested()),
        child: BlocListener<ResourcesBloc, ResourcesState>(
          listenWhen: (a, b) => a.noticeSeq != b.noticeSeq,
          listener: (ctx, s) => showNotice(ctx, s.notice),
          child: _ResourcesView(classId: classId),
        ),
      );
}

class _ResourcesView extends StatefulWidget {
  const _ResourcesView({this.classId});
  final String? classId;
  @override
  State<_ResourcesView> createState() => _ResourcesViewState();
}

class _ResourcesViewState extends State<_ResourcesView> {
  String _cat = 'All';
  String _q = '';
  bool _byName = false;
  final _search = FocusNode();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _upload(SchoolClass cls) {
    final bloc = context.read<ResourcesBloc>();
    final name = TextEditingController();
    var cat = _cats.first;
    String? err;
    return showAppSheet(context, title: 'Upload Resource', subtitle: 'Class ${clsName(cls)}', builder: (ctx) => StatefulBuilder(
          builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            AppTextField(label: 'File name', controller: name, hint: 'e.g. Chapter 5 Worksheet.pdf'),
            AppDropdown<String>(label: 'Category', value: cat, items: _cats, onChanged: (v) => set(() => cat = v)),
            if (err != null) Text(err!, style: T.small.copyWith(color: C.danger)),
            SizedBox(height: 6.h),
            AppButton('Upload', icon: Icons.cloud_upload_outlined, onPressed: () {
              if (name.text.trim().isEmpty) {
                set(() => err = 'Enter a file name');
                return;
              }
              bloc.add(ResourceUploaded(classId: cls.id, fileName: name.text, category: cat));
              Navigator.pop(ctx);
            }),
          ]),
        ));
  }

  Widget _sortButton() => Semantics(
        label: 'Sort resources', button: true,
        child: InkResponse(
          onTap: () => setState(() => _byName = !_byName),
          child: Container(
            width: 48.r, height: 48.r,
            decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.panelBorder)),
            child: Icon(_byName ? Icons.sort_by_alpha_rounded : Icons.swap_vert_rounded, color: C.ink, size: 22.r),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final st = context.watch<ResourcesBloc>().state;
    final cls = classOr(school.classes, widget.classId);
    final all = cls == null ? const <SharedResource>[] : st.of(cls.id);
    final usedKb = all.fold<num>(0, (a, r) => a + r.sizeKb);
    int count(String c) => all.where((r) => r.category == c).length;
    final q = _q.trim().toLowerCase();
    final shown = [
      for (final r in all)
        if ((_cat == 'All' || r.category == _cat) && (q.isEmpty || '${r.title} ${r.tag} ${r.subtitle} ${r.category}'.toLowerCase().contains(q))) r
    ]..sort((a, b) => _byName ? a.title.compareTo(b.title) : b.uploadedAt.compareTo(a.uploadedAt));
    final pinned = shown.where((r) => r.pinned).toList();
    final rest = shown.where((r) => !r.pinned).toList();

    return DetailScaffold(
      title: 'SHARED RESOURCES', fallbackRoute: RoutePaths.classes,
      actions: [IconAction(Icons.search_rounded, 'Search resources', () => _search.requestFocus())],
      body: cls == null
          ? const AppEmptyState('No classes assigned', icon: Icons.class_outlined)
          : ListView(padding: EdgeInsets.fromLTRB(16.w, 14.h, 16.w, 40.h), children: [
              PanelCard(
                padding: EdgeInsets.all(14.w),
                child: Column(children: [
                  Row(children: [
                    const IconTile(Icons.cloud_sync_outlined, size: 44),
                    SizedBox(width: 12.w),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Flexible(child: Text('${all.length} Shared Files', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
                          SizedBox(width: 6.w),
                          Pill(fmtSize(usedKb)),
                        ]),
                        Text('Google Drive Synced', style: T.small),
                      ]),
                    ),
                    const Pill('Active', tone: Tone.success, dot: true),
                  ]),
                  SizedBox(height: 12.h),
                  AppProgress((usedKb / _capacityKb).toDouble(), height: 6),
                  SizedBox(height: 6.h),
                  Row(children: [
                    Expanded(child: Text('Curriculum Space (${(usedKb * 100 / _capacityKb).round()}% used)', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    Text('${((_capacityKb - usedKb) / 1024).toStringAsFixed(1)} MB Available', style: T.smallStrong.copyWith(color: C.primary)),
                  ]),
                ]),
              ),
              SizedBox(height: 14.h),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(children: [
                  for (final c in ['All', ..._cats]) ...[
                    CountTab(c, count: '${c == 'All' ? all.length : count(c)}', on: _cat == c, onTap: () => setState(() => _cat = c)),
                    SizedBox(width: 8.w),
                  ],
                ]),
              ),
              SizedBox(height: 12.h),
              Row(children: [
                Expanded(
                  child: TextField(
                    focusNode: _search, onChanged: (v) => setState(() => _q = v), style: T.bodyStrong.copyWith(fontWeight: FontWeight.w500),
                    decoration: InputDecoration(hintText: 'Search resources, topics...', prefixIcon: Icon(Icons.search_rounded, color: C.muted, size: 22.r)),
                  ),
                ),
                SizedBox(width: 10.w),
                _sortButton(),
              ]),
              SizedBox(height: 12.h),
              AppButton('Upload Resource', icon: Icons.add_circle_outline_rounded, onPressed: () => _upload(cls)),
              if (st.status == ResourcesStatus.loaded && shown.isEmpty)
                const AppEmptyState('No resources found', hint: 'Upload a resource or change your search.', icon: Icons.folder_off_outlined),
              if (pinned.isNotEmpty) ...[
                _Head('Pinned Handouts', pinned.length, Icons.push_pin_rounded, C.warning),
                for (var i = 0; i < pinned.length; i++) _ResCard(pinned[i], featured: i == 0),
              ],
              for (final c in _cats)
                if (rest.any((r) => r.category == c)) ...[
                  _Head(switch (c) { 'Worksheets' => 'Worksheets & Practice Sets', 'Blueprints' => 'Administrative & Syllabi', _ => 'Notes & Formulas' },
                      rest.where((r) => r.category == c).length, Icons.assignment_rounded, C.primary),
                  for (final r in rest.where((r) => r.category == c)) _ResCard(r),
                ],
              SizedBox(height: 16.h),
              AppToggleRow(
                tinted: true, title: 'Student Portal Visibility', subtitle: 'Instant access synchronization for Class ${clsLong(cls)}',
                value: st.portalVisible, onChanged: (v) => context.read<ResourcesBloc>().add(PortalVisibilityChanged(v)),
              ),
            ]),
    );
  }
}

class _Head extends StatelessWidget {
  const _Head(this.title, this.n, this.icon, this.color);
  final String title;
  final int n;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(2.w, 20.h, 2.w, 10.h),
        child: Row(children: [
          Icon(icon, size: 18.r, color: color),
          SizedBox(width: 8.w),
          Expanded(child: Text(title, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
          Pill('$n ${n == 1 ? 'File' : 'Files'}', tone: Tone.neutral),
        ]),
      );
}

class _ResCard extends StatelessWidget {
  const _ResCard(this.r, {this.featured = false});
  final SharedResource r;
  final bool featured;

  Future<void> _menu(BuildContext context, String v) async {
    final bloc = context.read<ResourcesBloc>();
    if (v == 'pin') bloc.add(ResourcePinToggled(r));
    if (v == 'delete' &&
        await AppDialogs.showConfirmDialog(context, title: 'Delete resource?', message: '${r.title} will be removed for all students.', confirm: 'Delete', danger: true)) {
      bloc.add(ResourceDeleted(r));
    }
  }

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<ResourcesBloc>();
    final tone = switch (r.tagTone) { 'success' => Tone.success, 'neutral' => Tone.neutral, _ => Tone.brand };
    final isDoc = r.ext == 'docx';
    return AppCard(
      margin: EdgeInsets.only(bottom: 12.h), border: r.pinned ? C.panelBorder : C.border, padding: EdgeInsets.all(14.w),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          IconTile(isDoc ? Icons.description_rounded : Icons.picture_as_pdf_rounded, tone: isDoc ? Tone.brand : Tone.danger, size: 44),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(child: Text(r.title, style: T.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis)),
                if (r.isNew) Padding(padding: EdgeInsets.only(left: 6.w), child: const Pill('NEW', tone: Tone.success)),
                if (featured) Padding(padding: EdgeInsets.only(left: 6.w), child: const Pill('Featured', icon: Icons.push_pin_rounded)),
              ]),
              SizedBox(height: 2.h),
              Text('${fmtSize(r.sizeKb)} • ${r.subtitle}${r.stat.isEmpty ? '' : ' • ${r.stat}'}', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
            ]),
          ),
        ]),
        Divider(height: 22.h, color: C.border),
        Row(children: [
          Expanded(child: Align(alignment: Alignment.centerLeft, child: Pill(r.tag, tone: tone))),
          IconAction(Icons.share_outlined, 'Share ${r.title}', () => bloc.add(ResourceShared(r))),
          IconAction(Icons.download_rounded, 'Download ${r.title}', () => bloc.add(ResourceDownloaded(r))),
          PopupMenuButton<String>(
            tooltip: 'More options for ${r.title}', onSelected: (v) => _menu(context, v),
            itemBuilder: (_) => [PopupMenuItem(value: 'pin', child: Text(r.pinned ? 'Unpin' : 'Pin to top')), const PopupMenuItem(value: 'delete', child: Text('Delete'))],
          ),
        ]),
      ]),
    );
  }
}
