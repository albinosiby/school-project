import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/certificates_bloc.dart';
import '../bloc/certificates_events.dart';
import '../bloc/certificates_states.dart';
import 'widgets/certificate_widgets.dart';
import 'widgets/lessons_common.dart';

/// Provides a fresh [CertificatesBloc] (loaded) and routes its notices to [handleNotice].
class CertificatesScope extends StatelessWidget {
  const CertificatesScope({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<CertificatesBloc>()..add(const CertificatesLoadRequested()),
        child: BlocListener<CertificatesBloc, CertificatesState>(
          listenWhen: (a, b) => a.notice != b.notice && b.notice != null,
          listener: (context, s) => handleNotice(context, s.notice!),
          child: child,
        ),
      );
}

/// Figma 1153:3119 "5.9 Certificates" (Student Awards).
class CertificatesScreen extends StatelessWidget {
  const CertificatesScreen({super.key});
  @override
  Widget build(BuildContext context) => const CertificatesScope(child: _CertificatesView());
}

class _CertificatesView extends StatefulWidget {
  const _CertificatesView();
  @override
  State<_CertificatesView> createState() => _CertificatesViewState();
}

class _CertificatesViewState extends State<_CertificatesView> {
  String _q = '', _f = 'All';

  @override
  Widget build(BuildContext context) {
    final st = context.watch<CertificatesBloc>().state;
    final bloc = context.read<CertificatesBloc>();
    final all = st.certificates;
    final pending = st.pendingCount;
    final q = _q.toLowerCase();
    final shown = all
        .where((c) => '${c.student} ${c.title} ${c.code}'.toLowerCase().contains(q) && (_f == 'All' || (_f == 'Pending' ? !c.issued : c.issued)))
        .toList();
    final counts = {'All': all.length, 'Pending': pending, 'Issued': all.length - pending};
    return DetailScaffold(
      title: 'Certificates & Awards',
      fallbackRoute: RoutePaths.more,
      bottom: AppButton('Issue Certificate', icon: Icons.add_circle_outline_rounded, onPressed: () => context.push(RoutePaths.certificateIssue)),
      body: !st.loaded
          ? const LessonsLoading()
          : ListView(padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 24.h), children: [
              const CertTabs(value: 'Student Awards'),
              SizedBox(height: 12.h),
              AppSearchField(hint: 'Search student name, award, or ID...', onChanged: (v) => setState(() => _q = v)),
              SizedBox(height: 12.h),
              FilterChips(items: [for (final f in counts.keys) '$f (${counts[f]})'], value: '$_f (${counts[_f]})', onChanged: (v) => setState(() => _f = v.split(' (').first)),
              if (pending > 0) ...[
                SizedBox(height: 10.h),
                Align(
                  alignment: Alignment.centerLeft,
                  child: ActionChip(
                    avatar: Icon(Icons.edit_note_rounded, size: 18.r, color: C.warningDark),
                    backgroundColor: C.warningSoft, side: const BorderSide(color: C.warning),
                    label: Text('Sign Pending ($pending)', style: T.bodyStrong.copyWith(color: C.warningDark, fontSize: 13.sp)),
                    onPressed: () async {
                      final ok = await AppDialogs.showConfirmDialog(context,
                          title: 'Sign $pending certificates?', message: 'Your digital signature will be applied and they will be issued to students.', confirm: 'Sign & Issue');
                      if (ok) bloc.add(const PendingCertificatesSigned());
                    },
                  ),
                ),
              ],
              SizedBox(height: 14.h),
              if (shown.isEmpty) AppEmptyState('No certificates found', hint: 'Issue a certificate to a student.', icon: Icons.workspace_premium_outlined),
              for (final c in shown)
                Padding(
                  padding: EdgeInsets.only(bottom: 12.h),
                  child: AppCard(
                    padding: EdgeInsets.all(12.r),
                    onTap: () => context.push(RoutePaths.certificate(c.id)),
                    child: Row(children: [
                      Avatar(c.student, size: 48),
                      SizedBox(width: 12.w),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Flexible(child: Text(c.student, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                            SizedBox(width: 6.w),
                            Text(c.rollLabel, style: T.small),
                          ]),
                          Text(c.title, style: T.body.copyWith(color: C.ink), maxLines: 1, overflow: TextOverflow.ellipsis),
                          SizedBox(height: 4.h),
                          certStatusPill(c.issued),
                          SizedBox(height: 2.h),
                          Text(c.issued ? 'Verified & Issued • ${fmtIso(c.date)}' : 'Awaiting your signature',
                              style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                        ]),
                      ),
                      Column(children: [
                        IconButton(
                          tooltip: 'Download PDF',
                          onPressed: () => AppDialogs.showSnackBar(context, message: 'Downloading certificate PDF…'),
                          icon: Icon(Icons.download_rounded, color: C.slate, size: 22.r),
                        ),
                        IconButton(
                          tooltip: 'Share',
                          onPressed: () => bloc.add(CertificateShared('${c.title} - ${c.student}')),
                          icon: Icon(Icons.share_outlined, color: C.slate, size: 22.r),
                        ),
                      ]),
                    ]),
                  ),
                ),
            ]),
    );
  }
}
