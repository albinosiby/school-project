import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../models/attendance_models.dart';
import '../../models/leave_models.dart';
import 'att_widgets.dart';

/// 1.4.1 Assign Class Handover popup (Figma 1153:17738). Pops with the [Handover] or null.
Future<Handover?> showHandoverSheet(BuildContext context,
        {required String start, required String end, required int days, required List<HandoverPeriod> periods, required List<Faculty> faculty, required Set<String> taken}) =>
    showAppSheet<Handover>(context,
        title: 'Assign Class Handover', subtitle: 'Select substitute teacher & assign class periods',
        builder: (_) => _HandoverForm(start: start, end: end, days: days, periods: periods, faculty: faculty, taken: taken));

class _HandoverForm extends StatefulWidget {
  const _HandoverForm({required this.start, required this.end, required this.days, required this.periods, required this.faculty, required this.taken});
  final String start, end;
  final int days;
  final List<HandoverPeriod> periods;
  final List<Faculty> faculty;
  final Set<String> taken;
  @override
  State<_HandoverForm> createState() => _HandoverFormState();
}

class _HandoverFormState extends State<_HandoverForm> {
  String? periodId, subId;
  String q = '';
  final topic = TextEditingController();
  final notes = TextEditingController();
  bool attach = false, notify = true;
  final errors = <String, String>{};

  @override
  void dispose() {
    topic.dispose();
    notes.dispose();
    super.dispose();
  }

  void _confirm() {
    errors.clear();
    if (periodId == null) errors['period'] = 'Select a class period';
    if (subId == null) errors['sub'] = 'Choose a substitute teacher';
    if (topic.text.trim().isEmpty) errors['topic'] = 'Add the planned topic / agenda';
    if (errors.isNotEmpty) return setState(() {});
    final p = widget.periods.firstWhere((e) => e.id == periodId);
    final f = widget.faculty.firstWhere((e) => e.id == subId);
    Navigator.pop(context, Handover(
      periodId: p.id, label: p.label, time: p.time, cls: p.cls, room: p.room, subId: f.id, subName: f.name,
      topic: topic.text.trim(), notes: notes.text.trim(), plan: attach ? 'LP_Quadratic_Equations_10A.pdf' : null, notified: notify,
    ));
  }

  Widget _err(String k) => errors[k] == null ? const SizedBox.shrink() : Padding(padding: EdgeInsets.only(bottom: 8.h), child: Text(errors[k]!, style: T.small.copyWith(color: C.danger)));

