import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/certificates_bloc.dart';
import '../bloc/certificates_events.dart';
import '../models/certificate_models.dart';
import 'certificates_screen.dart';
import 'widgets/certificate_widgets.dart';
import 'widgets/lessons_common.dart';

/// Figma 1153:9860 "5.9.2.1 Certificate Preview" — shows the draft composed on the Issue screen.
class CertificatePreviewScreen extends StatelessWidget {
  const CertificatePreviewScreen({super.key});
  @override
  Widget build(BuildContext context) => const CertificatesScope(child: _PreviewView());
}

class _PreviewView extends StatelessWidget {
  const _PreviewView();

  @override
  Widget build(BuildContext context) {
    final st = context.watch<CertificatesBloc>().state;
    final school = context.watch<SchoolBloc>().state;
    const title = 'Certificate Preview';
    if (!st.loaded) return DetailScaffold(title: title, fallbackRoute: RoutePaths.certificateIssue, body: const LessonsLoading());
    final d = st.draft;
    final stu = d == null ? null : school.students.where((s) => s.id == d.studentId).firstOrNull;
    if (d == null || stu == null) {
      return DetailScaffold(
        title: title, fallbackRoute: RoutePaths.certificateIssue,
        body: Center(child: AppEmptyState('Nothing to preview', hint: 'Fill the issue form first.', icon: Icons.workspace_premium_outlined)),
      );
    }
    final cls = school.classById(stu.classId);
    final tpl = st.template(d.templateId);
    final me = school.teacher;
    final clsLabel = cls?.label ?? '';
    final code = st.nextCode;
    final roll = '${stu.roll}'.padLeft(2, '0');
    return DetailScaffold(
      title: title,
      fallbackRoute: RoutePaths.certificateIssue,
      bottom: Row(children: [
        Expanded(child: AppButton('Back to Edit', kind: BtnKind.outline, onPressed: () => context.pop())),
        SizedBox(width: 10.w),
        Expanded(
          flex: 2,
          child: AppButton('Confirm & Issue', icon: Icons.verified_outlined, onPressed: () => context.read<CertificatesBloc>().add(CertificateIssued(StudentCertificate(
                id: '', studentId: stu.id, student: stu.name, roll: stu.roll, cls: clsLabel, title: d.title, citation: d.citation, status: 'issued',
                date: todayIso(), templateId: d.templateId, authority: d.authority, code: code,
              )))),
        ),
      ]),
      body: ListView(padding: EdgeInsets.all(S.page), children: [
        CertificateView(
          heading: 'CERTIFICATE OF EXCELLENCE & MERIT', title: d.title, student: stu.name.toUpperCase(), citation: d.citation, accent: templateColor(tpl),
          meta: 'Roll No. #$roll • Class $clsLabel (Secondary)', date: fmtIso(todayIso(), 'd MMMM, yyyy'), code: code, authority: d.authority,
          mentor: me?.name ?? 'Class Mentor', signed: true, seal: d.seal,
          school: me?.school.isNotEmpty == true ? me!.school : 'Delhi Public School',
        ),
        SizedBox(height: 12.h),
        Text('Template: ${tpl?.name ?? 'Default'} • Verified with QR code on issue.', style: T.small, textAlign: TextAlign.center),
        if (d.mark) ...[
          SizedBox(height: 6.h),
          Text('Principal cryptographic watermark will be applied.', style: T.small.copyWith(color: C.successDark), textAlign: TextAlign.center),
        ],
      ]),
    );
  }
}
