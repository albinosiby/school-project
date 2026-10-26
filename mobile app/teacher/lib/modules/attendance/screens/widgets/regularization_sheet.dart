import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../models/attendance_models.dart';
import 'att_widgets.dart';

const _reasons = ['Biometric Terminal Error', 'Field / Duty Assignment', 'Forgot to Punch', 'Network / Device Issue', 'Other'];

/// 1.1.3.1 Request Regularization popup (Figma 1153:14353). Pops with the request or null.
Future<Regularization?> showRegularizationSheet(BuildContext context, {StaffLog? irregular}) => showAppSheet<Regularization>(
      context, title: 'Request Regularization', subtitle: 'Submit punch time correction for admin approval',
      builder: (_) => _RegForm(irregular: irregular),
    );

class _RegForm extends StatefulWidget {
  const _RegForm({this.irregular});
  final StaffLog? irregular;
  @override
  State<_RegForm> createState() => _RegFormState();
}

class _RegFormState extends State<_RegForm> {
  late String date = widget.irregular?.date ?? dkey(todayDate().subtract(const Duration(days: 1)));
  late String type = widget.irregular?.inTime == null && widget.irregular != null ? 'Check-in' : widget.irregular != null ? 'Check-out' : 'Check-in';
  String time = '08:15';
  String reason = _reasons.first;
  final note = TextEditingController();
  String? err;

  @override
  void dispose() {
    note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final missed = widget.irregular != null && widget.irregular!.date == date;
    final diff = mins('08:30') - mins(time);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      AttBanner(icon: Icons.info_outline_rounded, tone: Tone.brand, text: 'Requests are verified against gate security registers & reviewed by Academic Admin within 24–48h.'),
      SizedBox(height: 16.h),
      const CapsLabel('Date of missed record'),
      AppPickTile(
        icon: Icons.calendar_today_rounded, plainIcon: true, label: fmtKey(date, 'MMM d, yyyy (EEEE)'),
        trailing: missed ? Pill(widget.irregular!.inTime == null ? 'Missed In-Punch' : 'Missed Out-Punch', tone: Tone.danger) : null,
        onTap: () async {
          final d = await pickDate(context, date, last: todayDate());
          if (d != null) setState(() => date = d);
        },
      ),
      SizedBox(height: 14.h),
      const CapsLabel('Correction type'),
      AppSegmented(items: const ['Check-in', 'Check-out', 'Both Punches'], value: type, onChanged: (v) => setState(() => type = v)),
      SizedBox(height: 14.h),
      CapsLabel('Proposed actual time', trailing: Text('Shift Starts 08:30 AM', style: T.small)),
      AppPickTile(
        icon: Icons.schedule_rounded, plainIcon: true, label: t12(time),
        trailing: type == 'Check-out' ? null : Pill(diff >= 0 ? '${diff}m Early' : '${-diff}m Late', tone: diff >= 0 ? Tone.success : Tone.warning),
        onTap: () async {
          final tm = await showTimePicker(context: context, initialTime: TimeOfDay(hour: int.parse(time.split(':')[0]), minute: int.parse(time.split(':')[1])));
          if (tm != null) setState(() => time = '${two(tm.hour)}:${two(tm.minute)}');
        },
      ),
      SizedBox(height: 14.h),
      AppDropdown<String>(label: 'REASON FOR DISCREPANCY', value: reason, items: _reasons, onChanged: (v) => setState(() => reason = v)),
      CapsLabel('Note / Justification', trailing: Text('${note.text.length}/200', style: T.small)),
      TextField(
        controller: note, maxLines: 3, maxLength: 200, onChanged: (_) => setState(() => err = null),
        decoration: InputDecoration(hintText: 'Explain discrepancy briefly (e.g., Conducted morning gate assembly duty at Senior Wing)...', counterText: '', errorText: err, errorMaxLines: 2),
      ),
      SizedBox(height: 12.h),
      AppButton('Submit Regularization Request', icon: Icons.send_rounded, onPressed: () {
        if (note.text.trim().length < 10) {
          setState(() => err = 'Please add a short justification (min 10 characters)');
          return;
        }
        toast(context, 'Regularization request submitted for admin review');
        Navigator.pop(context, Regularization(date: date, type: type, time: time, reason: reason, note: note.text.trim(), at: DateTime.now().toIso8601String()));
      }),
      SizedBox(height: 4.h),
      Center(child: TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel'))),
    ]);
  }
}
