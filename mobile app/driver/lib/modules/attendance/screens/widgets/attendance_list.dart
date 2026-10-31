import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../design_system/design_system.dart';
import '../../../../di/injection.dart';
import '../../../crew/bloc/crew_bloc.dart';
import '../../../shared/widgets/crew_widgets.dart';
import '../../../students/models/student_models.dart';
import '../../../students/screens/widgets/student_sheet.dart';
import '../../../trips/models/trip_models.dart';
import '../../bloc/attendance_bloc.dart';
import '../../models/attendance_models.dart';

/// The trip's student list with the mark actions (Figma 13 Students / 1.2 Manifest): search, stop filter, per pupil
/// Boarded / Absent / Dropped, guardian call.
class AttendanceList extends StatefulWidget {
  const AttendanceList({super.key, required this.trip, required this.bus, required this.roster, this.header});
  final Trip trip;
  final Bus bus;
  final List<BusStudent> roster;
  final Widget? header;
  @override
  State<AttendanceList> createState() => _AttendanceListState();
}

class _AttendanceListState extends State<AttendanceList> {
  String _q = '';
  String _stop = 'All';
  String _show = 'All';

  @override
  Widget build(BuildContext context) => BlocProvider<AttendanceBloc>(
    key: ValueKey('att-${widget.trip.id}'),
    create: (_) => getIt<AttendanceBloc>(param1: widget.trip)..add(const WatchAttendance()),
    child: BlocConsumer<AttendanceBloc, AttendanceState>(
      listenWhen: (a, b) => b.error != null && a.error != b.error,
      listener: (context, s) {
        ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(behavior: SnackBarBehavior.floating, backgroundColor: C.danger, content: Text(s.error!)));
        context.read<AttendanceBloc>().add(const ClearAttendanceError());
      },
      builder: (context, state) {
        if (state.status == LoadStatus.error && state.attendance == null) {
          return AppErrorWidget(message: state.error ?? 'Could not load attendance.', onRetry: () => context.read<AttendanceBloc>().add(const WatchAttendance()));
        }
        final att = state.attendance;
        final stops = ['All', for (final s in widget.bus.stops) s.name];
        final rows = widget.roster.where((s) {
          if (_q.isNotEmpty && !'${s.name} ${s.classLabel} ${s.rollLabel} ${s.busStop} ${s.guardian}'.toLowerCase().contains(_q.toLowerCase())) return false;
          if (_stop != 'All' && s.busStop != _stop) return false;
          final m = att?.of(s.id)?.status;
          return switch (_show) {
            'Pending' => m == null,
            'Boarded' => m == MarkStatus.boarded,
            'Absent' => m == MarkStatus.absent,
            'Dropped' => m == MarkStatus.dropped,
            _ => true,
          };
        }).toList();
        final canMark = !widget.trip.isCompleted && widget.trip.date == _today();
        return ListView(
          padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 24.h),
          children: [
            ?widget.header,
            AppSearchField(hint: 'Search student, class, stop…', onChanged: (v) => setState(() => _q = v)),
            SizedBox(height: 10.h),
            FilterChips(items: stops, value: _stop, onChanged: (v) => setState(() => _stop = v)),
            SizedBox(height: 8.h),
            AppChoiceChips(
              items: const ['All', 'Pending', 'Boarded', 'Absent', 'Dropped'],
              value: _show,
              onChanged: (v) => setState(() => _show = v),
              toneOf: (v) => switch (v) { 'Boarded' => Tone.success, 'Absent' => Tone.danger, 'Dropped' => Tone.brand, 'Pending' => Tone.warning, _ => Tone.neutral },
            ),
            SizedBox(height: 12.h),
            Row(children: [
              Expanded(child: Text('${rows.length} of ${widget.roster.length} students', style: T.capsMuted)),
              if (att == null) SizedBox(width: 14.r, height: 14.r, child: const CircularProgressIndicator(strokeWidth: 2)),
            ]),
            SizedBox(height: 8.h),
            if (widget.roster.isEmpty)
              const AppEmptyState('No students on this bus', hint: 'The transport office assigns students to buses in the admin console.', icon: Icons.groups_outlined)
            else if (rows.isEmpty)
              const AppEmptyState('No students match', hint: 'Try another stop or filter.', icon: Icons.search_off_rounded),
            for (final s in rows)
              _StudentRow(
                student: s,
                mark: att?.of(s.id),
                pending: state.pending.contains(s.id),
                canMark: canMark && att != null,
                kind: widget.trip.kind,
                onMark: (status) => context.read<AttendanceBloc>().add(MarkStudent(s.id, status, stopId: s.busStopId.isEmpty ? null : s.busStopId)),
                onOpen: () => showStudentSheet(context, s, widget.bus),
              ),
          ],
        );
      },
    ),
  );

  static String _today() {
    final d = DateTime.now();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }
}

