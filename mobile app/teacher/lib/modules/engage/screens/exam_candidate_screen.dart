import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/hall_seating_bloc.dart';
import '../bloc/hall_seating_events.dart';
import '../bloc/hall_seating_states.dart';
import 'widgets/engage_widgets.dart';

/// One candidate's record: attendance, supplementary sheets and incident note.
class ExamCandidateScreen extends StatelessWidget {
  const ExamCandidateScreen({super.key, required this.dutyId, required this.candidateId});
  final String dutyId, candidateId;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<HallSeatingBloc>()..add(HallSeatingLoadRequested(dutyId)),
        child: NoticeListener<HallSeatingBloc, HallSeatingState>(child: _CandidateView(candidateId)),
      );
}

class _CandidateView extends StatefulWidget {
  const _CandidateView(this.cid);
  final String cid;
  @override
  State<_CandidateView> createState() => _CandidateViewState();
}

class _CandidateViewState extends State<_CandidateView> {
  final note = TextEditingController();
  bool loaded = false;

  @override
  void dispose() {
    note.dispose();
    super.dispose();
  }

  Widget _kv(String k, String v) => Padding(
        padding: EdgeInsets.symmetric(vertical: 4.h),
        child: Row(children: [
          Expanded(child: Text(k, style: T.body)),
          SizedBox(width: 8.w),
          Flexible(child: Text(v, style: T.bodyStrong, textAlign: TextAlign.end, maxLines: 1, overflow: TextOverflow.ellipsis)),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final st = context.watch<HallSeatingBloc>().state;
    final c = st.byId(widget.cid);
    if (c == null) return DetailScaffold(title: 'Candidate Details', body: EngageStatusBody(status: st.status, error: st.error, notFound: 'Candidate not found'));
    if (!loaded) {
      note.text = c.malpractice;
      loaded = true;
    }
    final d = st.duty;
    final bloc = context.read<HallSeatingBloc>();
    final abs = c.absent;
    return DetailScaffold(
      title: 'Candidate Details',
      subtitle: d == null ? null : '${d.code} • ${d.hall}',
      bottom: Row(children: [
        Expanded(child: AppButton('Present', icon: Icons.check_rounded, kind: abs ? BtnKind.outline : BtnKind.primary, onPressed: () => bloc.add(CandidateMarked(c.id, present: true)))),
        SizedBox(width: 10.w),
        Expanded(child: AppButton('Absent', icon: Icons.close_rounded, kind: abs ? BtnKind.danger : BtnKind.outline, onPressed: () => bloc.add(CandidateMarked(c.id, present: false)))),
      ]),
      body: ListView(padding: EdgeInsets.all(S.page), children: [
        PanelCard(
          padding: EdgeInsets.all(16.w),
          child: Row(children: [
            Avatar(c.name, size: 64), SizedBox(width: 14.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(c.name, style: T.h1, maxLines: 2, overflow: TextOverflow.ellipsis),
                Text('${c.deskLabel} • Set ${c.set}', style: T.body, maxLines: 1, overflow: TextOverflow.ellipsis),
                SizedBox(height: 6.h),
                Pill(abs ? 'Absent' : 'Present', tone: abs ? Tone.danger : Tone.success, dot: true),
              ]),
            ),
          ]),
        ),
        SizedBox(height: 12.h),
        FormCard(title: 'Candidate Record', icon: Icons.badge_outlined, children: [
          _kv('Roll', c.rollText), _kv('Class', 'Class ${c.cls}'), _kv('CBSE reg.', c.cbse), _kv('OMR sheet', c.omr),
          _kv('Supplementary', c.supp == 0 ? '0' : '${c.supp} (${c.suppCode})'), _kv('Admit card', abs ? 'Not verified' : 'Verified'),
        ]),
        if (abs && c.absentReason.isNotEmpty)
          Padding(
            padding: EdgeInsets.only(bottom: 12.h),
            child: AppCard(
              color: C.dangerSoft, border: C.danger.withValues(alpha: .3), padding: EdgeInsets.all(14.w),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(c.absentReason, style: T.body.copyWith(color: C.ink)),
                SizedBox(height: 8.h),
                AppButton('View Medical Slip', icon: Icons.visibility_outlined, kind: BtnKind.outline, small: true, expand: false,
                    onPressed: () => showNotice(context, 'Opening clinic slip (simulated)')),
              ]),
            ),
          ),
        FormCard(title: 'Supplementary sheets', icon: Icons.note_add_outlined, children: [
          Row(children: [
            Expanded(child: Text('${c.supp} issued', style: T.bodyStrong)),
            IconButton(
              tooltip: 'Remove supplementary sheet', iconSize: 24.r,
              onPressed: c.supp == 0 ? null : () => bloc.add(SupplementaryChanged(c.id, c.supp - 1)),
              icon: const Icon(Icons.remove_circle_outline),
            ),
            IconButton(
              tooltip: 'Issue supplementary sheet', iconSize: 24.r,
              onPressed: abs ? null : () => bloc.add(SupplementaryChanged(c.id, c.supp + 1)),
              icon: const Icon(Icons.add_circle_outline, color: C.primary),
            ),
          ]),
        ]),
        FormCard(title: 'Malpractice / Incident Note', icon: Icons.report_gmailerrorred_outlined, children: [
          AppTextField(label: 'Note (optional)', controller: note, maxLines: 3, hint: 'Describe any malpractice or incident'),
          AppButton('Save Note', kind: BtnKind.soft, small: true, onPressed: () => bloc.add(IncidentNoteSaved(c.id, note.text))),
          if (c.malpractice.isNotEmpty) Padding(padding: EdgeInsets.only(top: 8.h), child: const Pill('Incident flagged', tone: Tone.danger, icon: Icons.flag_outlined)),
        ]),
      ]),
    );
  }
}