  @override
  Widget build(BuildContext context) {
    final fac = widget.faculty.where((f) => '${f.name} ${f.role}'.toLowerCase().contains(q.toLowerCase())).toList();
    final pending = widget.periods.where((p) => !widget.taken.contains(p.id)).length;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      AttBanner(
        icon: Icons.event_note_rounded, tone: Tone.brand,
        text: 'Leave: ${fmtKey(widget.start, 'MMM dd')} – ${fmtKey(widget.end, 'MMM dd, yyyy')} (${widget.days} Days)',
        trailing: Pill('$pending Classes Need Handover', tone: Tone.brand),
      ),
      SizedBox(height: 14.h),
      const CapsLabel('Select class & period to delegate'),
      for (final p in widget.periods)
        Builder(builder: (_) {
          final done = widget.taken.contains(p.id);
          final sel = periodId == p.id;
          return Semantics(
            button: true, selected: sel, enabled: !done, label: '${p.cls} ${p.label}',
            child: InkWell(
              borderRadius: BorderRadius.circular(R.lg),
              onTap: done ? null : () => setState(() {
                periodId = p.id;
                errors.remove('period');
              }),
              child: Container(
                margin: EdgeInsets.only(bottom: 8.h), padding: EdgeInsets.all(12.r),
                decoration: BoxDecoration(color: sel ? C.primarySoft : C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: sel ? C.primary : C.border, width: sel ? 1.5 : 1)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                    decoration: BoxDecoration(color: sel ? C.bg : C.surface, borderRadius: BorderRadius.circular(R.sm)),
                    child: Text('${p.time} (${p.label})', style: T.small.copyWith(fontSize: 11.5.sp)),
                  ),
                  SizedBox(height: 6.h),
                  Row(children: [
                    Expanded(child: Text(p.cls, style: T.bodyStrong.copyWith(fontSize: 13.5.sp), maxLines: 2)),
                    SizedBox(width: 6.w),
                    Pill(done ? 'Assigned' : sel ? 'Selected for Handover' : 'Pending Handover', tone: done ? Tone.success : sel ? Tone.brand : Tone.warning, icon: sel ? Icons.check_rounded : null),
                  ]),
                  Row(children: [Icon(Icons.meeting_room_outlined, size: 14.r, color: C.slate), SizedBox(width: 4.w), Text(p.room, style: T.small)]),
                ]),
              ),
            ),
          );
        }),
      _err('period'),
      SizedBox(height: 6.h),
      const CapsLabel('Choose substitute faculty'),
      AppSearchField(hint: 'Search teacher by name or code...', onChanged: (v) => setState(() => q = v)),
      SizedBox(height: 8.h),
      if (fac.isEmpty) Padding(padding: EdgeInsets.all(8.r), child: Text('No teachers match your search.', style: T.body)),
      for (final f in fac)
        Semantics(
          button: true, selected: subId == f.id, label: f.name,
          child: InkWell(
            borderRadius: BorderRadius.circular(R.lg),
            onTap: () => setState(() {
              subId = f.id;
              errors.remove('sub');
            }),
            child: Container(
              margin: EdgeInsets.only(bottom: 8.h), padding: EdgeInsets.all(10.r),
              decoration: BoxDecoration(color: subId == f.id ? C.primarySoft : C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: subId == f.id ? C.primary : C.border, width: subId == f.id ? 1.5 : 1)),
              child: Row(children: [
                Avatar(f.name, size: 40, online: true), SizedBox(width: 10.w),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(f.name, style: T.bodyStrong.copyWith(fontSize: 13.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(f.role, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ])),
                Pill(f.free, tone: Tone.success, dot: true),
                SizedBox(width: 6.w),
                Icon(subId == f.id ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, size: 20.r, color: subId == f.id ? C.primary : C.muted),
              ]),
            ),
          ),
        ),
      _err('sub'),
      SizedBox(height: 6.h),
      const CapsLabel('Handover instructions & lesson material'),
      AppTextField(label: 'Planned Topic / Agenda', controller: topic, hint: 'Chapter 4: Quadratic Equations — Exercise 4.3 Practice', onChanged: (_) => setState(() => errors.remove('topic'))),
      _err('topic'),
      Row(children: [
        Expanded(child: Text('Special Instructions for Substitute', style: T.smallStrong.copyWith(color: C.slate))),
        Text('${notes.text.length} / 300 chars', style: T.small),
      ]),
      SizedBox(height: 6.h),
      TextField(controller: notes, maxLines: 3, maxLength: 300, onChanged: (_) => setState(() {}), decoration: const InputDecoration(hintText: 'Please monitor student practice... Homework due Thursday.', counterText: '')),
      SizedBox(height: 8.h),
      Semantics(
        button: true, label: attach ? 'Remove lesson plan' : 'Attach lesson plan',
        child: InkWell(
          borderRadius: BorderRadius.circular(R.md),
          onTap: () => setState(() => attach = !attach),
          child: Container(
            constraints: BoxConstraints(minHeight: 48.h), padding: EdgeInsets.all(10.r),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
            child: Row(children: [
              Icon(attach ? Icons.picture_as_pdf_outlined : Icons.attach_file_rounded, color: attach ? C.danger : C.primary, size: 22.r), SizedBox(width: 10.w),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(attach ? 'LP_Quadratic_Equations_10A.pdf' : 'Attach lesson plan (optional)', style: T.smallStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                if (attach) Text('1.4 MB • Mathematics Lesson Plan', style: T.small),
              ])),
            ]),
          ),
        ),
      ),
      CheckboxListTile(
        contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, value: notify,
        onChanged: (v) => setState(() => notify = v ?? true),
        title: Text('Send instant substitution alert to substitute via SMS & Portal Notification', style: T.small),
      ),
      SizedBox(height: 4.h),
      AppButton('Confirm & Assign Handover', icon: Icons.check_rounded, onPressed: _confirm),
      SizedBox(height: 4.h),
      Center(child: TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel & Return'))),
    ]);
  }
}
