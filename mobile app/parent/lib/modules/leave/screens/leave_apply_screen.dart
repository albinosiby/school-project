import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../family/bloc/family_bloc.dart';
import '../../family/models/family_models.dart';
import '../../home/screens/widgets/parent_page_scaffold.dart';
import '../bloc/leave_apply_bloc.dart';
import '../bloc/leave_overview_bloc.dart';
import '../models/leave_models.dart';
import 'leave_screen.dart' show leaveTone;
import 'widgets/leave_form_parts.dart';

/// Figma "1.2 Apply Leave": attendance impact, leave balances and the application form
/// (category, dates, reason, optional slip), submitted through the leave repository.
class LeaveApplyScreen extends StatelessWidget {
  const LeaveApplyScreen({super.key});

  @override
  Widget build(BuildContext context) => BlocProvider<LeaveApplyBloc>(
    create: (_) => getIt<LeaveApplyBloc>(),
    child: ParentPageScaffold(
      title: 'Apply Leave',
      fallbackRoute: RoutePaths.leave,
      body: ChildDataView<LeaveOverviewBloc, LeaveOverview>(
        create: () => getIt<LeaveOverviewBloc>(),
        refreshable: false,
        builder: (context, ov, child) => _LeaveForm(overview: ov, child: child),
      ),
    ),
  );
}

/// Next Monday-Friday on or after [d].
DateTime nextSchoolDay(DateTime d) {
  var x = dateOnly(d);
  while (x.weekday > DateTime.friday) {
    x = DateTime(x.year, x.month, x.day + 1);
  }
  return x;
}

String academicYear(DateTime now) {
  final start = now.month >= 4 ? now.year : now.year - 1;
  return 'AY $start–${(start + 1) % 100}';
}

class _LeaveForm extends StatefulWidget {
  const _LeaveForm({required this.overview, required this.child});
  final LeaveOverview overview;
  final Child child;

  @override
  State<_LeaveForm> createState() => _LeaveFormState();
}

class _LeaveFormState extends State<_LeaveForm> {
  final _reason = TextEditingController();
  LeaveType _type = LeaveType.medical;
  late DateTime _from = nextSchoolDay(plusDays(1));
  late DateTime _to = _from;
  ({String name, String size})? _attachment;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pick(bool from) async {
    final d = await showDatePicker(
      context: context,
      initialDate: from ? _from : _to,
      firstDate: today(),
      lastDate: plusDays(180),
      helpText: from ? 'Leave starts' : 'Leave ends',
    );
    if (d == null) return;
    setState(() {
      if (from) {
        _from = d;
        if (_to.isBefore(d)) _to = d;
      } else {
        _to = d;
      }
    });
  }

