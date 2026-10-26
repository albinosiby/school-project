import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../design_system/design_system.dart';
import '../../bloc/duties_bloc.dart';
import '../../bloc/duties_events.dart';
import '../../models/duty_models.dart';
import '../../models/tasks_format.dart';

class _Meta extends StatelessWidget {
  const _Meta(this.icon, this.text);
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 16.r, color: C.primary), SizedBox(width: 6.w),
        Flexible(child: Text(text, style: T.small.copyWith(color: C.ink), maxLines: 2, overflow: TextOverflow.ellipsis)),
      ]);
}

/// Agenda Details sheet of a staff meeting (Figma 1153:18116).
Future<void> showAgendaSheet(BuildContext context, Duty duty) {
  final total = duty.agenda.fold<int>(0, (a, e) => a + e.minutes);
  final a = duty.startAt, b = duty.endAt, pre = duty.preRead;
  return showAppSheet<void>(context, title: 'Agenda Details', subtitle: duty.agendaTitle ?? 'Meeting', builder: (ctx) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      AppCard(
        radius: R.lg, padding: EdgeInsets.all(14.w),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text((duty.tag ?? 'Meeting').toUpperCase(), style: T.caps, maxLines: 1, overflow: TextOverflow.ellipsis)),
            duty.mandatory ? const Pill('Mandatory', tone: Tone.danger) : const Pill('Optional', tone: Tone.neutral),
          ]),
          SizedBox(height: 8.h),
          Text(duty.title, style: T.h2),
          Divider(height: 22.h),
          Wrap(spacing: 14.w, runSpacing: 6.h, children: [
            if (a != null) _Meta(Icons.schedule_rounded, '${relDay(a)}, ${fmtClock(a)}${b == null ? '' : ' – ${fmtClock(b)}'}'),
            _Meta(Icons.location_on_outlined, duty.floor ?? duty.venue),
            if (duty.chair != null) _Meta(Icons.person_outline_rounded, 'Chair: ${duty.chair}'),
          ]),
        ]),
      ),
      SizedBox(height: 12.h),
      AppCard(
        radius: R.lg, padding: EdgeInsets.all(14.w),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('AGENDA TOPICS', style: T.smallStrong)),
            Text('${duty.agenda.length} items • $total mins', style: T.small),
          ]),
          SizedBox(height: 10.h),
          for (var i = 0; i < duty.agenda.length; i++)
            Container(
              margin: EdgeInsets.only(bottom: 8.h), padding: EdgeInsets.all(10.w),
              decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
              child: Row(children: [
                Container(
                  width: 26.r, height: 26.r, alignment: Alignment.center,
                  decoration: const BoxDecoration(color: C.primarySoft, shape: BoxShape.circle),
                  child: Text('${i + 1}', style: T.smallStrong.copyWith(color: C.primary)),
                ),
                SizedBox(width: 10.w),
                Expanded(child: Text(duty.agenda[i].topic, style: T.bodyStrong.copyWith(fontWeight: FontWeight.w500), maxLines: 2, overflow: TextOverflow.ellipsis)),
                Pill('${duty.agenda[i].minutes}m', tone: Tone.brand),
              ]),
            ),
        ]),
      ),
      if (pre != null) ...[
        SizedBox(height: 12.h),
        AppCard(
          radius: R.lg, padding: EdgeInsets.all(14.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Expanded(child: Text('PRE-READ DOCUMENT', style: T.smallStrong)), Text('1 file', style: T.small)]),
            SizedBox(height: 10.h),
            Row(children: [
              const IconTile(Icons.picture_as_pdf_outlined, tone: Tone.danger),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(pre.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(pre.size, style: T.small),
                ]),
              ),
              IconButton(
                tooltip: 'Download ${pre.name}', icon: Icon(Icons.file_download_outlined, color: C.primary, size: 24.r),
                onPressed: () => AppDialogs.showSnackBar(ctx, message: 'Downloaded ${pre.name} (simulated)'),
              ),
            ]),
          ]),
        ),
      ],
    ]);
  });
}

/// Request Duty Swap sheet (Figma 1153:18362). Sends a pending request through [DutiesBloc].
Future<void> showSwapSheet(BuildContext context, Duty duty) {
  final bloc = context.read<DutiesBloc>();
  return showAppSheet<void>(context, title: 'Request Duty Swap', subtitle: duty.typeLabel, builder: (ctx) => _SwapForm(duty: duty, bloc: bloc, host: context));
}

class _SwapForm extends StatefulWidget {
  const _SwapForm({required this.duty, required this.bloc, required this.host});
  final Duty duty;
  final DutiesBloc bloc;
  final BuildContext host;
  @override
  State<_SwapForm> createState() => _SwapFormState();
}

class _SwapFormState extends State<_SwapForm> {
  late String _with;
  bool _changing = false, _tried = false;
  late DateTime _date;
  TimeOfDay _from = const TimeOfDay(hour: 10, minute: 0), _to = const TimeOfDay(hour: 13, minute: 0);
  String _reason = 'Academic';
  final _note = TextEditingController();

