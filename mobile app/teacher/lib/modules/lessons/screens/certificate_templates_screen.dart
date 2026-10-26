import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../bloc/certificates_bloc.dart';
import '../models/certificate_models.dart';
import 'certificates_screen.dart';
import 'widgets/certificate_widgets.dart';
import 'widgets/lessons_common.dart';

const _cats = ['Academic Merit', 'Sports & Athletics', 'Arts & Creative', 'Leadership & Prefect'];

/// Figma 1153:9997 "5.9.2.1 Browse All Templates". Pops with the chosen template id.
class CertificateTemplatesScreen extends StatelessWidget {
  const CertificateTemplatesScreen({super.key, this.selected});
  final String? selected;
  @override
  Widget build(BuildContext context) => CertificatesScope(child: _TemplatesView(selected: selected));
}

class _TemplatesView extends StatefulWidget {
  const _TemplatesView({this.selected});
  final String? selected;
  @override
  State<_TemplatesView> createState() => _TemplatesViewState();
}

class _TemplatesViewState extends State<_TemplatesView> {
  String _q = '', _cat = 'All Templates', _orient = 'Any';
  String? _sel;

  void _apply(String id) {
    AppDialogs.showSnackBar(context, message: 'Template applied');
    if (context.canPop()) context.pop(id);
  }

  @override
  Widget build(BuildContext context) {
    final st = context.watch<CertificatesBloc>().state;
    final all = st.templates;
    _sel ??= widget.selected ?? (all.isEmpty ? null : all.first.id);
    int cnt(String c) => c == 'All Templates' ? all.length : all.where((t) => t.category == c).length;
    final q = _q.toLowerCase();
    final shown = all
        .where((t) => (_cat == 'All Templates' || t.category == _cat) && (_orient == 'Any' || t.orientation == _orient) && '${t.name} ${t.category} ${t.desc}'.toLowerCase().contains(q))
        .toList();
    final selT = st.template(_sel ?? '');
    return DetailScaffold(
      title: 'Certificate Templates',
      fallbackRoute: RoutePaths.certificateIssue,
      bottom: Row(children: [
        if (selT != null) ...[SizedBox(width: 44.r, child: TemplateThumb(selT)), SizedBox(width: 10.w)],
        Expanded(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Active Selection', style: T.small),
            Text(selT?.name ?? 'None', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
          ]),
        ),
        SizedBox(width: 10.w),
        AppButton('Apply Template', expand: false, icon: Icons.arrow_forward_rounded, onPressed: _sel == null ? null : () => _apply(_sel!)),
      ]),
      body: !st.loaded
          ? const LessonsLoading()
          : ListView(padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 24.h), children: [
              AppSearchField(hint: 'Search template name or style...', onChanged: (v) => setState(() => _q = v)),
              SizedBox(height: 12.h),
              FilterChips(items: [for (final c in ['All Templates', ..._cats]) '$c (${cnt(c)})'], value: '$_cat (${cnt(_cat)})', onChanged: (v) => setState(() => _cat = v.split(' (').first)),
              SizedBox(height: 12.h),
              AppCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text('ACTIVE SCHOOL COLLECTION • 2026-27', style: T.caps, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    IconTile(Icons.workspace_premium_outlined, size: 34),
                  ]),
                  Text('${all.length} Official CBSE & Approved Layouts', style: T.h2),
                  SizedBox(height: 10.h),
                  Text('Orientation Format', style: T.smallStrong.copyWith(color: C.slate)),
                  SizedBox(height: 6.h),
                  AppSegmented(track: true, items: const ['Any', 'Landscape', 'Portrait'], value: _orient, onChanged: (v) => setState(() => _orient = v)),
                ]),
              ),
              SizedBox(height: 14.h),
              if (shown.isEmpty) AppEmptyState('No templates match', icon: Icons.style_outlined),
              for (final t in shown) _TemplateCard(t, selected: _sel == t.id, onSelect: () => setState(() => _sel = t.id), onChoose: () {
                setState(() => _sel = t.id);
                _apply(t.id);
              }),
            ]),
    );
  }
}

class _TemplateCard extends StatelessWidget {
  const _TemplateCard(this.t, {required this.selected, required this.onSelect, required this.onChoose});
  final CertTemplate t;
  final bool selected;
  final VoidCallback onSelect, onChoose;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 12.h),
        child: AppCard(
          color: selected ? C.primarySoft : C.bg, border: selected ? C.primary : C.border, onTap: onSelect,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              if (t.popular) const Flexible(child: Pill('Most Popular', tone: Tone.warning, icon: Icons.star_rounded)) else Flexible(child: Pill(t.category, tone: Tone.neutral)),
              const Spacer(),
              if (selected) const Pill('Selected', tone: Tone.success, icon: Icons.check_circle_outline_rounded),
            ]),
            SizedBox(height: 10.h),
            Center(child: SizedBox(width: t.portrait ? 140.w : 240.w, child: TemplateThumb(t, name: 'Student Name'))),
            SizedBox(height: 10.h),
            Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(t.name, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text('${t.category} • ${t.orientation}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(t.desc, style: T.body.copyWith(fontSize: 12.5.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
                ]),
              ),
              SizedBox(width: 8.w),
              AppButton(selected ? 'Use' : 'Choose', expand: false, small: true, kind: selected ? BtnKind.primary : BtnKind.outline, onPressed: onChoose),
            ]),
          ]),
        ),
      );
}
