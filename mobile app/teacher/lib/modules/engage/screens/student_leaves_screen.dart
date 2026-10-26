import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/engage_notice.dart';
import '../bloc/leave_bloc.dart';
import '../bloc/leave_events.dart';
import '../bloc/leave_states.dart';
import '../models/leave_models.dart';
import 'leave_management_screen.dart';
import 'widgets/engage_widgets.dart';

/// Student leave requests to review (Figma 1153:5439).
class StudentLeavesScreen extends StatelessWidget {
  const StudentLeavesScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<LeaveBloc>()..add(const LeaveLoadRequested()),
        child: const NoticeListener<LeaveBloc, LeaveState>(child: _StudentLeavesView()),
      );
}

class _StudentLeavesView extends StatefulWidget {
  const _StudentLeavesView();
  @override
  State<_StudentLeavesView> createState() => _StudentLeavesViewState();
}

class _StudentLeavesViewState extends State<_StudentLeavesView> {
  String classId = 'cls_10B';
  int tab = 0;

  Future<void> _decide(StudentLeave e, bool approve) async {
    final bloc = context.read<LeaveBloc>();
    var note = '';
    if (!approve) {
      final r = await askText(context, title: 'Deny leave request', hint: 'Reason for denial (optional)', confirm: 'Deny');
      if (r == null) return;
      note = r;
    } else {
      final ok = await confirmAction(context, title: 'Approve leave?', message: '${e.name} • ${e.daysLabel} (${e.type})', confirm: 'Approve');
      if (!ok) return;
    }
    bloc.add(StudentLeaveDecided(e.id, approve: approve, note: note));
  }

  @override
  Widget build(BuildContext context) {
    final st = context.watch<LeaveBloc>().state;
    final school = context.watch<SchoolBloc>().state;
    final classes = school.classes;
    final cls = school.classById(classId);
    final clsName = cls == null ? '' : 'Class ${cls.grade}-${cls.section}';
    final all = st.studentLeavesOf(classId);
    int n(bool Function(StudentLeave) f) => all.where(f).length;
    final tabs = [
      'Pending Review (${n((e) => e.pending)})',
      'Approved (${n((e) => e.status == StudentLeaveStatus.approved)})',
      'Medical Slips (${n((e) => e.medical)})',
      'Rejected (${n((e) => e.status == StudentLeaveStatus.rejected)})',
      'All (${all.length})',
    ];
    final shown = switch (tab) {
      0 => all.where((e) => e.pending).toList(),
      1 => all.where((e) => e.status == StudentLeaveStatus.approved).toList(),
      2 => all.where((e) => e.medical).toList(),
      3 => all.where((e) => e.status == StudentLeaveStatus.rejected).toList(),
      _ => all,
    };
    final processed = all.where((e) => !e.pending).toList()..sort((a, b) => b.processedAt.compareTo(a.processedAt));
    return DetailScaffold(
      title: 'Leave Management',
      body: st.status != EngageStatus.loaded
          ? EngageStatusBody(status: st.status, error: st.error, onRetry: () => context.read<LeaveBloc>().add(const LeaveLoadRequested()))
          : ListView(padding: EdgeInsets.all(S.page), children: [
              LeaveSegment(index: 1, pending: st.pendingStudentLeaves),
              Row(children: [
                Expanded(
                  child: classes.isEmpty
                      ? const SizedBox.shrink()
                      : DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: cls == null ? classes.first.id : classId, isExpanded: true, icon: Icon(Icons.keyboard_arrow_down_rounded, size: 22.r),
                            items: [
                              for (final c in classes)
                                DropdownMenuItem(
                                  value: c.id,
                                  child: Text.rich(
                                    TextSpan(children: [
                                      TextSpan(text: 'Class ${c.grade}-${c.section}', style: T.h3),
                                      TextSpan(text: ' • ${c.students} Students', style: T.small),
                                    ]),
                                    maxLines: 1, overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                            ],
                            onChanged: (v) => setState(() => classId = v ?? classId),
                          ),
                        ),
                ),
                SizedBox(width: 8.w),
                const Pill('Term 2 (24-25)', tone: Tone.neutral, icon: Icons.calendar_month_outlined),
              ]),
              SizedBox(height: 8.h),
              IdxChips(items: tabs, index: tab, onChanged: (i) => setState(() => tab = i)),
              SectionHeader(
                const ['Pending Requests', 'Approved Requests', 'Medical Slips', 'Rejected Requests', 'All Requests'][tab],
                action: tab == 0 ? '${shown.length} to review' : '${shown.length}',
              ),
              if (shown.isEmpty)
                AppEmptyState(tab == 0 ? 'All caught up' : 'Nothing here', hint: tab == 0 ? 'No pending leave requests for $clsName.' : null, icon: Icons.check_circle_outline),
              for (final e in shown) _LeaveCard(e, clsName: clsName, onApprove: () => _decide(e, true), onDeny: () => _decide(e, false)),
              SectionHeader('Recently Processed', action: 'View History', onAction: () => setState(() => tab = 4)),
              if (processed.isEmpty) Text('Nothing processed yet', style: T.body),
              for (final e in processed.take(2)) _ProcessedRow(e),
              SizedBox(height: 8.h),
              PanelCard(
                child: Row(children: [
                  const IconTile(Icons.description_outlined),
                  SizedBox(width: 12.w),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Monthly Leave Register', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                      Text('Export signed PDF for ${DateFormat('MMMM').format(DateTime.now())}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                      Text('Principal review threshold: leaves > 3 consecutive days', style: T.small.copyWith(fontSize: 10.5.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
                    ]),
                  ),
                  SizedBox(width: 8.w),
                  AppButton('Export', kind: BtnKind.outline, small: true, expand: false, onPressed: () => showNotice(context, 'Leave register exported (simulated)')),
                ]),
              ),
            ]),
    );
  }
}

