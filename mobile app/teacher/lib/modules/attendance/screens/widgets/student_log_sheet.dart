import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../../school/models/school_models.dart';
import '../../models/attendance_models.dart';
import 'att_widgets.dart';

/// 1.1.2.1 View Log (Figma 1153:15928): one student's day-by-day attendance in [records] (oldest first).
/// [onMessage] is called after the sheet closes when "Send Message" is tapped.
Future<void> showStudentLog(BuildContext context, {required Student st, SchoolClass? cls, required List<AttendanceRecord> records, required VoidCallback onMessage}) async {
  final msg = await showAppSheet<bool>(context, title: 'Student Attendance Log', builder: (ctx) => _StudentLog(st: st, cls: cls, records: records));
  if (msg == true) onMessage();
}

class _StudentLog extends StatefulWidget {
  const _StudentLog({required this.st, required this.cls, required this.records});
  final Student st;
  final SchoolClass? cls;
  final List<AttendanceRecord> records;
  @override
  State<_StudentLog> createState() => _StudentLogState();
}

class _StudentLogState extends State<_StudentLog> {
  String filter = 'All Records';

  @override
  Widget build(BuildContext context) {
    final st = widget.st;
    final recs = widget.records.reversed.toList();
    final codes = {for (final r in recs) r.date: r.codeOf(st.id)};
    final p = codes.values.where((c) => c == AttCode.present || c == AttCode.late).length;
    final a = codes.values.where((c) => c == AttCode.absent).length;
    final e = codes.values.where((c) => c == AttCode.excused).length;
    final total = codes.length;
    final rate = total == 0 ? 100.0 : p * 100 / total;
    final nAbs = a + e;
    bool keep(AttCode c) => switch (filter) { 'Absences Only' => c == AttCode.absent || c == AttCode.excused, 'Unexcused' => c == AttCode.absent, _ => true };
    final list = [for (final x in codes.entries) if (keep(x.value)) x].take(40).toList();
    final chips = ['All Records ($total)', 'Absences Only ($nAbs)', 'Unexcused ($a)'];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Avatar(st.name, size: 52, tone: rate < 75 ? Tone.danger : Tone.brand), SizedBox(width: 10.w),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(st.name, style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis),
          Text('Roll No. ${two(st.roll)} • Grade ${widget.cls?.label ?? ''}', style: T.small),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Pill('${rate.round()}% Term', tone: rate < 75 ? Tone.danger : Tone.success, icon: rate < 75 ? Icons.warning_amber_rounded : null),
          if (rate < 75) Text('< 75% Min. Threshold', style: T.small.copyWith(fontSize: 10.5.sp, color: C.danger)),
        ]),
      ]),
      SizedBox(height: 12.h),
      AppProgress(rate / 100, tone: rate < 75 ? Tone.danger : Tone.brand),
      SizedBox(height: 4.h),
      Row(children: [
        Expanded(child: Text('Progress: $p / $total Recorded Days', style: T.small)),
        Text('Target: 75%', style: T.smallStrong),
      ]),
      SizedBox(height: 12.h),
      Row(children: [
        Expanded(child: AttCountTile(value: '$total', label: 'Total Days')),
        SizedBox(width: 6.w),
        Expanded(child: AttCountTile(value: '$p', label: 'Present', tone: Tone.brand)),
        SizedBox(width: 6.w),
        Expanded(child: AttCountTile(value: '$a', label: 'Absent', tone: Tone.danger)),
        SizedBox(width: 6.w),
        Expanded(child: AttCountTile(value: '$e', label: 'Excused', tone: Tone.warning)),
      ]),
      SizedBox(height: 12.h),
      Row(children: [
        Expanded(child: AppButton('Call Parent', icon: Icons.call_outlined, small: true, onPressed: () => toast(context, 'Calling ${st.guardian} • ${st.phone}'))),
        SizedBox(width: 8.w),
        Expanded(child: AppButton('Send Message', icon: Icons.mail_outline_rounded, kind: BtnKind.outline, small: true, onPressed: () => Navigator.pop(context, true))),
      ]),
      SizedBox(height: 14.h),
      Row(children: [
        Icon(Icons.calendar_month_rounded, size: 18.r, color: C.primary), SizedBox(width: 6.w),
        Expanded(child: Text(fmtKey(recs.isEmpty ? dkey(todayDate()) : recs.first.date, 'MMMM yyyy'), style: T.bodyStrong)),
        Text('Showing ${list.length} sessions', style: T.small),
      ]),
      SizedBox(height: 8.h),
      FilterChips(items: chips, value: chips.firstWhere((c) => c.startsWith(filter)), onChanged: (v) => setState(() => filter = v.substring(0, v.lastIndexOf(' (')))),
      SizedBox(height: 10.h),
      const CapsLabel('Attendance log detail'),
      if (list.isEmpty) const AppEmptyState('No records', hint: 'Nothing matches this filter.'),
      for (final x in list) _LogRow(date: x.key, code: x.value),
      SizedBox(height: 8.h),
      AppButton('Download Complete Student Log (PDF)', icon: Icons.download_rounded, kind: BtnKind.outline, onPressed: () => toast(context, 'Student log downloaded (simulated)')),
    ]);
  }
}

class _LogRow extends StatelessWidget {
  const _LogRow({required this.date, required this.code});
  final String date;
  final AttCode code;
  @override
  Widget build(BuildContext context) {
    final (label, tone, detail, icon) = switch (code) {
      AttCode.absent => ('Absent • Unexcused', Tone.danger, 'Reason: No note or call submitted by parent', Icons.person_off_outlined),
      AttCode.late => ('Late Entry', Tone.warning, 'Arrival after first bell • verified at gate', Icons.schedule_rounded),
      AttCode.excused => ('Excused • Medical Leave', Tone.brand, 'Clinic slip validated • Status: Approved', Icons.medical_services_outlined),
      AttCode.present => ('Present (On-Time)', Tone.success, 'Biometric Punch-in recorded', Icons.check_circle_outline_rounded),
    };
    return Container(
      margin: EdgeInsets.only(bottom: 8.h), padding: EdgeInsets.all(12.r),
      decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          IconTile(icon, tone: tone, size: 34), SizedBox(width: 10.w),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(fmtKey(date, 'EEEE, MMM d, yyyy'), style: T.bodyStrong.copyWith(fontSize: 13.5.sp)),
            Text('Full Day Session (Periods 1 - 7)', style: T.small),
          ])),
          SizedBox(width: 6.w),
          Flexible(child: Pill(label, tone: tone)),
        ]),
        SizedBox(height: 8.h),
        Container(
          width: double.infinity, padding: EdgeInsets.all(8.r),
          decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.sm)),
          child: Text(detail, style: T.small),
        ),
      ]),
    );
  }
}
