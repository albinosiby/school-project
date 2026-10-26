import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/load_status.dart';
import '../bloc/slips_bloc.dart';
import '../bloc/slips_events.dart';
import '../models/attendance_models.dart';
import 'widgets/att_widgets.dart';

/// 1.1.3 View Medical Slips (Figma 1153:16443) of one student (?student=, default: the first slip's student).
class MedicalSlipsScreen extends StatelessWidget {
  const MedicalSlipsScreen({super.key, this.studentId});
  final String? studentId;
  @override
  Widget build(BuildContext context) => BlocProvider(create: (_) => getIt<SlipsBloc>()..add(const SlipsLoadRequested()), child: _MedicalView(studentId: studentId));
}

class _MedicalView extends StatelessWidget {
  const _MedicalView({this.studentId});
  final String? studentId;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<SlipsBloc>().state;
    if (s.status != LoadStatus.loaded) return DetailScaffold(title: 'Medical Slips', fallbackRoute: RoutePaths.attendanceTrends, body: attLoading());
    final sid = studentId ?? (s.medical.isEmpty ? '' : s.medical.first.studentId);
    final st = s.student(sid);
    final cls = s.classOf(st);
    final slips = [for (final m in s.medical) if (m.studentId == sid) m];
    final pending = [for (final m in slips) if (m.status == 'Pending') m];
    final verified = slips.where((r) => r.status == 'Approved').fold<int>(0, (a, r) => a + r.days);
    final pendingDays = pending.fold<int>(0, (a, r) => a + r.days);
    final rate = st == null ? 0.0 : s.rateOf(st);
    return DetailScaffold(
      title: 'Medical Slips',
      subtitle: st == null ? null : '${st.name} • ${cls?.label ?? ''}',
      fallbackRoute: RoutePaths.attendanceTrends,
      body: AttBody(children: [
        if (st != null)
          AppCard(radius: R.xl, child: Column(children: [
            Row(children: [
              Avatar(st.name, size: 46), SizedBox(width: 10.w),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text(st.name, style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  SizedBox(width: 6.w),
                  Pill(cls?.label ?? '', tone: Tone.brand),
                ]),
                Text('Term 2 • Roll #${st.roll}', style: T.small),
              ])),
              SizedBox(width: 6.w),
              Container(
                padding: EdgeInsets.all(6.r),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  AppStatRing(value: rate / 100, size: 40, color: rate < 75 ? C.danger : C.primary),
                  SizedBox(width: 6.w),
                  Text('Attendance', style: T.smallStrong),
                ]),
              ),
            ]),
            SizedBox(height: 12.h),
            Row(children: [
              Expanded(child: AttCountTile(start: true, label: 'Total Taken', value: '${verified + pendingDays}', sub: 'Days')),
              SizedBox(width: 8.w),
              Expanded(child: AttCountTile(start: true, label: 'Pending', value: '$pendingDays', sub: 'Days', tone: Tone.brand)),
              SizedBox(width: 8.w),
              Expanded(child: AttCountTile(start: true, label: 'Verified', value: '$verified', sub: 'Days', tone: Tone.success)),
            ]),
          ])),
        if (pending.isNotEmpty) ...[
          SizedBox(height: 12.h),
          AttBanner(
            icon: Icons.warning_amber_rounded,
            text: '${pending.length} Pending Medical Leave Review',
            sub: '${pending.first.clinic.split('•').last.trim()} slip received ${pending.first.uploadedAt}. Action required before term locking.',
            trailing: const Pill('New', tone: Tone.warning),
          ),
        ],
        SectionHeader('Medical Submissions', action: '${slips.length} Records on file'),
        if (slips.isEmpty) const AppEmptyState('No medical slips', hint: 'Slips uploaded by parents appear here.', icon: Icons.medical_services_outlined),
        for (final m in slips) _MedicalCard(m),
        SizedBox(height: 4.h),
        PanelCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Medical Leave Regulation Policy', style: T.h3),
          SizedBox(height: 4.h),
          Text('Medical slips submitted within 48 hours convert student absence from Unexcused to Approved Medical Leave, directly protecting term minimum attendance benchmarks (75%).', style: T.small),
        ])),
        SizedBox(height: 12.h),
        AppButton('Download All Medical Documents (.ZIP / PDF)', icon: Icons.download_rounded, kind: BtnKind.outline, onPressed: () => toast(context, 'Documents bundle downloaded (simulated)')),
      ]),
    );
  }
}