  Future<void> _attach() async {
    const sources = ['Take a photo', 'Choose from gallery', 'Browse files'];
    final s = await showPickSheet<String>(
      context,
      title: 'Attach a document',
      items: sources,
      label: (s) => s,
      sub: (s) => switch (s) {
        'Take a photo' => 'Use the camera',
        'Choose from gallery' => 'JPG or PNG',
        _ => 'PDF, JPG, PNG up to 5MB',
      },
    );
    if (s == null || !mounted) return;
    final stamp =
        '${_from.day}${fmtShort(_from).split(' ').last.toLowerCase()}';
    final file = switch (s) {
      'Take a photo' => (name: 'slip_photo_$stamp.jpg', size: '1.2 MB'),
      'Choose from gallery' => (
        name: 'prescription_$stamp.png',
        size: '860 KB',
      ),
      _ => (name: 'doctor_slip_$stamp.pdf', size: '240 KB'),
    };
    setState(() => _attachment = file);
    AppDialogs.showSnackBar(context, message: 'Attached ${file.name}');
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    context.read<LeaveApplyBloc>().add(
      LeaveApplyEvent(
        childId: widget.child.id,
        from: _from,
        to: _to,
        reason: _reason.text,
        type: _type,
        attachment: _attachment?.name,
        daysLeft: widget.overview.left(_type.pool),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ov = widget.overview;
    final child = widget.child;
    final days = _to.isBefore(_from) ? 0 : workingDaysBetween(_from, _to);
    final phone = context.select<FamilyBloc, String?>(
      (b) => b.state.guardian?.phone,
    );
    return BlocConsumer<LeaveApplyBloc, LeaveApplyState>(
      listener: (context, s) {
        if (s.status != ApplyStatus.success) return;
        AppDialogs.showSnackBar(
          context,
          message: 'Leave application sent to ${child.classTeacher}',
        );
        context.canPop() ? context.pop() : context.go(RoutePaths.leave);
      },
      builder: (context, s) => ListView(
        padding: EdgeInsets.fromLTRB(S.page, 8.h, S.page, 32.h),
        children: [
          _ImpactCard(overview: ov, leaveDays: days, type: _type),
          SizedBox(height: 14.h),
          AppElevatedCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Application Form',
                        style: T.h2.copyWith(color: C.onSurface),
                      ),
                    ),
                    Pill(academicYear(DateTime.now()), tone: Tone.neutral),
                  ],
                ),
                SizedBox(height: 14.h),
                const LeaveFieldLabel('Leave Category'),
                AppIconSegmented(
                  labels: [for (final t in LeaveType.values) t.label],
                  icons: [for (final t in LeaveType.values) t.icon],
                  index: _type.index,
                  onChanged: (i) => setState(() => _type = LeaveType.values[i]),
                ),
                SizedBox(height: 16.h),
                LeaveFieldLabel(
                  'Schedule & Duration',
                  trailing: Pill(
                    days == 0
                        ? 'No school days'
                        : '$days Working Day${days == 1 ? '' : 's'}',
                    tone: days == 0 ? Tone.warning : Tone.brand,
                  ),
                ),
                Row(
                  children: [
                    Expanded(
                      child: LeaveDateBox(
                        key: const Key('leave-from'),
                        caption: 'FROM',
                        value: fmtDateShort(_from),
                        icon: Icons.calendar_today_outlined,
                        onTap: () => _pick(true),
                      ),
                    ),
                    SizedBox(width: 10.w),
                    Expanded(
                      child: LeaveDateBox(
                        key: const Key('leave-to'),
                        caption: 'TO',
                        value: fmtDateShort(_to),
                        icon: Icons.event_available_outlined,
                        onTap: () => _pick(false),
                      ),
                    ),
                  ],
                ),
                LeaveFieldError(
                  s.errorFor(LeaveField.dates) ??
                      s.errorFor(LeaveField.balance),
                  key: const Key('leave-error-dates'),
                ),
                SizedBox(height: 16.h),
                LeaveFieldLabel(
                  'Reason for Leave',
                  trailing: Text(
                    'Teacher: ${child.classTeacher}',
                    style: T.small.copyWith(color: C.muted),
                  ),
                ),
                TextField(
                  key: const Key('leave-reason'),
                  controller: _reason,
                  maxLines: 4,
                  maxLength: 300,
                  style: T.body.copyWith(color: C.onSurface),
                  decoration: InputDecoration(
                    hintText:
                        'Brief explanation for Class Teacher ${child.classTeacher} (e.g. Viral fever recovery, advised bed rest for 2 days by physician)',
                    hintMaxLines: 3,
                    hintStyle: T.body.copyWith(color: C.muted),
                    filled: true,
                    fillColor: C.surfaceLow,
                    errorText: s.errorFor(LeaveField.reason),
                    contentPadding: EdgeInsets.all(14.w),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(R.md),
                      borderSide: const BorderSide(color: C.outline),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(R.md),
                      borderSide: const BorderSide(color: C.outline),
                    ),
                  ),
                ),
                SizedBox(height: 8.h),
                LeaveFieldLabel(
                  _type == LeaveType.medical
                      ? 'Medical Slip / Prescription'
                      : 'Supporting Document',
                  trailing: Text(
                    '(Optional)',
                    style: T.small.copyWith(color: C.muted),
                  ),
                ),
                if (_attachment == null)
                  LeaveAttachBox(
                    title: _type == LeaveType.medical
                        ? "Attach Doctor's Prescription / Slip"
                        : 'Attach an invitation or letter',
                    hint: 'Supports PDF, JPG, PNG up to 5MB',
                    onTap: _attach,
                  )
                else
                  AppFileChip(
                    name: _attachment!.name,
                    size: _attachment!.size,
                    sub: 'Ready to send',
                    tone: Tone.brand,
                    trailing: IconButton(
                      tooltip: 'Remove attachment',
                      icon: Icon(
                        Icons.close_rounded,
                        size: 20.r,
                        color: C.slate,
                      ),
                      onPressed: () => setState(() => _attachment = null),
                    ),
                  ),
                SizedBox(height: 16.h),
                Container(
                  padding: EdgeInsets.all(12.w),
                  decoration: BoxDecoration(
                    color: C.surfaceLow,
                    borderRadius: BorderRadius.circular(R.md),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.phone_iphone_rounded,
                        size: 20.r,
                        color: C.primary,
                      ),
                      SizedBox(width: 10.w),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'VERIFIED PARENT CONTACT',
                              style: T.capsMuted.copyWith(fontSize: 10.sp),
                            ),
                            Text(
                              phone ?? '—',
                              style: T.bodyStrong.copyWith(color: C.onSurface),
                            ),
                          ],
                        ),
                      ),
                      const Pill(
                        'Verified',
                        tone: Tone.success,
                        icon: Icons.verified_rounded,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 14.h),
          _RecentLeave(overview: ov, child: child),
          SizedBox(height: 16.h),
          LeaveFieldError(
            s.errorFor(LeaveField.submit),
            key: const Key('leave-error-submit'),
          ),
          AppButton(
            'Submit Leave Application',
            icon: Icons.send_rounded,
            busy: s.status == ApplyStatus.submitting,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }
}

String fmtDateShort(DateTime d) => DateFormat('EEE, dd MMM').format(d);

class _ImpactCard extends StatelessWidget {
  const _ImpactCard({
    required this.overview,
    required this.leaveDays,
    required this.type,
  });
  final LeaveOverview overview;
  final int leaveDays;
  final LeaveType type;

