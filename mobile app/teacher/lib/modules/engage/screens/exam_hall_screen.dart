import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/hall_seating_bloc.dart';
import '../bloc/hall_seating_events.dart';
import '../bloc/hall_seating_states.dart';
import '../models/exam_duty_models.dart';
import 'widgets/engage_widgets.dart';

/// Figma 5.8.1 View Hall Sitting (seating layout) and 5.8.1.1 Candidate Details (list segment).
class ExamHallScreen extends StatelessWidget {
  const ExamHallScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<HallSeatingBloc>()..add(HallSeatingLoadRequested(id)),
        child: NoticeListener<HallSeatingBloc, HallSeatingState>(child: _HallView(id)),
      );
}

class _HallView extends StatefulWidget {
  const _HallView(this.id);
  final String id;
  @override
  State<_HallView> createState() => _HallViewState();
}

class _HallViewState extends State<_HallView> {
  int seg = 0, filter = 0;
  String q = '';

  bool _match(Candidate c) {
    if (q.isEmpty) return true;
    final t = q.toLowerCase();
    return c.desk.toLowerCase().contains(t) || c.name.toLowerCase().contains(t) || '${c.roll}' == t;
  }

  Future<void> _submit(HallSeatingState st) async {
    final ok = await confirmAction(context, title: 'Submit final list?', message: '${st.present} present, ${st.absent} absent will be sent to the exam control desk.', confirm: 'Submit');
    if (ok && mounted) context.read<HallSeatingBloc>().add(const FinalListSubmitted());
  }

  @override
  Widget build(BuildContext context) {
    final st = context.watch<HallSeatingBloc>().state;
    final d = st.duty;
    if (d == null) return DetailScaffold(title: 'View Hall Sitting', body: EngageStatusBody(status: st.status, error: st.error, notFound: 'Duty not found'));
    final all = st.candidates;
    final list = all.where(_match).toList();
    final filters = [
      'All (${all.length})', 'Present (${st.present})', 'Absent (${st.absent})',
      'Set A (${all.where((c) => c.set == 'A').length})', 'Set B (${all.where((c) => c.set == 'B').length})',
    ];
    final shown = list.where((c) => switch (filter) { 1 => !c.absent, 2 => c.absent, 3 => c.set == 'A', 4 => c.set == 'B', _ => true }).toList();
    return DetailScaffold(
      title: seg == 0 ? 'View Hall Sitting' : 'Candidate Details',
      bottom: d.submitted
          ? const Center(heightFactor: 1, child: Pill('Final list submitted', tone: Tone.success, icon: Icons.check_circle_outline))
          : Row(children: [
              Expanded(child: AppButton('Export PDF', icon: Icons.download_outlined, kind: BtnKind.outline, onPressed: () => showNotice(context, 'Seating list exported (simulated)'))),
              SizedBox(width: 10.w),
              Expanded(child: AppButton('Submit Final List', icon: Icons.verified_user_outlined, onPressed: () => _submit(st))),
            ]),
      body: ListView(padding: EdgeInsets.all(S.page), children: [
        _Summary(duty: d, total: all.length, present: st.present, absent: st.absent),
        SizedBox(height: 12.h),
        AppIconSegmented(
          labels: const ['Seating Layout', 'Candidate Details'], icons: const [Icons.grid_view_rounded, Icons.list_alt_rounded], index: seg,
          onChanged: (i) => setState(() => seg = i),
        ),
        SizedBox(height: 12.h),
        AppSearchField(hint: 'Search desk (e.g. D-01) or candidate name...', onChanged: (v) => setState(() => q = v.trim())),
        SizedBox(height: 12.h),
        if (all.isEmpty) const AppEmptyState('No seating plan published', icon: Icons.event_seat_outlined),
        if (all.isNotEmpty && seg == 0) ...[
          _Layout(list, widget.id),
          SectionHeader('Candidate Records', action: list.isEmpty ? null : 'Desk ${list.first.desk.substring(2)} – ${list.take(4).last.desk.substring(2)}'),
          for (final c in list.take(4)) _RecordRow(c, widget.id),
        ],
        if (all.isNotEmpty && seg == 1) ...[
          IdxChips(items: filters, index: filter, onChanged: (i) => setState(() => filter = i)),
          SizedBox(height: 12.h),
          if (shown.isEmpty) const AppEmptyState('No candidates match', icon: Icons.search_off_rounded),
          for (final c in shown) CandidateCard(c, dutyId: widget.id),
        ],
      ]),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.duty, required this.total, required this.present, required this.absent});
  final ExamDuty duty;
  final int total, present, absent;
  @override
  Widget build(BuildContext context) => AppCard(
        padding: EdgeInsets.all(14.w),
        child: Column(children: [
          Row(children: [
            Container(
              padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
              decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(R.pill)),
              child: Text(duty.code, style: T.smallStrong.copyWith(color: Colors.white, fontSize: 11.5.sp)),
            ),
            SizedBox(width: 8.w),
            Expanded(child: Text('${duty.shortHall} • ${duty.start} – ${duty.end}', style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
            const Pill('Active Exam', tone: Tone.brand, dot: true),
          ]),
          Divider(height: 22.h, color: C.border),
          Row(children: [
            Expanded(child: _Count('Total Desks', '$total', C.ink, C.surface)),
            SizedBox(width: 8.w),
            Expanded(child: _Count('Present', '$present', C.primary, C.surface)),
            SizedBox(width: 8.w),
            Expanded(child: _Count('Absent', absent.toString().padLeft(2, '0'), C.danger, C.dangerSoft)),
          ]),
        ]),
      );
}

class _Count extends StatelessWidget {
  const _Count(this.label, this.value, this.color, this.bg);
  final String label, value;
  final Color color, bg;
  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 12.h),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: color == C.danger ? C.danger.withValues(alpha: .3) : C.border)),
        child: Row(children: [
          Expanded(child: Text(label, style: T.small.copyWith(fontSize: 11.5.sp, color: color == C.danger ? C.danger : C.slate), maxLines: 1, overflow: TextOverflow.ellipsis)),
          SizedBox(width: 4.w),
          Text(value, style: T.h3.copyWith(color: color)),
        ]),
      );
}

