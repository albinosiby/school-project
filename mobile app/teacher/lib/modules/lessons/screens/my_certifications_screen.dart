import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/certificates_bloc.dart';
import '../bloc/certificates_events.dart';
import '../models/certificate_models.dart';
import 'certificates_screen.dart';
import 'widgets/certificate_widgets.dart';
import 'widgets/lessons_common.dart';

/// Figma 1153:9274 "5.9.1 My Certifications".
class MyCertificationsScreen extends StatelessWidget {
  const MyCertificationsScreen({super.key});
  @override
  Widget build(BuildContext context) => const CertificatesScope(child: _MineView());
}

class _MineView extends StatefulWidget {
  const _MineView();
  @override
  State<_MineView> createState() => _MineViewState();
}

class _MineViewState extends State<_MineView> {
  String _q = '', _f = 'All';
  bool _latest = true;

  static const _filters = ['All', 'Active / Verified', 'Expiring Soon', 'Degrees', 'CPD Credits'];

  bool _match(MyCertification c, String f) => switch (f) {
        'Active / Verified' => c.status == 'verified' || c.status == 'active',
        'Expiring Soon' => c.status == 'expiring',
        'Degrees' => c.kind == 'degree',
        'CPD Credits' => c.hours > 0,
        _ => true,
      };

  @override
  Widget build(BuildContext context) {
    final st = context.watch<CertificatesBloc>().state;
    final me = context.watch<SchoolBloc>().state.teacher;
    final all = st.mine;
    final q = _q.toLowerCase();
    final shown = all.where((c) => _match(c, _f) && '${c.title} ${c.issuer} ${c.code}'.toLowerCase().contains(q)).toList();
    if (!_latest) shown.sort((a, b) => a.title.compareTo(b.title));
    final hrs = all.fold<int>(0, (a, c) => a + c.hours);
    int count(String f) => all.where((c) => _match(c, f)).length;
    return DetailScaffold(
      title: 'My Certifications',
      fallbackRoute: RoutePaths.more,
      body: !st.loaded
          ? const LessonsLoading()
          : ListView(padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 24.h), children: [
              const CertTabs(value: 'My Certifications'),
              SizedBox(height: 12.h),
              AppSearchField(hint: 'Search faculty award, or ID...', onChanged: (v) => setState(() => _q = v)),
              SizedBox(height: 12.h),
              FilterChips(items: [for (final f in _filters) '$f (${count(f)})'], value: '$_f (${count(_f)})', onChanged: (v) => setState(() => _f = v.split(' (').first)),
              SizedBox(height: 14.h),
              AppCard(
                child: Column(children: [
                  Row(children: [
                    Avatar(me?.name ?? 'Teacher', size: 48),
                    SizedBox(width: 12.w),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(me?.name ?? 'Teacher', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                        Text('${me?.title ?? ''} • ${me?.empId ?? ''}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                      ]),
                    ),
                    const Pill('Verified', tone: Tone.success, icon: Icons.verified_rounded),
                  ]),
                  SizedBox(height: 14.h),
                  Container(
                    padding: EdgeInsets.symmetric(vertical: 10.h),
                    decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
                    child: Row(children: [
                      Expanded(child: _K('${all.length}', 'TOTAL CERTS', C.primary)),
                      Expanded(child: _K('$hrs hrs', 'CPD LOGGED', C.ink)),
                      Expanded(child: _K('${all.where((c) => c.status == 'expiring').length}', 'EXPIRING', C.warningDark)),
                    ]),
                  ),
                ]),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(2.w, 16.h, 0, 8.h),
                child: Row(children: [
                  Expanded(child: Text('Institutional Portfolio · ${shown.length} items', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  TextButton(
                    style: TextButton.styleFrom(minimumSize: Size(0, 44.h)),
                    onPressed: () => setState(() => _latest = !_latest),
                    child: Text('Sort: ${_latest ? 'Latest' : 'A–Z'}', style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.sp)),
                  ),
                ]),
              ),
              if (shown.isEmpty) AppEmptyState('No certifications match', icon: Icons.workspace_premium_outlined),
              for (final c in shown) _MineCard(c),
              AppCard(
                color: C.panel, border: C.panelBorder,
                child: Row(children: [
                  IconTile(Icons.sync_rounded, tone: Tone.success),
                  SizedBox(width: 12.w),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('DigiLocker & APAAR Linked', style: T.bodyStrong),
                      Text('CBSE & NCERT credentials sync with national educator profile.', style: T.small),
                    ]),
                  ),
                  const Pill('Synced', tone: Tone.success),
                ]),
              ),
            ]),
    );
  }
}

class _MineCard extends StatelessWidget {
  const _MineCard(this.c);
  final MyCertification c;
  @override
  Widget build(BuildContext context) {
    final bloc = context.read<CertificatesBloc>();
    final expiring = c.status == 'expiring';
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            IconTile(Icons.workspace_premium_rounded, tone: expiring ? Tone.warning : Tone.brand, size: 44),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(c.title, style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis),
                Text(c.issuer, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
              ]),
            ),
            SizedBox(width: 6.w),
            Pill(expiring ? 'Expiring' : (c.status == 'active' ? 'Active' : 'Verified'), tone: expiring ? Tone.warning : Tone.success, dot: true),
          ]),
          SizedBox(height: 10.h),
          Wrap(spacing: 6.w, runSpacing: 6.h, children: [for (final t in c.tags) AppTagChip(t, neutral: true)]),
          Padding(padding: EdgeInsets.symmetric(vertical: 10.h), child: const Divider(height: 1, color: C.border)),
          Row(children: [
            Icon(Icons.calendar_today_outlined, size: 14.r, color: C.slate),
            SizedBox(width: 6.w),
            Expanded(child: Text(c.validity, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
            SizedBox(width: 6.w),
            Flexible(child: Text('ID: ${c.code}', style: T.small.copyWith(fontSize: 11.sp, letterSpacing: .5), maxLines: 1, overflow: TextOverflow.ellipsis)),
          ]),
          SizedBox(height: 10.h),
          Row(children: [
            Expanded(
              flex: 3,
              child: AppButton('Download PDF', icon: Icons.download_rounded, small: true, kind: BtnKind.soft,
                  onPressed: () => AppDialogs.showSnackBar(context, message: 'Downloading ${c.code}.pdf…')),
            ),
            SizedBox(width: 10.w),
            Expanded(flex: 2, child: AppButton('Share', icon: Icons.share_outlined, small: true, kind: BtnKind.outline, onPressed: () => bloc.add(CertificateShared(c.title)))),
          ]),
        ]),
      ),
    );
  }
}

class _K extends StatelessWidget {
  const _K(this.v, this.l, this.color);
  final String v, l;
  final Color color;
  @override
  Widget build(BuildContext context) => Column(children: [
        FittedBox(fit: BoxFit.scaleDown, child: Text(v, style: T.stat.copyWith(fontSize: 20.sp, color: color))),
        Text(l, style: T.capsMuted.copyWith(fontSize: 10.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
      ]);
}