  Widget _balance(LeavePool p, IconData icon) {
    final selected = type.pool == p;
    final left = overview.left(p);
    return Container(
      padding: EdgeInsets.all(12.w),
      decoration: BoxDecoration(
        color: C.surfaceLow,
        borderRadius: BorderRadius.circular(R.md),
        border: Border.all(color: selected ? C.primary : C.outline),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${p.label.toUpperCase()} LEAVE',
                  style: T.capsMuted.copyWith(fontSize: 10.sp),
                ),
                SizedBox(height: 2.h),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    '$left Day${left == 1 ? '' : 's'} Left',
                    style: T.h3.copyWith(color: C.onSurface),
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: 34.r,
            height: 34.r,
            decoration: BoxDecoration(
              color: C.indigoSoft,
              borderRadius: BorderRadius.circular(R.sm),
            ),
            child: Icon(icon, size: 18.r, color: C.primary),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cur = overview.currentPct;
    final proj = overview.projectedPct(leaveDays);
    final min = overview.minAttendance;
    final margin = proj - min;
    final safe = margin >= 0;
    String pct(double v) => '${v.toStringAsFixed(1)}%';
    return AppElevatedCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.insights_rounded, size: 20.r, color: C.primary),
              SizedBox(width: 8.w),
              Expanded(
                child: Text(
                  'CBSE Attendance Impact',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.h3.copyWith(color: C.onSurface),
                ),
              ),
              Pill('Min ${min.round()}% Req.', tone: Tone.brand),
            ],
          ),
          SizedBox(height: 12.h),
          Container(
            padding: EdgeInsets.all(12.w),
            decoration: BoxDecoration(
              color: C.surfaceLow,
              borderRadius: BorderRadius.circular(R.md),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.end,
                  spacing: 8.w,
                  runSpacing: 4.h,
                  children: [
                    Text(
                      pct(cur),
                      key: const Key('leave-current-pct'),
                      style: T.title.copyWith(color: C.primary),
                    ),
                    Text('Current', style: T.small),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.trending_down_rounded,
                          size: 16.r,
                          color: C.teal,
                        ),
                        SizedBox(width: 4.w),
                        Text(
                          '${pct(proj)} Projected',
                          key: const Key('leave-projected-pct'),
                          style: T.smallStrong.copyWith(color: C.teal),
                        ),
                        SizedBox(width: 4.w),
                        Text(
                          '(-${(cur - proj).toStringAsFixed(1)}%)',
                          style: T.small,
                        ),
                      ],
                    ),
                  ],
                ),
                SizedBox(height: 10.h),
                LayoutBuilder(
                  builder: (context, box) => Stack(
                    clipBehavior: Clip.none,
                    children: [
                      AppProgress(
                        proj / 100,
                        tone: safe ? Tone.brand : Tone.danger,
                      ),
                      Positioned(
                        left: box.maxWidth * min / 100,
                        top: -2.h,
                        child: Container(
                          width: 2,
                          height: 12.h,
                          color: C.danger,
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(height: 8.h),
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  spacing: 8.w,
                  runSpacing: 4.h,
                  children: [
                    Text('Required Minimum: ${pct(min)}', style: T.small),
                    Text(
                      safe
                          ? '● Safe Zone (+${margin.toStringAsFixed(1)}% margin)'
                          : '● Below minimum (${margin.toStringAsFixed(1)}%)',
                      style: T.smallStrong.copyWith(
                        color: safe ? C.teal : C.danger,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          SizedBox(height: 12.h),
          Row(
            children: [
              Expanded(
                child: _balance(
                  LeavePool.medical,
                  Icons.medical_services_outlined,
                ),
              ),
              SizedBox(width: 10.w),
              Expanded(
                child: _balance(
                  LeavePool.casual,
                  Icons.event_available_outlined,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RecentLeave extends StatelessWidget {
  const _RecentLeave({required this.overview, required this.child});
  final LeaveOverview overview;
  final Child child;

  @override
  Widget build(BuildContext context) {
    final r = overview.latest;
    return AppElevatedCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Recent Leave Record',
                  style: T.h3.copyWith(color: C.onSurface),
                ),
              ),
              TextButton(
                onPressed: () => context.push(RoutePaths.leave),
                child: const Text('View all'),
              ),
            ],
          ),
          if (r == null)
            Text('No leave applied yet.', style: T.small)
          else
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text.rich(
                        TextSpan(
                          text: fmtDate(r.from, year: true),
                          style: T.bodyStrong.copyWith(color: C.onSurface),
                          children: [
                            TextSpan(
                              text:
                                  '  • ${r.days} Day${r.days == 1 ? '' : 's'}',
                              style: T.small,
                            ),
                          ],
                        ),
                      ),
                      Text(
                        '${r.type.label} Leave • ${r.status == LeaveStatus.pending ? 'Awaiting ${child.classTeacher}' : '${r.status.label} by ${r.reviewer ?? child.classTeacher}'}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: T.small.copyWith(color: C.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
                SizedBox(width: 8.w),
                Pill(r.status.label, tone: leaveTone(r.status), dot: true),
              ],
            ),
        ],
      ),
    );
  }
}