class _Layout extends StatelessWidget {
  const _Layout(this.cands, this.duty);
  final List<Candidate> cands;
  final String duty;
  @override
  Widget build(BuildContext context) {
    final rows = (cands.length / 4).ceil();
    return AppCard(
      padding: EdgeInsets.all(14.w), radius: R.xxl,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.co_present_outlined, color: C.primary, size: 24.r), SizedBox(width: 8.w),
          Expanded(child: Text('Blackboard & Podium Front', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
        ]),
        SizedBox(height: 8.h),
        Container(height: 5.h, decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(R.pill))),
        SizedBox(height: 12.h),
        if (cands.isEmpty) const AppEmptyState('No desks match', icon: Icons.search_off_rounded),
        for (var r = 0; r < rows; r++) ...[
          if (r == 2)
            Padding(
              padding: EdgeInsets.symmetric(vertical: 8.h),
              child: Row(children: [
                const Expanded(child: Divider(color: C.border)),
                Padding(padding: EdgeInsets.symmetric(horizontal: 8.w), child: Text('CENTRAL AISLE (1.8M)', style: T.small.copyWith(fontSize: 10.sp))),
                const Expanded(child: Divider(color: C.border)),
              ]),
            ),
          Padding(
            padding: EdgeInsets.only(bottom: 8.h),
            child: Row(children: [
              Container(
                width: 28.w, height: 32.h, alignment: Alignment.center, margin: EdgeInsets.only(right: 6.w),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.sm)),
                child: Text('R${r + 1}', style: T.small.copyWith(fontSize: 10.sp)),
              ),
              for (var c = 0; c < 4; c++)
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(left: c == 0 ? 0 : 6.w),
                    child: r * 4 + c < cands.length ? _Desk(cands[r * 4 + c], duty) : const SizedBox(),
                  ),
                ),
            ]),
          ),
        ],
      ]),
    );
  }
}

class _Desk extends StatelessWidget {
  const _Desk(this.c, this.duty);
  final Candidate c;
  final String duty;
  @override
  Widget build(BuildContext context) {
    final abs = c.absent;
    return Semantics(
      button: true, label: '${c.desk} ${c.name} ${c.status}',
      child: GestureDetector(
        onTap: () => context.push(RoutePaths.examCandidate(duty, c.id)),
        child: Container(
          height: 92.h, padding: EdgeInsets.all(5.r),
          decoration: BoxDecoration(color: abs ? C.dangerSoft : C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: abs ? C.danger.withValues(alpha: .4) : C.border)),
          child: Column(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Row(children: [
              Expanded(child: Text(c.desk, style: T.smallStrong.copyWith(fontSize: 10.sp, color: abs ? C.danger : C.ink), maxLines: 1, overflow: TextOverflow.clip)),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 4.w),
                decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(4.r)),
                child: Text(c.set, style: T.small.copyWith(color: Colors.white, fontSize: 9.sp, fontWeight: FontWeight.w800)),
              ),
            ]),
            Icon(abs ? Icons.cancel_rounded : Icons.check_circle_rounded, size: 18.r, color: abs ? C.danger : C.primary),
            Text(c.shortName, style: T.smallStrong.copyWith(fontSize: 10.5.sp, color: abs ? C.danger : C.ink), maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(abs ? 'Absent' : 'Roll ${c.rollText}', style: T.small.copyWith(fontSize: 9.sp, color: abs ? C.danger : C.slate), maxLines: 1, overflow: TextOverflow.ellipsis),
          ]),
        ),
      ),
    );
  }
}

