import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../../school/models/school_models.dart';
import '../../models/attendance_models.dart';
import 'att_widgets.dart';

/// 1.1.2 Notify Parent popup (Figma 1153:16163). Pops with the [ParentNotice] to store (or null).
Future<ParentNotice?> showNotifySheet(BuildContext context, Student st, {SchoolClass? cls, int absentCount = 0, int mondays = 0}) =>
    showAppSheet<ParentNotice>(context,
        title: 'Notify Parent / Guardian', subtitle: '${st.name} • Roll #${st.roll} (Grade ${cls?.label ?? ''})',
        builder: (ctx) => _NotifyForm(st: st, cls: cls, absent: absentCount, mondays: mondays));

class _NotifyForm extends StatefulWidget {
  const _NotifyForm({required this.st, required this.cls, required this.absent, required this.mondays});
  final Student st;
  final SchoolClass? cls;
  final int absent, mondays;
  @override
  State<_NotifyForm> createState() => _NotifyFormState();
}

class _NotifyFormState extends State<_NotifyForm> {
  static const channels = [('SMS Alert', 'Direct Carrier', Icons.sms_outlined), ('WhatsApp Bot', 'School Portal', Icons.chat_outlined), ('App Push', 'Parent App v2.0', Icons.notifications_outlined)];
  static const templates = ['Monday Absenteeism Follow-up', 'Low Attendance Warning', 'Consecutive Absence Welfare Check'];
  final Set<String> picked = {'SMS Alert'};
  late String tpl = widget.mondays >= 2 ? templates.first : templates[1];
  bool ack = true;
  late final TextEditingController msg = TextEditingController(text: _text(tpl));
  String? error;

  String _text(String t) {
    final n = widget.st.name, g = widget.st.guardian, cn = widget.cls?.label ?? '';
    return switch (t) {
      'Low Attendance Warning' => 'Dear $g, $n (Roll #${widget.st.roll}, Grade $cn) has attendance below the required 75%. Regular attendance is critical for academic progress. Please review and acknowledge.',
      'Consecutive Absence Welfare Check' => 'Dear $g, $n (Roll #${widget.st.roll}, Grade $cn) has missed 3 consecutive school days. Please let us know if everything is fine.',
      _ => 'Dear $g, $n (Roll #${widget.st.roll}, Grade $cn) has missed ${widget.mondays == 0 ? 3 : widget.mondays} Monday sessions this month. Regular attendance is critical for academic progress. Please review and acknowledge.',
    };
  }

  @override
  void dispose() {
    msg.dispose();
    super.dispose();
  }

  ParentNotice _notice(List<String> ch, String text) => ParentNotice(
        studentId: widget.st.id, classId: widget.st.classId, channels: ch, message: text, template: ch.contains('Call') ? null : tpl,
        ackRequested: !ch.contains('Call') && ack, at: DateTime.now().toIso8601String(),
      );