class _ProcessedRow extends StatelessWidget {
  const _ProcessedRow(this.e);
  final StudentLeave e;
  @override
  Widget build(BuildContext context) {
    final approved = e.status == StudentLeaveStatus.approved;
    return Padding(
      padding: EdgeInsets.only(bottom: 8.h),
      child: AppCard(
        padding: EdgeInsets.all(12.w), radius: R.lg,
        child: Row(children: [
          Avatar(e.name, size: 38), SizedBox(width: 10.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${e.name}  #${e.roll.toString().padLeft(2, '0')}', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
              Text('${e.type} • ${e.daysLabel} (${e.dateText})', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
          SizedBox(width: 8.w),
          Flexible(
            flex: 0,
            child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Pill(approved ? (e.note.isEmpty ? 'Approved' : e.note) : 'Rejected', tone: approved ? Tone.success : Tone.danger),
              if (e.processedBy.isNotEmpty)
                ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: 110.w),
                  child: Text(e.processedBy, style: T.small.copyWith(fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _LeaveCard extends StatelessWidget {
  const _LeaveCard(this.e, {required this.clsName, required this.onApprove, required this.onDeny});
  final StudentLeave e;
  final String clsName;
  final VoidCallback onApprove, onDeny;

  void _viewSlip(BuildContext context) {
    final att = e.att!;
    showAppSheet<void>(
      context, title: att.name, subtitle: '${att.size} • ${att.src}',
      builder: (ctx) => Column(children: [
        Container(
          height: 160.h, alignment: Alignment.center,
          decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
          child: Icon(Icons.picture_as_pdf_outlined, size: 56.r, color: C.danger),
        ),
        SizedBox(height: 12.h),
        AppButton('Close', kind: BtnKind.outline, onPressed: () => Navigator.pop(ctx)),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final att = e.att;
    final pending = e.pending;
    final long = e.days > 3;
    final roll = e.roll.toString().padLeft(2, '0');
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        padding: EdgeInsets.all(14.w), radius: R.xl,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Avatar(e.name, size: 48), SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text.rich(TextSpan(children: [TextSpan(text: e.name, style: T.h3), TextSpan(text: '  #$roll', style: T.small)]), maxLines: 1, overflow: TextOverflow.ellipsis),
                Text('$clsName • Roll $roll', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              ]),
            ),
            SizedBox(width: 8.w),
            Pill(e.daysLabel, tone: pending && e.days >= 2 ? Tone.danger : Tone.purple),
          ]),
          SizedBox(height: 12.h),
          Container(
            width: double.infinity, padding: EdgeInsets.all(12.w),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(Icons.event_outlined, size: 16.r, color: C.primary), SizedBox(width: 6.w),
                Expanded(
                  child: Text.rich(
                    TextSpan(children: [TextSpan(text: e.dateText, style: T.bodyStrong.copyWith(fontSize: 13.sp)), TextSpan(text: '  • ${e.type}', style: T.small)]),
                    maxLines: 2, overflow: TextOverflow.ellipsis,
                  ),
                ),
              ]),
              SizedBox(height: 6.h),
              Text('"${e.reason}"', style: T.body.copyWith(color: C.ink, fontSize: 13.sp), maxLines: 4, overflow: TextOverflow.ellipsis),
            ]),
          ),
          if (att != null) ...[
            SizedBox(height: 10.h),
            AppFileChip(
              name: att.name, size: att.size, sub: att.src,
              trailing: AppButton('View', icon: Icons.visibility_outlined, kind: BtnKind.outline, small: true, expand: false, onPressed: () => _viewSlip(context)),
            ),
          ] else if (e.cat != 'duty') ...[
            SizedBox(height: 8.h),
            Text('No supporting document attached', style: T.small),
          ],
          SizedBox(height: 10.h),
          Row(children: [
            Icon(Icons.family_restroom_outlined, size: 16.r, color: C.slate), SizedBox(width: 6.w),
            Expanded(child: Text('${e.by} • ${e.ago}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
            SizedBox(width: 6.w),
            if (long)
              const Pill('Principal review', tone: Tone.warning)
            else if (e.attend >= 75)
              Pill('Eligible • ${e.attend}%', tone: Tone.success)
            else
              Pill('Attend: ${e.attend}%', tone: Tone.danger),
          ]),
          if (pending) ...[
            SizedBox(height: 12.h),
            Row(children: [
              Expanded(child: AppButton('Deny', icon: Icons.cancel_outlined, kind: BtnKind.soft, onPressed: onDeny)),
              SizedBox(width: 10.w),
              Expanded(child: AppButton('Approve', icon: Icons.check_circle_outline, onPressed: onApprove)),
            ]),
          ] else ...[
            SizedBox(height: 10.h),
            Align(
              alignment: Alignment.centerLeft,
              child: Pill(
                e.status == StudentLeaveStatus.approved ? 'Approved' : 'Rejected${e.note.isEmpty ? '' : ' — ${e.note}'}',
                tone: e.status == StudentLeaveStatus.approved ? Tone.success : Tone.danger,
              ),
            ),
          ],
        ]),
      ),
    );
  }
}