  @override
  void initState() {
    super.initState();
    _with = widget.duty.staff.isNotEmpty ? widget.duty.staff.first.name : kFacultyNames.first;
    _date = dayOf(DateTime.now().add(const Duration(days: 5)));
    _note.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  int _mins(TimeOfDay t) => t.hour * 60 + t.minute;

  String? get _slotError {
    if (_mins(_to) <= _mins(_from)) return 'End time must be after start time';
    if (dayOf(_date).isBefore(dayOf(DateTime.now()))) return 'Return slot must be in the future';
    return null;
  }

  String? get _noteError => _note.text.trim().length < 10 ? 'Please add a short reason (at least 10 characters)' : null;

  void _send() {
    setState(() => _tried = true);
    if (_slotError != null || _noteError != null) return;
    final d = widget.duty;
    widget.bloc.add(DutySwapRequested(SwapRequest(
      dutyId: d.id, dutyTitle: d.title, swapWith: _with, returnDate: _date.toIso8601String().substring(0, 10),
      returnFrom: _from.format(context), returnTo: _to.format(context), reason: _reason, note: _note.text.trim(), createdAt: DateTime.now().toIso8601String(),
    )));
    final who = _with;
    Navigator.pop(context);
    if (widget.host.mounted) AppDialogs.showSnackBar(widget.host, message: 'Swap request sent to $who. Status: pending');
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.duty;
    final quick = {...kFacultyNames, ...d.staff.map((e) => e.name)}.where((n) => n != _with).take(3).toList();
    Widget card(Widget child) => Padding(padding: EdgeInsets.only(bottom: 12.h), child: AppCard(radius: R.lg, padding: EdgeInsets.all(14.w), child: child));
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(d.typeLabel.toUpperCase(), style: T.caps, maxLines: 1, overflow: TextOverflow.ellipsis)),
          Pill(relDay(d.startAt ?? DateTime.now()), tone: Tone.warning),
        ]),
        SizedBox(height: 6.h),
        Text(d.title, style: T.h2),
        Divider(height: 20.h),
        _Meta(Icons.schedule_rounded, d.when),
        SizedBox(height: 6.h),
        _Meta(Icons.location_on_outlined, d.venue),
      ])),
      card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text('SWAP WITH', style: T.smallStrong)),
          const Pill('Verified', tone: Tone.success, icon: Icons.verified_outlined),
        ]),
        SizedBox(height: 10.h),
        Container(
          padding: EdgeInsets.all(10.w), decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
          child: Row(children: [
            Avatar(_with, size: 40), SizedBox(width: 10.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_with, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                Text('Faculty', style: T.small),
              ]),
            ),
            AppButton(_changing ? 'Done' : 'Change', kind: BtnKind.outline, small: true, expand: false, onPressed: () => setState(() => _changing = !_changing)),
          ]),
        ),
        if (_changing) ...[
          SizedBox(height: 10.h),
          AppDropdown<String>(label: 'Choose faculty member', value: _with, items: {...kFacultyNames, _with}.toList(), onChanged: (v) => setState(() => _with = v)),
        ],
        SizedBox(height: 10.h),
        Text('QUICK:', style: T.capsMuted),
        SizedBox(height: 6.h),
        Wrap(spacing: 8.w, runSpacing: 8.h, children: [
          for (final n in quick)
            ActionChip(
              avatar: Avatar(n, size: 22), label: Text(n, style: T.small.copyWith(color: C.ink)), onPressed: () => setState(() => _with = n),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.pill)), side: const BorderSide(color: C.border), backgroundColor: C.surface,
            ),
        ]),
      ])),
      card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('PROPOSED RETURN SLOT', style: T.smallStrong),
        SizedBox(height: 10.h),
        Row(children: [
          Expanded(flex: 3, child: _Tap(Icons.calendar_month_outlined, '${relDay(_date)}, ${fmtShort(_date)}', 'Return date', () async {
            final now = DateTime.now();
            final p = await showDatePicker(context: context, initialDate: _date, firstDate: now.subtract(const Duration(days: 365)), lastDate: now.add(const Duration(days: 730)));
            if (p != null) setState(() => _date = p);
          })),
          SizedBox(width: 8.w),
          Expanded(flex: 2, child: _Tap(Icons.schedule_rounded, _from.format(context), 'From time', () async {
            final p = await showTimePicker(context: context, initialTime: _from);
            if (p != null) setState(() => _from = p);
          })),
          SizedBox(width: 8.w),
          Expanded(flex: 2, child: _Tap(Icons.schedule_rounded, _to.format(context), 'To time', () async {
            final p = await showTimePicker(context: context, initialTime: _to);
            if (p != null) setState(() => _to = p);
          })),
        ]),
        if (_tried && _slotError != null) Padding(padding: EdgeInsets.only(top: 6.h), child: Text(_slotError!, style: T.small.copyWith(color: C.danger))),
      ])),
      card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('REASON FOR SWAP', style: T.smallStrong),
        SizedBox(height: 10.h),
        AppChoiceChips(items: const ['Academic', 'Medical', 'Official'], value: _reason, onChanged: (r) => setState(() => _reason = r)),
        SizedBox(height: 10.h),
        TextField(
          controller: _note, maxLines: 3, maxLength: 150,
          decoration: InputDecoration(hintText: 'Add a note for the coordinator…', errorText: _tried ? _noteError : null),
        ),
        Text('Coordinator & invigilator visible', style: T.small),
      ])),
      Text('Subject to coordinator confirmation', style: T.small),
      SizedBox(height: 12.h),
      AppButton('Send Swap Request', icon: Icons.send_rounded, onPressed: _send),
      SizedBox(height: 8.h),
      AppButton('Cancel', kind: BtnKind.ghost, onPressed: () => Navigator.pop(context)),
    ]);
  }
}

class _Tap extends StatelessWidget {
  const _Tap(this.icon, this.text, this.label, this.onTap);
  final IconData icon;
  final String text, label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true, label: '$label: $text',
        child: InkWell(
          borderRadius: BorderRadius.circular(R.md), onTap: onTap,
          child: Container(
            constraints: BoxConstraints(minHeight: 48.h), padding: EdgeInsets.symmetric(horizontal: 8.w),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
            child: Row(children: [
              Icon(icon, size: 16.r, color: C.primary), SizedBox(width: 4.w),
              Expanded(child: Text(text, style: T.smallStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
            ]),
          ),
        ),
      );
}
