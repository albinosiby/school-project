import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/certificates_bloc.dart';
import '../bloc/certificates_events.dart';
import 'certificates_screen.dart';
import 'widgets/certificate_widgets.dart';
import 'widgets/lessons_common.dart';

/// Figma 1153:3281 "5.9.1 Certificate Detail".
class CertificateDetailScreen extends StatelessWidget {
  const CertificateDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => CertificatesScope(child: _DetailView(id: id));
}

class _DetailView extends StatelessWidget {
  const _DetailView({required this.id});
  final String id;

  @override
  Widget build(BuildContext context) {
    final st = context.watch<CertificatesBloc>().state;
    final school = context.watch<SchoolBloc>().state;
    const title = 'Certificate Details';
    if (!st.loaded) return DetailScaffold(title: title, fallbackRoute: RoutePaths.certificates, body: const LessonsLoading());
    final c = st.certificate(id);
    if (c == null) {
      return DetailScaffold(title: title, fallbackRoute: RoutePaths.certificates, body: Center(child: AppEmptyState('Certificate not found', icon: Icons.workspace_premium_outlined)));
    }
    final bloc = context.read<CertificatesBloc>();
    final stu = school.students.where((s) => s.id == c.studentId).firstOrNull;
    final tpl = st.template(c.templateId);
    final mentor = school.teacher?.name ?? 'Class Mentor';
    CertificateView view() => CertificateView(
          heading: 'Certificate of Commendation', title: c.title, student: c.student, citation: c.citation, accent: templateColor(tpl),
          meta: '${c.rollLabel} • Class ${c.cls}', date: fmtIso(c.date, 'd MMMM, yyyy'), code: c.code, signed: c.issued, mentor: mentor,
          school: school.teacher?.school.isNotEmpty == true ? school.teacher!.school : 'Delhi Public School',
        );
    return DetailScaffold(
      title: title,
      fallbackRoute: RoutePaths.certificates,
      actions: [
        IconButton(
          tooltip: 'Revoke certificate',
          icon: Icon(Icons.delete_outline_rounded, color: C.danger, size: 24.r),
          onPressed: () async {
            final ok = await AppDialogs.showConfirmDialog(context,
                title: 'Revoke certificate?', message: 'The record will be removed from the student documents.', confirm: 'Revoke', danger: true);
            if (ok) bloc.add(CertificateRevoked(id));
          },
        ),
      ],
      bottom: c.issued
          ? Row(children: [
              Expanded(child: AppButton('Download', icon: Icons.download_rounded, kind: BtnKind.outline, onPressed: () => AppDialogs.showSnackBar(context, message: 'Downloading certificate PDF…'))),
              SizedBox(width: 10.w),
              Expanded(child: AppButton('Share', icon: Icons.share_outlined, onPressed: () => bloc.add(CertificateShared('${c.title} - ${c.student}')))),
            ])
          : AppButton('Sign & Issue', icon: Icons.edit_note_rounded, onPressed: () => bloc.add(CertificateSigned(id))),
      body: ListView(padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 24.h), children: [
        Row(children: [
          Flexible(child: certStatusPill(c.issued)),
          SizedBox(width: 8.w),
          Text('• ${fmtIso(c.date, 'MMM d, yyyy')}', style: T.small),
          const Spacer(),
          Icon(Icons.verified_outlined, size: 16.r, color: C.primary),
          SizedBox(width: 4.w),
          Flexible(child: Text('DigiLocker Synced', style: T.smallStrong.copyWith(color: C.primary), maxLines: 1, overflow: TextOverflow.ellipsis)),
        ]),
        SizedBox(height: 12.h),
        AppCard(
          child: Column(children: [
            view(),
            SizedBox(height: 12.h),
            Row(children: [
              Icon(Icons.shield_outlined, size: 18.r, color: C.successDark),
              SizedBox(width: 6.w),
              Expanded(child: Text('Tamper-evident CBSE Digital Credential', style: T.small.copyWith(color: C.ink))),
              TextButton.icon(
                style: TextButton.styleFrom(minimumSize: Size(0, 44.h)),
                onPressed: () => showDialog(
                  context: context,
                  builder: (ctx) => Dialog(insetPadding: EdgeInsets.all(12.r), child: SingleChildScrollView(padding: EdgeInsets.all(8.r), child: view())),
                ),
                icon: Icon(Icons.fullscreen_rounded, size: 18.r),
                label: const Text('Full View'),
              ),
            ]),
          ]),
        ),
        SizedBox(height: 14.h),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('AWARDED RECIPIENT', style: T.capsMuted, maxLines: 1, overflow: TextOverflow.ellipsis)),
              SizedBox(width: 8.w),
              const Flexible(child: Pill('Active Student', tone: Tone.success, dot: true)),
            ]),
            SizedBox(height: 12.h),
            Row(children: [
              Avatar(c.student, size: 56),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(child: Text(c.student, style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    SizedBox(width: 6.w),
                    Pill(c.rollLabel),
                  ]),
                  Text('Class ${c.cls} • Academic Session 2026-27', style: T.body),
                  if (stu != null) Text('Guardian: ${stu.guardian}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ]),
              ),
            ]),
          ]),
        ),
        SizedBox(height: 14.h),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('RECORD', style: T.capsMuted),
            SizedBox(height: 8.h),
            _Row('Certificate ID', c.code),
            _Row('Award', c.title),
            _Row('Template', tpl?.name ?? '—'),
            _Row('Authority', c.authority),
          ]),
        ),
      ]),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.k, this.v);
  final String k, v;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.symmetric(vertical: 4.h),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 110.w, child: Text(k, style: T.small)),
          Expanded(child: Text(v, style: T.bodyStrong.copyWith(fontSize: 13.sp))),
        ]),
      );
}