class _RecordRow extends StatelessWidget {
  const _RecordRow(this.c, this.duty);
  final Candidate c;
  final String duty;
  @override
  Widget build(BuildContext context) {
    final abs = c.absent;
    final line = abs && c.absentReason.isNotEmpty ? c.absentReason.split(' —').first : 'Roll ${c.rollText} • ${c.omr}';
    return Padding(
      padding: EdgeInsets.only(bottom: 8.h),
      child: AppCard(
        padding: EdgeInsets.all(12.w), radius: R.lg, onTap: () => context.push(RoutePaths.examCandidate(duty, c.id)),
        child: Row(children: [
          Avatar(c.name, size: 40), SizedBox(width: 10.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(c.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                SizedBox(width: 6.w),
                Pill('Set ${c.set}', tone: Tone.brand),
              ]),
              Text('${c.desk} • $line', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
          SizedBox(width: 6.w),
          Pill(abs ? 'Absent' : 'Present', tone: abs ? Tone.danger : Tone.success),
        ]),
      ),
    );
  }
}

/// Candidate card of the "Candidate Details" segment (Figma 5.8.1.1).
class CandidateCard extends StatelessWidget {
  const CandidateCard(this.c, {super.key, required this.dutyId});
  final Candidate c;
  final String dutyId;
  @override
  Widget build(BuildContext context) {
    final abs = c.absent;
    final bloc = context.read<HallSeatingBloc>();
    final reason = c.absentReason.split(' — ');
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        padding: EdgeInsets.all(14.w),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Avatar(c.name, size: 48), SizedBox(width: 10.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(c.name, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  SizedBox(width: 6.w),
                  Pill(c.deskLabel, tone: Tone.neutral),
                ]),
                Text('Roll: ${c.rollText} • Class ${c.cls} • CBSE: ${c.cbse}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                SizedBox(height: 6.h),
                Wrap(spacing: 6.w, runSpacing: 4.h, children: [
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                    decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(R.sm)),
                    child: Text('Set ${c.set}', style: T.smallStrong.copyWith(color: Colors.white, fontSize: 11.sp)),
                  ),
                  if (abs && reason.first.isNotEmpty)
                    Pill(reason.first, tone: Tone.danger, icon: Icons.medical_services_outlined)
                  else if (!abs)
                    const Pill('Admit Verified', tone: Tone.success, icon: Icons.verified_outlined),
                ]),
              ]),
            ),
          ]),
          SizedBox(height: 10.h),
          if (abs && c.absentReason.isNotEmpty)
            Container(
              width: double.infinity, padding: EdgeInsets.all(10.w),
              decoration: BoxDecoration(color: C.dangerSoft, borderRadius: BorderRadius.circular(R.md)),
              child: Text(reason.length > 1 ? reason.sublist(1).join(' — ') : c.absentReason, style: T.small.copyWith(color: C.danger), maxLines: 3, overflow: TextOverflow.ellipsis),
            )
          else
            Container(
              padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 8.h),
              decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
              child: Row(children: [
                Icon(Icons.qr_code_2_rounded, size: 16.r, color: C.slate), SizedBox(width: 6.w),
                Expanded(child: Text.rich(TextSpan(children: [TextSpan(text: 'OMR: ', style: T.small), TextSpan(text: c.omr, style: T.smallStrong)]), maxLines: 1, overflow: TextOverflow.ellipsis)),
                Flexible(
                  child: Text(c.supp == 0 ? 'Supp. Sheets: 0' : 'Supp: ${c.supp} (${c.suppCode})',
                      style: T.small.copyWith(color: c.supp == 0 ? C.slate : C.primary, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
              ]),
            ),
          SizedBox(height: 10.h),
          Row(children: [
            Expanded(
              child: _MarkButton(label: 'Present', icon: Icons.check_circle_outline, on: !abs, color: C.successDark, onTap: () => bloc.add(CandidateMarked(c.id, present: true))),
            ),
            SizedBox(width: 8.w),
            Expanded(
              child: _MarkButton(label: 'Absent', icon: Icons.cancel_outlined, on: abs, color: C.danger, onTap: () => bloc.add(CandidateMarked(c.id, present: false))),
            ),
            SizedBox(width: 8.w),
            Material(
              color: C.surface, borderRadius: BorderRadius.circular(R.md),
              child: IconButton(
                tooltip: 'Candidate details & incident note',
                constraints: BoxConstraints(minWidth: 44.r, minHeight: 44.r),
                onPressed: () => context.push(RoutePaths.examCandidate(dutyId, c.id)),
                icon: Icon(Icons.flag_outlined, size: 20.r, color: c.malpractice.isNotEmpty ? C.danger : C.slate),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}

class _MarkButton extends StatelessWidget {
  const _MarkButton({required this.label, required this.icon, required this.on, required this.color, required this.onTap});
  final String label;
  final IconData icon;
  final bool on;
  final Color color;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true, selected: on,
        child: Material(
          color: on ? color : C.surface,
          borderRadius: BorderRadius.circular(R.md),
          child: InkWell(
            borderRadius: BorderRadius.circular(R.md),
            onTap: onTap,
            child: Container(
              constraints: BoxConstraints(minHeight: 44.h),
              alignment: Alignment.center,
              padding: EdgeInsets.symmetric(horizontal: 8.w),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                if (on) ...[Icon(icon, size: 18.r, color: Colors.white), SizedBox(width: 6.w)],
                Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.bodyStrong.copyWith(color: on ? Colors.white : C.slate, fontSize: 14.sp))),
              ]),
            ),
          ),
        ),
      );
}
