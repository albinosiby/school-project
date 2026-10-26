import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/leave_bloc.dart';
import '../bloc/leave_events.dart';
import '../bloc/leave_states.dart';
import '../bloc/load_status.dart';
import '../models/attendance_models.dart';
import '../models/leave_models.dart';
import 'widgets/att_widgets.dart';
import 'widgets/handover_sheet.dart';

/// (label, sub, type stored, quota code, icon)
const _types = [
  ('Duty Leave', 'Official Work', 'Duty Leave', 'DL', Icons.work_outline_rounded),
  ('Casual Leave', 'Personal / Urgent', 'Casual Leave', 'CL', Icons.wb_sunny_outlined),
  ('Medical Leave', 'Health / Medical', 'Medical Leave', 'ML', Icons.medical_services_outlined),
  ('Parental Leave', 'Statutory Leave', 'Parental Leave', '', Icons.family_restroom_rounded),
];

/// 1.4 Apply Leave (Figma 1153:20078) with the Add Handover sheet (1153:17738).
class ApplyLeaveScreen extends StatelessWidget {
  const ApplyLeaveScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(create: (_) => getIt<LeaveBloc>()..add(const LeaveLoadRequested()), child: const _LeaveView());
}

class _LeaveView extends StatefulWidget {
  const _LeaveView();
  @override
  State<_LeaveView> createState() => _LeaveViewState();
}

class _LeaveViewState extends State<_LeaveView> {
  String type = 'Casual Leave';
  late String start = dkey(todayDate().add(const Duration(days: 3)));
  late String end = dkey(todayDate().add(const Duration(days: 5)));
  String coverage = 'Full Day';
  final reason = TextEditingController();
  final handovers = <Handover>[];
  String? doc;
  final errors = <String, String>{};

  @override
  void dispose() {
    reason.dispose();
    super.dispose();
  }

  int get days {
    if (end.compareTo(start) < 0) return 0;
    final n = leaveDays(start, end);
    return coverage == 'Full Day' || n == 0 ? n : (n - 0.5).ceil();
  }

  Future<void> _submit(LeaveState s) async {
    errors.clear();
    if (end.compareTo(start) < 0) {
      errors['dates'] = 'End date cannot be before the start date';
    } else if (days == 0) {
      errors['dates'] = 'Selected dates only include Sundays';
    }
    if (reason.text.trim().length < 10) errors['reason'] = 'Please give a reason (at least 10 characters)';
    final q = s.quotaFor(_types.firstWhere((t) => t.$3 == type).$4);
    if (q != null && days > q.available) errors['dates'] = 'Only ${q.available} day(s) of $type available';
    if (type == 'Medical Leave' && days > 2 && doc == null) errors['doc'] = 'A medical certificate is required for more than 2 days';
    if (errors.isNotEmpty) {
      setState(() {});
      toast(context, errors.values.first);
      return;
    }
    if (handovers.isEmpty) {
      final ok = await AppDialogs.showConfirmDialog(context, title: 'No handover added', message: 'Your classes will have no substitute assigned. Submit anyway?', confirm: 'Submit');
      if (!ok || !mounted) return;
    }
    context.read<LeaveBloc>().add(LeaveApplied(LeaveApplication(
      type: type, start: start, end: end, days: days, coverage: coverage, reason: reason.text.trim(), handovers: List.of(handovers), doc: doc,
      createdAt: DateTime.now().toIso8601String(),
    )));
    toast(context, 'Leave application submitted for approval');
    setState(() {
      reason.clear();
      handovers.clear();
      doc = null;
    });
  }