  void _send() {
    if (picked.isEmpty) return setState(() => error = 'Select at least one channel');
    if (msg.text.trim().isEmpty) return setState(() => error = 'Message cannot be empty');
    if (msg.text.length > 320) return setState(() => error = 'Message exceeds 320 characters');
    toast(context, 'Notification sent via ${picked.join(', ')}');
    Navigator.pop(context, _notice(picked.toList(), msg.text.trim()));
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: EdgeInsets.all(12.r),
          decoration: BoxDecoration(color: C.panel, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.panelBorder)),
          child: Column(children: [
            AttBanner(
              icon: Icons.error_rounded, tone: Tone.danger,
              text: widget.mondays >= 2 ? 'Alert Trigger: Flagged ${widget.mondays} Monday Absences this month' : 'Alert Trigger: ${widget.absent} absences in this period',
            ),
            SizedBox(height: 10.h),
            Row(children: [
              Icon(Icons.person_outline_rounded, size: 16.r, color: C.slate), SizedBox(width: 4.w),
              Expanded(child: Text('Parent: ${widget.st.guardian}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
              Icon(Icons.call_outlined, size: 16.r, color: C.primary), SizedBox(width: 4.w),
              Text(widget.st.phone, style: T.smallStrong.copyWith(color: C.primary)),
            ]),
          ]),
        ),
        SizedBox(height: 14.h),
        const CapsLabel('Multi-channel dispatch'),
        Row(children: [
          for (final c in channels) ...[
            if (c != channels.first) SizedBox(width: 8.w),
            Expanded(child: _Channel(
              title: c.$1, sub: c.$2, icon: c.$3, on: picked.contains(c.$1),
              onTap: () => setState(() {
                picked.contains(c.$1) ? picked.remove(c.$1) : picked.add(c.$1);
                error = null;
              }),
            )),
          ],
        ]),
        SizedBox(height: 14.h),
        const CapsLabel('Message preset'),
        DropdownButtonFormField<String>(
          initialValue: tpl, isExpanded: true,
          items: [for (final t in templates) DropdownMenuItem(value: t, child: Text('Template: $t', overflow: TextOverflow.ellipsis, style: T.bodyStrong.copyWith(fontSize: 13.sp)))],
          onChanged: (v) => setState(() {
            tpl = v!;
            msg.text = _text(v);
            error = null;
          }),
        ),
        SizedBox(height: 14.h),
        CapsLabel('Message preview', trailing: const Pill('Auto-filled', tone: Tone.brand, icon: Icons.auto_fix_high_rounded)),
        TextField(controller: msg, maxLines: 5, style: T.body.copyWith(color: C.ink), onChanged: (_) => setState(() => error = null)),
        SizedBox(height: 4.h),
        Row(children: [
          Text('Characters: ${msg.text.length} / 320', style: T.small.copyWith(color: msg.text.length > 320 ? C.danger : C.slate)),
          const Spacer(),
          Text(msg.text.length > 160 ? 'Standard 2-part SMS' : 'Single SMS', style: T.small),
        ]),
        SizedBox(height: 8.h),
        SwitchListTile(
          contentPadding: EdgeInsets.zero, value: ack, onChanged: (v) => setState(() => ack = v),
          title: Text('Request Read Acknowledgement from Parent', style: T.bodyStrong.copyWith(fontSize: 13.5.sp)),
          subtitle: Text('Parent must confirm receipt via SMS or App portal', style: T.small),
        ),
        if (error != null) Padding(padding: EdgeInsets.only(bottom: 8.h), child: Text(error!, style: T.small.copyWith(color: C.danger))),
        AppButton('Send Notification Now', icon: Icons.send_rounded, onPressed: _send),
        SizedBox(height: 8.h),
        AppButton('Call Parent Directly', icon: Icons.call_outlined, kind: BtnKind.outline, onPressed: () {
          toast(context, 'Calling ${widget.st.guardian} • ${widget.st.phone}');
          Navigator.pop(context, _notice(const ['Call'], 'Phone call placed to ${widget.st.guardian}'));
        }),
        SizedBox(height: 4.h),
        Center(child: TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel / Close'))),
      ]);
}

class _Channel extends StatelessWidget {
  const _Channel({required this.title, required this.sub, required this.icon, required this.on, required this.onTap});
  final String title, sub;
  final IconData icon;
  final bool on;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true, selected: on, label: title,
        child: InkWell(
          borderRadius: BorderRadius.circular(R.md), onTap: onTap,
          child: Container(
            padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 10.h),
            decoration: BoxDecoration(
              color: on ? C.primarySoft : C.surface, borderRadius: BorderRadius.circular(R.md),
              border: Border.all(color: on ? C.primary : C.border, width: on ? 1.5 : 1),
            ),
            child: Column(children: [
              Container(
                width: 32.r, height: 32.r,
                decoration: BoxDecoration(color: on ? C.primary : C.bg, borderRadius: BorderRadius.circular(R.sm)),
                child: Icon(icon, size: 18.r, color: on ? Colors.white : C.slate),
              ),
              SizedBox(height: 6.h),
              Text(title, style: T.smallStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
              Text(sub, style: T.small.copyWith(fontSize: 10.5.sp, color: on ? C.primary : C.slate), maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
        ),
      );
}
