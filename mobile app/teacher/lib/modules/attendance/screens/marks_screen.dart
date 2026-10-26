import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/models/school_models.dart';
import '../bloc/load_status.dart';
import '../bloc/marks_bloc.dart';
import '../bloc/marks_events.dart';
import '../models/attendance_models.dart';
import '../models/marks_models.dart';
import 'widgets/att_widgets.dart';

String marksEntryPath(String examId, String studentId, {bool edit = false}) =>
    Uri(path: edit ? RoutePaths.marksEdit : RoutePaths.marksEnter, queryParameters: {'exam': examId, 'student': studentId}).toString();

/// 1.3 Enter marks list (Figma 1153:19813).
class MarksScreen extends StatelessWidget {
  const MarksScreen({super.key, this.classId});
  final String? classId;
  @override
  Widget build(BuildContext context) => BlocProvider(create: (_) => getIt<MarksBloc>()..add(MarksLoadRequested(classId: classId)), child: const _MarksView());
}

class _MarksView extends StatelessWidget {
  const _MarksView();

  @override
  Widget build(BuildContext context) {
    final s = context.watch<MarksBloc>().state;
    final bloc = context.read<MarksBloc>();
    if (s.status != LoadStatus.loaded) return DetailScaffold(title: 'Enter Marks', body: attLoading());
    final ex = s.exam;
    if (ex == null) return const DetailScaffold(title: 'Enter Marks', body: Center(child: AppEmptyState('No exams scheduled', icon: Icons.menu_book_outlined)));
    final cls = s.classById(ex.classId);
    final st = s.statsOf(ex);
    final roster = s.roster;
    final marks = s.marksOf(ex.id);
    final nPending = roster.where((r) => s.isPending(ex.id, r.id)).length, nAbs = roster.where((r) => s.isAbsent(ex.id, r.id)).length;
    final chips = ['All (${roster.length})', 'Pending ($nPending)', 'Graded (${roster.length - nPending - nAbs})', 'Absent ($nAbs)'];
    final shown = s.shown;
    return DetailScaffold(
      title: 'Enter Marks',
      bottom: ex.submitted
          ? Row(children: [
              Icon(Icons.lock_outline_rounded, color: C.successDark, size: 22.r), SizedBox(width: 8.w),
              Expanded(child: Text(ex.lockedByAdmin ? 'Marks entry is locked by the exam cell. Contact the school admin for changes.' : 'Marks submitted. Tap a student to edit with a reason.', style: T.small)),
            ])
          : Row(children: [
              Expanded(child: AppButton('Save as Draft', kind: BtnKind.outline, onPressed: () => toast(context, 'Draft saved • ${st.graded}/${st.total} entered'))),
              SizedBox(width: 10.w),
              Expanded(child: AppButton('Submit Marks', icon: Icons.send_rounded, onPressed: () async {
                if (st.pending > 0) {
                  toast(context, '${st.pending} students still pending. Enter marks or mark them Absent.');
                  bloc.add(const MarksFilterChanged('Pending'));
                  return;
                }
                final ok = await AppDialogs.showConfirmDialog(context,
                    title: 'Submit marks?', message: '${st.total} students for ${ex.name} will be submitted. You can still edit later with a reason.', confirm: 'Submit');
                if (!ok || !context.mounted) return;
                bloc.add(MarksExamSubmitted(ex.id));
                toast(context, 'Marks submitted for ${cls?.title ?? 'class'}');
              })),
            ]),
      body: AttBody(children: [
        AppCard(radius: R.lg, padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 10.h), child: Row(children: [
          Icon(ex.submitted ? Icons.lock_outline_rounded : Icons.lock_open_rounded, size: 18.r, color: C.slate), SizedBox(width: 8.w),
          Expanded(child: Text(ex.name, style: T.smallStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
          Icon(ex.submitted ? Icons.check_circle_outline_rounded : Icons.cloud_done_outlined, size: 16.r, color: C.successDark), SizedBox(width: 4.w),
          Text(ex.lockedByAdmin ? 'Locked' : ex.submitted ? 'Submitted' : 'Auto-saved just now', style: T.small.copyWith(color: C.successDark)),
        ])),
        SizedBox(height: 12.h),
        AppCard(radius: R.xl, child: Column(children: [
          AppPickTile(icon: Icons.menu_book_outlined, caption: 'ASSESSMENT SCOPE', label: '${ex.name} (Max: ${ex.max})', onTap: () async {
            final r = await showPickSheet<Exam>(context, title: 'Select assessment', items: s.exams, selected: ex,
                label: (e) => '${e.name} • ${s.classById(e.classId)?.title ?? ''}',
                sub: (e) {
                  final x = s.statsOf(e);
                  return '${e.subject} • Max ${e.max} • ${x.graded}/${x.total} entered • ${e.status}';
                });
            if (r != null) bloc.add(MarksExamSelected(r.id));
          }),
          SizedBox(height: 10.h),
          AppPickTile(icon: Icons.groups_rounded, caption: 'TARGET COHORT', label: '${cls?.title ?? ''} • ${roster.length} Students', onTap: () async {
            final withExam = s.classes.where((c) => s.exams.any((e) => e.classId == c.id)).toList();
            final r = await showPickSheet<SchoolClass>(context, title: 'Select cohort', items: withExam, selected: cls, label: (c) => c.title,
                sub: (c) => '${s.exams.where((e) => e.classId == c.id).length} assessment(s)');
            if (r != null) bloc.add(MarksExamSelected(s.exams.firstWhere((e) => e.classId == r.id).id));
          }),
          SizedBox(height: 10.h),
          AppProgress(st.total == 0 ? 0 : st.graded / st.total, tone: st.pending == 0 ? Tone.success : Tone.brand),
          SizedBox(height: 4.h),
          Align(alignment: Alignment.centerLeft, child: Text('${st.graded} of ${st.total} entered • ${(st.total == 0 ? 0 : st.graded * 100 / st.total).round()}% complete', style: T.small)),
        ])),
        SizedBox(height: 12.h),
        Row(children: [
          Expanded(child: _Stat('Total', '${st.total}', C.ink, C.border)),
          SizedBox(width: 8.w),
          Expanded(child: _Stat('Graded', '${st.graded}', C.primary, C.primary)),
          SizedBox(width: 8.w),
          Expanded(child: _Stat('Pending', '${st.pending}', C.danger, C.danger)),
          SizedBox(width: 8.w),
          Expanded(child: _Stat('Average', '${st.avg.toStringAsFixed(1)}%', C.successDark, C.success)),
        ]),
        SizedBox(height: 12.h),
        AppSearchField(hint: 'Search student name or roll number...', onChanged: (v) => bloc.add(MarksQueryChanged(v))),
        SizedBox(height: 10.h),
        FilterChips(items: chips, value: chips.firstWhere((c) => c.startsWith(s.filter)), onChanged: (v) => bloc.add(MarksFilterChanged(v.split(' ').first))),
        SizedBox(height: 12.h),
        if (shown.isEmpty) const AppEmptyState('No students match', hint: 'Change the filter or search term.', icon: Icons.person_search_outlined),
        for (final r in shown) _MarkRow(key: ValueKey('${ex.id}_${r.id}'), ex: ex, st: r, mark: marks[r.id]),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value, this.color, this.border);
  final String label, value;
  final Color color, border;
  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.symmetric(vertical: 10.h, horizontal: 4.w), alignment: Alignment.center,
        decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
        child: Column(children: [
          Container(height: 3.h, width: 28.w, margin: EdgeInsets.only(bottom: 6.h), decoration: BoxDecoration(color: border, borderRadius: BorderRadius.circular(2.r))),
          Text(label, style: T.small.copyWith(fontSize: 11.sp, color: color == C.ink ? C.slate : color)),
          FittedBox(fit: BoxFit.scaleDown, child: Text(value, style: T.h2.copyWith(color: color))),
        ]),
      );
}

class _MarkRow extends StatefulWidget {
  const _MarkRow({super.key, required this.ex, required this.st, required this.mark});
  final Exam ex;
  final Student st;
  final StudentMark? mark;
  @override
  State<_MarkRow> createState() => _MarkRowState();
}

class _MarkRowState extends State<_MarkRow> {
  late final TextEditingController c = TextEditingController(text: widget.mark?.marks?.toString() ?? '');
  String? err;

  int get max => widget.ex.max;

  @override
  void didUpdateWidget(_MarkRow old) {
    super.didUpdateWidget(old);
    final v = widget.mark?.marks?.toString() ?? '';
    if (v != c.text && int.tryParse(c.text) != widget.mark?.marks && err == null) c.text = v;
  }

  @override
  void dispose() {
    c.dispose();
    super.dispose();
  }

  StudentMark get _base => widget.mark ?? StudentMark(examId: widget.ex.id, studentId: widget.st.id);

  void _save(StudentMark m) => context.read<MarksBloc>().add(MarkSaved(m));

  void _commit(String v) {
    if (v.isEmpty) {
      setState(() => err = null);
      return _save(_base.copyWith(status: 'Present', marks: () => null));
    }
    final n = int.tryParse(v);
    if (n == null || n < 0) return setState(() => err = 'Enter a valid number');
    if (n > max) return setState(() => err = 'Max is $max');
    setState(() => err = null);
    _save(_base.copyWith(status: 'Present', marks: () => n, sections: const {}));
  }

  void _set(int? n, {bool absent = false}) {
    c.text = n?.toString() ?? '';
    setState(() => err = null);
    _save(_base.copyWith(status: absent ? 'Absent' : 'Present', marks: () => absent ? null : n));
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.mark;
    final absent = m != null && m.absent;
    final has = m != null && m.marks != null;
    final pending = !absent && !has;
    final pct = has ? m.marks! * 100 / max : 0.0;
    final locked = widget.ex.submitted;
    final id = widget.st.id;
    return Container(
      margin: EdgeInsets.only(bottom: 10.h), padding: EdgeInsets.all(14.r),
      decoration: BoxDecoration(
        color: pending ? C.warningSoft.withValues(alpha: .4) : C.bg, borderRadius: BorderRadius.circular(R.lg),
        border: Border.all(color: pending ? C.warning.withValues(alpha: .6) : C.border, width: pending ? 1.5 : 1),
      ),
      child: Column(children: [
        Row(children: [
          Avatar(widget.st.name, size: 42), SizedBox(width: 10.w),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(widget.st.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(pending ? 'Pending Entry' : 'Roll #${two(widget.st.roll)} • ${widget.st.adm}', maxLines: 1, overflow: TextOverflow.ellipsis,
                style: T.small.copyWith(color: pending ? C.warningDark : C.slate, fontWeight: pending ? FontWeight.w700 : FontWeight.w500)),
          ])),
          if (absent)
            Pill(m.status, tone: Tone.danger)
          else ...[
            SizedBox(
              width: 62.w,
              child: TextField(
                controller: c, enabled: !locked, keyboardType: TextInputType.number, textAlign: TextAlign.center,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(3)],
                onChanged: _commit, style: T.bodyStrong.copyWith(color: C.primary),
                decoration: InputDecoration(
                  hintText: '--', isDense: true, contentPadding: EdgeInsets.symmetric(vertical: 10.h), fillColor: has ? C.primarySoft : C.bg, filled: true,
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(R.md), borderSide: BorderSide(color: err != null ? C.danger : pending ? C.warning : C.panelBorder)),
                ),
              ),
            ),
            SizedBox(width: 4.w), Text('/ $max', style: T.small),
          ],
        ]),
        if (err != null) Align(alignment: Alignment.centerRight, child: Padding(padding: EdgeInsets.only(top: 4.h), child: Text(err!, style: T.small.copyWith(color: C.danger)))),
        SizedBox(height: 8.h),
        if (pending && !locked)
          Container(
            padding: EdgeInsets.all(8.r), decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
            child: Row(children: [
              Expanded(child: Text('Quick Assign:', style: T.small)),
              for (final v in [(max * .8).round(), (max * .9).round()]) Padding(padding: EdgeInsets.only(left: 6.w), child: _Quick('$v', () => _set(v))),
              Padding(padding: EdgeInsets.only(left: 6.w), child: _Quick('Absent', () => _set(null, absent: true), danger: true)),
            ]),
          )
        else
          Row(children: [
            if (has) ...[Pill('Grade ${gradeOf(pct)} • ${pct.round()}%', tone: pct >= 80 ? Tone.success : pct >= 55 ? Tone.brand : Tone.warning), SizedBox(width: 8.w)],
            if (!pending) Flexible(child: Pill(absent ? m.status : m.remark(pct), tone: Tone.neutral)),
            const Spacer(),
            if (absent && !locked) TextButton(onPressed: () => _set(null), child: const Text('Undo')),
            if (!widget.ex.lockedByAdmin)
              IconButton(
                tooltip: 'Detailed entry for ${widget.st.name}', constraints: BoxConstraints(minWidth: 44.r, minHeight: 44.r),
                onPressed: () => context.push(marksEntryPath(widget.ex.id, id, edit: locked)),
                icon: Icon(Icons.edit_note_rounded, color: C.slate, size: 24.r),
              ),
          ]),
        if (pending && !locked)
          Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () => context.push(marksEntryPath(widget.ex.id, id)), child: const Text('Detailed entry ›'))),
      ]),
    );
  }
}

class _Quick extends StatelessWidget {
  const _Quick(this.label, this.onTap, {this.danger = false});
  final String label;
  final VoidCallback onTap;
  final bool danger;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true, label: 'Quick assign $label',
        child: InkWell(
          borderRadius: BorderRadius.circular(R.sm), onTap: onTap,
          child: Container(
            constraints: BoxConstraints(minHeight: 44.r, minWidth: 44.r), alignment: Alignment.center, padding: EdgeInsets.symmetric(horizontal: 10.w),
            decoration: BoxDecoration(color: danger ? C.dangerSoft : C.bg, borderRadius: BorderRadius.circular(R.sm), border: Border.all(color: danger ? C.danger.withValues(alpha: .4) : C.border)),
            child: Text(label, style: T.smallStrong.copyWith(color: danger ? C.danger : C.ink)),
          ),
        ),
      );
}