  Future<void> _addHandover(LeaveState s) async {
    if (end.compareTo(start) < 0) return toast(context, 'Pick valid leave dates first');
    final h = await showHandoverSheet(context, start: start, end: end, days: days, periods: s.periods, faculty: s.faculty, taken: {for (final x in handovers) x.periodId});
    if (h != null && mounted) {
      setState(() => handovers.add(h));
      toast(context, 'Handover assigned to ${h.subName}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<LeaveBloc>().state;
    if (s.status != LoadStatus.loaded) return DetailScaffold(title: 'Apply Leave', body: attLoading());
    final recent = s.applications.take(4).toList();
    return DetailScaffold(
      title: 'Apply Leave',
      bottom: AppButton('Submit Leave Application', icon: Icons.send_rounded, onPressed: () => _submit(s)),
      body: AttBody(children: [
        const CapsLabel('Available quota'),
        SizedBox(
          height: 96.h,
          child: ListView.separated(
            scrollDirection: Axis.horizontal, itemCount: s.quota.length, separatorBuilder: (_, _) => SizedBox(width: 8.w),
            itemBuilder: (_, i) => _QuotaCard(q: s.quota[i], color: [C.primary, C.success, C.purple][i % 3]),
          ),
        ),
        SizedBox(height: 12.h),
        AppCard(radius: R.xl, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('Leave Category', style: T.h3)),
            TextButton.icon(
              onPressed: () => showAppSheet<void>(context, title: 'Leave Policy Guideline', builder: (_) => Text(
                'Apply at least 3 days in advance with a class handover plan for each period. Medical leave beyond 2 days needs a certificate. Sundays are not counted.',
                style: T.body,
              )),
              icon: Icon(Icons.menu_book_outlined, size: 16.r),
              label: const Text('Policy Guideline'),
            ),
          ]),
          SizedBox(height: 8.h),
          _CategoryGrid(value: type, onChanged: (t) => setState(() {
            type = t;
            errors.remove('doc');
          })),
          SizedBox(height: 16.h),
          Text('Duration & Dates', style: T.h3),
          SizedBox(height: 8.h),
          Row(children: [
            Expanded(child: AppPickTile(icon: Icons.event_rounded, plainIcon: true, caption: 'START DATE', label: fmtKey(start, 'dd MMM yyyy'), onTap: () async {
              final d = await pickDate(context, start, first: todayDate().subtract(const Duration(days: 30)));
              if (d != null) {
                setState(() {
                  start = d;
                  if (end.compareTo(d) < 0) end = d;
                  errors.remove('dates');
                });
              }
            })),
            SizedBox(width: 8.w),
            Expanded(child: AppPickTile(icon: Icons.event_available_rounded, plainIcon: true, caption: 'END DATE', label: fmtKey(end, 'dd MMM yyyy'), onTap: () async {
              final d = await pickDate(context, end, first: DateTime.parse(start));
              if (d != null) {
                setState(() {
                  end = d;
                  errors.remove('dates');
                });
              }
            })),
          ]),
          SizedBox(height: 8.h),
          AttBanner(
            icon: Icons.date_range_rounded, tone: Tone.brand,
            text: end.compareTo(start) < 0 ? 'Invalid range' : '$days Academic Day${days == 1 ? '' : 's'} (${fmtKey(start, 'EEE')} – ${fmtKey(end, 'EEE')}, Excl. Sunday)',
          ),
          if (errors['dates'] != null) Padding(padding: EdgeInsets.only(top: 4.h), child: Text(errors['dates']!, style: T.small.copyWith(color: C.danger))),
          SizedBox(height: 14.h),
          Text('Day Coverage', style: T.h3),
          SizedBox(height: 6.h),
          AppSegmented(track: true, items: const ['Full Day', 'First Half', 'Second Half'], value: coverage, onChanged: (v) => setState(() => coverage = v)),
          SizedBox(height: 14.h),
          Row(children: [Expanded(child: Text('Reason / Remarks', style: T.h3)), Text('${reason.text.length}/250', style: T.small)]),
          SizedBox(height: 6.h),
          TextField(
            controller: reason, maxLines: 3, maxLength: 250, onChanged: (_) => setState(() => errors.remove('reason')),
            decoration: InputDecoration(hintText: 'Briefly explain the reason for leave', counterText: '', errorText: errors['reason']),
          ),
          SectionHeader('Substitution Handover', action: 'Add Handover', onAction: () => _addHandover(s)),
          if (handovers.isEmpty) Text('No handovers yet. Tap "Add Handover" to assign a substitute for each period.', style: T.body.copyWith(fontSize: 13.sp)),
          for (final h in handovers)
            AppCard(
              margin: EdgeInsets.only(bottom: 8.h), radius: R.lg, padding: EdgeInsets.all(12.r),
              child: Row(children: [
                Avatar(h.subName, size: 40, tone: Tone.success), SizedBox(width: 10.w),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(child: Text(h.subName, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    SizedBox(width: 6.w),
                    const Pill('Confirmed', tone: Tone.success),
                  ]),
                  Text('${h.cls} (${h.label})', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ])),
                IconButton(tooltip: 'Remove handover', onPressed: () => setState(() => handovers.remove(h)), icon: Icon(Icons.close_rounded, size: 18.r, color: C.slate)),
              ]),
            ),
        ])),
        SectionHeader('Supporting Document', action: '(Optional)'),
        Semantics(
          button: true, label: doc == null ? 'Upload supporting document' : 'Remove $doc',
          child: InkWell(
            borderRadius: BorderRadius.circular(R.lg),
            onTap: () => setState(() {
              doc = doc == null ? 'Medical_Certificate.pdf' : null;
              errors.remove('doc');
            }),
            child: Container(
              padding: EdgeInsets.all(16.r), width: double.infinity,
              decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: errors['doc'] != null ? C.danger : C.panelBorder)),
              child: Column(children: [
                Icon(doc == null ? Icons.cloud_upload_outlined : Icons.attach_file_rounded, color: C.primary, size: 28.r),
                Text(doc ?? 'Upload Medical Certificate or Supporting Slip', style: T.bodyStrong.copyWith(fontSize: 13.5.sp), textAlign: TextAlign.center),
                Text(doc == null ? 'PDF, JPG, or PNG up to 5MB • (Optional)' : 'Tap to remove', style: T.small),
              ]),
            ),
          ),
        ),
        SizedBox(height: 4.h),
        Text(errors['doc'] ?? 'Optional for up to 2 days; required only if Medical Leave exceeds 2 days', style: T.small.copyWith(color: errors['doc'] != null ? C.danger : C.slate)),
        SectionHeader('Recent Applications', caps: true),
        if (recent.isEmpty) const AppEmptyState('No applications yet'),
        for (final r in recent)
          AppCard(
            margin: EdgeInsets.only(bottom: 8.h), radius: R.lg,
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${r.type} (${r.days} Day${r.days == 1 ? '' : 's'})', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                Text('${fmtKey(r.start, 'MMM d, yyyy')} • ${r.reason}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              ])),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Pill(r.status, tone: toneForStatus(r.status)),
                if (r.by.isNotEmpty) Text('by ${r.by}', style: T.small.copyWith(fontSize: 10.5.sp)),
              ]),
            ]),
          ),
      ]),
    );
  }
}