class _StudentRow extends StatelessWidget {
  const _StudentRow({required this.student, required this.mark, required this.pending, required this.canMark, required this.kind, required this.onMark, required this.onOpen});
  final BusStudent student;
  final Mark? mark;
  final bool pending, canMark;
  final TripKind kind;
  final ValueChanged<MarkStatus?> onMark;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final s = student;
    final status = mark?.status;
    return AppSurfaceCard(
      margin: EdgeInsets.only(bottom: 10.h),
      padding: EdgeInsets.all(12.w),
      onTap: onOpen,
      semanticLabel: '${s.name} ${status?.label ?? 'not marked'}',
      borderColor: switch (status) { MarkStatus.boarded => C.success, MarkStatus.absent => C.danger, MarkStatus.dropped => C.primary, null => null }?.withValues(alpha: .5),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Avatar(s.name, size: 44, tone: markTone(status)),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
              Text([s.rollLabel, s.classLabel].where((e) => e.isNotEmpty).join(' · '), style: T.small),
              Row(children: [
                Icon(Icons.place_outlined, size: 13.r, color: C.slate),
                SizedBox(width: 3.w),
                Expanded(child: Text(s.busStop.isEmpty ? 'No stop' : s.busStop, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
              ]),
            ]),
          ),
          SizedBox(width: 8.w),
          if (pending)
            SizedBox(width: 18.r, height: 18.r, child: const CircularProgressIndicator(strokeWidth: 2))
          else
            Pill(status?.label ?? 'Pending', tone: markTone(status), dot: status != null),
        ]),
        if (s.medicalNote.isNotEmpty) ...[
          SizedBox(height: 8.h),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
            decoration: BoxDecoration(color: C.dangerSoft, borderRadius: BorderRadius.circular(R.sm)),
            child: Row(children: [
              Icon(Icons.medical_information_rounded, size: 14.r, color: C.danger),
              SizedBox(width: 6.w),
              Expanded(child: Text(s.medicalNote, style: T.small.copyWith(color: C.danger, fontWeight: FontWeight.w600))),
            ]),
          ),
        ],
        SizedBox(height: 10.h),
        Row(children: [
          Expanded(child: GuardianLine(student: s)),
          SizedBox(width: 8.w),
          CallButton(phone: s.phone, name: s.guardian, size: 34),
        ]),
        if (canMark) ...[
          SizedBox(height: 10.h),
          Row(children: [
            if (status == null || status == MarkStatus.absent) ...[
              Expanded(child: _MarkBtn('Boarded', Icons.login_rounded, Tone.success, selected: false, student: s.name, onTap: () => onMark(MarkStatus.boarded))),
              SizedBox(width: 8.w),
              Expanded(child: _MarkBtn('Absent', Icons.person_off_rounded, Tone.danger, selected: status == MarkStatus.absent, student: s.name, onTap: () => onMark(status == MarkStatus.absent ? null : MarkStatus.absent))),
            ] else if (status == MarkStatus.boarded) ...[
              Expanded(child: _MarkBtn(kind == TripKind.pickup ? 'Arrived' : 'Dropped', Icons.logout_rounded, Tone.brand, selected: false, student: s.name, onTap: () => onMark(MarkStatus.dropped))),
              SizedBox(width: 8.w),
              Expanded(child: _MarkBtn('Undo', Icons.undo_rounded, Tone.neutral, selected: false, student: s.name, onTap: () => onMark(null))),
            ] else ...[
              Expanded(child: _MarkBtn('Back on bus', Icons.undo_rounded, Tone.neutral, selected: false, student: s.name, onTap: () => onMark(MarkStatus.boarded))),
            ],
          ]),
        ] else if (mark != null) ...[
          SizedBox(height: 8.h),
          Text('${mark!.status.label} ${clock(mark!.at)}${mark!.byName.isEmpty ? '' : ' by ${mark!.byName}'}', style: T.small),
        ],
      ]),
    );
  }
}

class _MarkBtn extends StatelessWidget {
  const _MarkBtn(this.label, this.icon, this.tone, {required this.selected, required this.onTap, required this.student});
  final String label, student;
  final IconData icon;
  final Tone tone;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return Semantics(
      button: true,
      label: 'Mark $label $student',
      child: Material(
      key: ValueKey('mark-$label-$student'),
      color: selected ? c.fg : c.bg,
      borderRadius: BorderRadius.circular(R.sm),
      child: InkWell(
        borderRadius: BorderRadius.circular(R.sm),
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 9.h),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 16.r, color: selected ? Colors.white : c.fg),
            SizedBox(width: 6.w),
            Text(label, style: T.smallStrong.copyWith(color: selected ? Colors.white : c.fg)),
          ]),
        ),
      ),
      ),
    );
  }
}