class _MedicalCard extends StatelessWidget {
  const _MedicalCard(this.m);
  final MedicalSlip m;
  @override
  Widget build(BuildContext context) {
    final bloc = context.read<SlipsBloc>();
    final status = m.status;
    final range = m.from == m.to ? fmtKey(m.from) : '${fmtKey(m.from)} – ${fmtKey(m.to)}';
    return AppCard(
      margin: EdgeInsets.only(bottom: 12.h), radius: R.xl,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Pill(status == 'Pending' ? 'Pending Verification' : status == 'Approved' ? 'Verified & Approved' : 'Rejected', tone: toneForStatus(status), dot: true),
          const Spacer(),
          IconTile(Icons.medical_services_outlined, size: 36),
        ]),
        SizedBox(height: 8.h),
        Text(m.title, style: T.h3),
        Text(m.clinic, style: T.small),
        SizedBox(height: 10.h),
        Container(
          padding: EdgeInsets.all(10.r), decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
          child: Row(children: [
            Icon(Icons.date_range_rounded, size: 18.r, color: C.primary), SizedBox(width: 8.w),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(range, style: T.bodyStrong.copyWith(fontSize: 13.sp)),
              Text('${m.days} Academic Day${m.days == 1 ? '' : 's'}${status == 'Pending' ? ' Requested' : ''}', style: T.small),
            ])),
          ]),
        ),
        SizedBox(height: 10.h),
        InkWell(
          borderRadius: BorderRadius.circular(R.md), onTap: () => toast(context, 'Opening ${m.file} (simulated)'),
          child: Container(
            padding: EdgeInsets.all(10.r),
            decoration: BoxDecoration(color: C.panel, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.panelBorder)),
            child: Row(children: [
              Icon(Icons.picture_as_pdf_outlined, color: C.danger, size: 22.r), SizedBox(width: 10.w),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('View Full PDF / Zoom', style: T.smallStrong.copyWith(color: C.primary)),
                Text(m.file, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              ])),
              Icon(Icons.zoom_in_rounded, color: C.primary, size: 20.r),
            ]),
          ),
        ),
        SizedBox(height: 8.h),
        Text('Uploaded by ${m.uploader} • ${m.uploadedAt}', style: T.small),
        if (status == 'Pending') ...[
          SizedBox(height: 12.h),
          Row(children: [
            Expanded(child: AppButton('Reject', kind: BtnKind.outline, onPressed: () async {
              final r = await askReason(context, title: 'Reject medical slip', hint: 'Reason for rejection (shared with parent)', action: 'Reject Slip');
              if (r == null || !context.mounted) return;
              bloc.add(MedicalSlipDecided(m.id, approved: false, reason: r));
              toast(context, 'Slip rejected');
            })),
            SizedBox(width: 8.w),
            Expanded(flex: 2, child: AppButton('Approve Leave', icon: Icons.check_rounded, onPressed: () {
              bloc.add(MedicalSlipDecided(m.id, approved: true));
              toast(context, 'Medical leave approved • absences marked Excused');
            })),
          ]),
        ] else ...[
          SizedBox(height: 8.h),
          Row(children: [
            Expanded(child: Text(
              status == 'Approved' ? 'Excused Regularized • Approved by ${m.by}' : 'Rejected${m.reason == null ? '' : ': ${m.reason}'}',
              style: T.small.copyWith(color: status == 'Approved' ? C.successDark : C.danger),
            )),
            TextButton(onPressed: () => toast(context, 'Opening ${m.file} (simulated)'), child: const Text('View Slip')),
          ]),
        ],
      ]),
    );
  }
}
