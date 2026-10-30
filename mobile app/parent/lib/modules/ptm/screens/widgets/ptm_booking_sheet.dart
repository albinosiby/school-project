import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../../teachers/models/teacher_models.dart';
import '../../bloc/ptm_action_bloc.dart';
import '../../bloc/ptm_events.dart';
import '../../bloc/ptm_states.dart';
import '../../models/ptm_models.dart';

/// Opens the booking sheet (or, with [meeting], the reschedule sheet). Needs a [PtmActionBloc] above [context].
Future<void> showPtmBookingSheet(
  BuildContext context, {
  required PtmData data,
  required String childId,
  String? teacherId,
  Meeting? meeting,
}) {
  final bloc = context.read<PtmActionBloc>()..add(const ResetPtmAction());
  return showAppSheet<void>(
    context,
    title: meeting == null ? 'Book a Meeting' : 'Reschedule Meeting',
    subtitle: meeting == null
        ? 'Pick a teacher and one of their free slots.'
        : 'Pick a new slot with ${meeting.teacherName}.',
    builder: (_) => BlocProvider.value(
      value: bloc,
      child: PtmBookingForm(
        data: data,
        childId: childId,
        teacherId: meeting?.teacherId ?? teacherId,
        meeting: meeting,
      ),
    ),
  );
}

class PtmBookingForm extends StatefulWidget {
  const PtmBookingForm({
    super.key,
    required this.data,
    required this.childId,
    this.teacherId,
    this.meeting,
  });
  final PtmData data;
  final String childId;
  final String? teacherId;
  final Meeting? meeting;

  @override
  State<PtmBookingForm> createState() => _PtmBookingFormState();
}

class _PtmBookingFormState extends State<PtmBookingForm> {
  late String? _teacherId = widget.data.teacher(widget.teacherId ?? '') == null
      ? null
      : widget.teacherId;
  String? _day;
  String? _slotId;
  late MeetingMode _mode = widget.meeting?.mode ?? MeetingMode.inPerson;
  final _agenda = TextEditingController();

  bool get _reschedule => widget.meeting != null;
  Teacher? get _teacher =>
      _teacherId == null ? null : widget.data.teacher(_teacherId!);