class _QuotaCard extends StatelessWidget {
  const _QuotaCard({required this.q, required this.color});
  final LeaveQuota q;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        width: 136.w, padding: EdgeInsets.all(12.r),
        decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Row(children: [
            Expanded(child: Text(q.name, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
            Container(width: 8.r, height: 8.r, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          ]),
          Text.rich(TextSpan(children: [TextSpan(text: two(q.available), style: T.stat.copyWith(fontSize: 22.sp)), TextSpan(text: ' / ${two(q.total)}', style: T.small)])),
          ClipRRect(
            borderRadius: BorderRadius.circular(R.pill),
            child: LinearProgressIndicator(value: q.total == 0 ? 0 : q.available / q.total, minHeight: 5.h, color: color, backgroundColor: const Color(0xFFE5EDFB)),
          ),
        ]),
      );
}

class _CategoryGrid extends StatelessWidget {
  const _CategoryGrid({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) {
    Widget tile(int i) {
      final t = _types[i];
      final on = t.$3 == value;
      return Expanded(
        child: Semantics(
          button: true, selected: on, label: t.$1,
          child: InkWell(
            borderRadius: BorderRadius.circular(R.lg), onTap: () => onChanged(t.$3),
            child: Container(
              constraints: BoxConstraints(minHeight: 64.h), padding: EdgeInsets.all(10.r),
              decoration: BoxDecoration(color: on ? C.primary : C.surface, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: on ? C.primary : C.border)),
              child: Row(children: [
                Container(
                  width: 32.r, height: 32.r,
                  decoration: BoxDecoration(color: on ? Colors.white.withValues(alpha: .2) : C.bg, borderRadius: BorderRadius.circular(R.sm)),
                  child: Icon(t.$5, size: 18.r, color: on ? Colors.white : C.slate),
                ),
                SizedBox(width: 8.w),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text(t.$1, style: T.smallStrong.copyWith(fontSize: 13.sp, color: on ? Colors.white : C.ink), maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(t.$2, style: T.small.copyWith(fontSize: 11.sp, color: on ? Colors.white70 : C.slate), maxLines: 2, overflow: TextOverflow.ellipsis),
                ])),
              ]),
            ),
          ),
        ),
      );
    }

    return Column(children: [
      Row(children: [tile(0), SizedBox(width: 8.w), tile(1)]),
      SizedBox(height: 8.h),
      Row(children: [tile(2), SizedBox(width: 8.w), tile(3)]),
    ]);
  }
}