  static String _dayKey(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  List<PtmSlot> get _slots =>
      _teacherId == null ? const [] : widget.data.slotsOf(_teacherId!);

  List<String> get _days =>
      <String>{for (final s in _slots) _dayKey(s.start)}.toList();

  @override
  void initState() {
    super.initState();
    _pickFirstDay();
  }

  void _pickFirstDay() {
    final free = _slots.where((s) => !s.booked);
    _day = free.isEmpty
        ? (_days.isEmpty ? null : _days.first)
        : _dayKey(free.first.start);
    _slotId = null;
  }

  @override
  void dispose() {
    _agenda.dispose();
    super.dispose();
  }

  Future<void> _pickTeacher() async {
    final t = await showPickSheet<Teacher>(
      context,
      title: 'Choose a teacher',
      items: widget.data.teachers,
      label: (t) => t.name,
      sub: (t) => [t.subject, t.room].where((s) => s.isNotEmpty).join(' • '),
      selected: _teacher,
    );
    if (t == null) return;
    setState(() {
      _teacherId = t.id;
      _pickFirstDay();
    });
  }

  void _submit() {
    final bloc = context.read<PtmActionBloc>();
    if (_reschedule) {
      bloc.add(
        ReschedulePtm(
          childId: widget.childId,
          meetingId: widget.meeting!.id,
          slotId: _slotId,
        ),
      );
    } else {
      bloc.add(
        BookPtm(
          childId: widget.childId,
          teacherId: _teacherId,
          slotId: _slotId,
          mode: _mode,
          agenda: _agenda.text,
        ),
      );
    }
  }

  Widget _error(String? text) => text == null
      ? const SizedBox.shrink()
      : Padding(
          padding: EdgeInsets.only(top: 6.h),
          child: Text(text, style: T.small.copyWith(color: C.danger)),
        );

  @override
  Widget build(
    BuildContext context,
  ) => BlocConsumer<PtmActionBloc, PtmActionState>(
    listenWhen: (a, b) =>
        a.status != b.status &&
        b.status == PtmActionStatus.success &&
        (b.action == PtmAction.book || b.action == PtmAction.reschedule),
    listener: (context, state) => Navigator.of(context).pop(),
    builder: (context, state) {
      final daySlots = _slots.where((s) => _dayKey(s.start) == _day).toList();
      final selected = _slots.where((s) => s.id == _slotId).firstOrNull;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('TEACHER', style: T.capsMuted),
          SizedBox(height: 6.h),
          AppPickTile(
            key: const Key('ptm-teacher'),
            icon: Icons.person_outline_rounded,
            caption: _teacher?.subject,
            label: _teacher?.name ?? 'Choose a teacher',
            onTap: _reschedule ? () {} : _pickTeacher,
            trailing: _reschedule
                ? Icon(Icons.lock_outline_rounded, size: 18.r, color: C.slate)
                : null,
          ),
          _error(state.errors['teacher']),
          if (_teacherId != null) ...[
            SizedBox(height: 16.h),
            Text('DATE', style: T.capsMuted),
            SizedBox(height: 4.h),
            AppSolidChips(
              items: _days,
              value: _day ?? '',
              labelOf: (k) =>
                  DateFormat('EEE, d MMM').format(DateTime.parse(k)),
              onChanged: (k) => setState(() {
                _day = k;
                _slotId = null;
              }),
            ),
            SizedBox(height: 12.h),
            Text('TIME SLOT', style: T.capsMuted),
            SizedBox(height: 8.h),
            Wrap(
              spacing: 8.w,
              runSpacing: 8.h,
              children: [
                for (final s in daySlots)
                  _SlotChip(
                    slot: s,
                    selected: s.id == _slotId,
                    onTap: () => setState(() => _slotId = s.id),
                  ),
              ],
            ),
            if (daySlots.isNotEmpty && daySlots.every((s) => s.booked))
              Padding(
                padding: EdgeInsets.only(top: 6.h),
                child: Text(
                  'All slots on this day are taken. Try another day.',
                  style: T.small,
                ),
              ),
          ],
          _error(state.errors['slot']),
          if (!_reschedule) ...[
            SizedBox(height: 16.h),
            Text('MEETING MODE', style: T.capsMuted),
            SizedBox(height: 8.h),
            AppSegmented(
              items: [for (final m in MeetingMode.values) m.label],
              value: _mode.label,
              track: true,
              onChanged: (v) => setState(
                () =>
                    _mode = MeetingMode.values.firstWhere((m) => m.label == v),
              ),
            ),
            SizedBox(height: 16.h),
            AppTextField(
              key: const Key('ptm-agenda'),
              label: 'Agenda',
              controller: _agenda,
              hint: 'What would you like to discuss?',
              maxLines: 3,
              maxLength: 200,
            ),
            if (state.errors['agenda'] != null)
              Transform.translate(
                offset: Offset(0, -10.h),
                child: _error(state.errors['agenda']),
              ),
          ],
          if (selected != null) ...[
            SizedBox(height: 8.h),
            AppInfoTile(
              icon: Icons.event_available_rounded,
              iconColor: C.primary,
              label: _reschedule ? 'NEW TIME' : 'SUMMARY',
              value:
                  '${fmtDate(selected.start)} • ${fmtClock(selected.start)} '
                  '(${selected.mins} min)${_reschedule ? '' : ' • ${_mode.label}'}',
            ),
          ],
          if (state.error != null) _error(state.error),
          SizedBox(height: 16.h),
          AppButton(
            _reschedule ? 'Confirm New Time' : 'Confirm Booking',
            icon: Icons.check_circle_outline_rounded,
            busy: state.submitting,
            onPressed: _submit,
          ),
        ],
      );
    },
  );
}

class _SlotChip extends StatelessWidget {
  const _SlotChip({
    required this.slot,
    required this.selected,
    required this.onTap,
  });
  final PtmSlot slot;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = fmtClock(slot.start);
    final fg = slot.booked
        ? C.muted
        : selected
        ? Colors.white
        : C.ink;
    return Semantics(
      button: true,
      enabled: !slot.booked,
      selected: selected,
      label: slot.booked ? '$label, booked' : label,
      child: InkWell(
        borderRadius: BorderRadius.circular(R.md),
        onTap: slot.booked ? null : onTap,
        child: Container(
          constraints: BoxConstraints(minHeight: 44.h, minWidth: 96.w),
          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
          decoration: BoxDecoration(
            color: slot.booked
                ? C.surfaceLow
                : selected
                ? C.primary
                : C.bg,
            borderRadius: BorderRadius.circular(R.md),
            border: Border.all(color: selected ? C.primary : C.border),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: T.smallStrong.copyWith(
                  color: fg,
                  decoration: slot.booked ? TextDecoration.lineThrough : null,
                ),
              ),
              Text(
                slot.booked ? 'Booked' : '${slot.mins} min',
                style: T.small.copyWith(
                  fontSize: 10.5.sp,
                  color: selected && !slot.booked ? Colors.white : C.slate,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
