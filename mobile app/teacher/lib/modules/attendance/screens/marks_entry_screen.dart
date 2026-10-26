import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/models/school_models.dart';
import '../bloc/load_status.dart';
import '../bloc/marks_bloc.dart';
import '../bloc/marks_events.dart';
import '../bloc/marks_states.dart';
import '../models/attendance_models.dart';
import '../models/marks_models.dart';
import 'widgets/att_widgets.dart';

const _statuses = ['Present', 'Absent', 'Medical Slip', 'Disqualified'];
const _statusIcons = {'Present': Icons.check_rounded, 'Absent': Icons.person_off_outlined, 'Medical Slip': Icons.medical_services_outlined, 'Disqualified': Icons.block_rounded};
const _tags = ['Consistent', 'Formula Weakness', 'Exceptional', 'Needs Practice', 'Calculation Slip'];
const _editTags = ['Outstanding', 'Consistent', 'Needs Revision', 'Remedial Math'];

/// 1.3.2 Enter Marks (Figma 1153:17424) and, with [edit], 1.3.1 Edit Marks (Figma 1153:17021).
class MarksEntryScreen extends StatelessWidget {
  const MarksEntryScreen({super.key, this.examId, this.studentId, this.edit = false});
  final String? examId, studentId;
  final bool edit;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MarksBloc>()..add(MarksLoadRequested(examId: examId)),
        child: _EntryView(studentId: studentId, edit: edit),
      );
}

class _EntryView extends StatefulWidget {
  const _EntryView({this.studentId, required this.edit});
  final String? studentId;
  final bool edit;
  @override
  State<_EntryView> createState() => _EntryViewState();
}

class _EntryViewState extends State<_EntryView> {
  String? studentId;
  String status = 'Present';
  int? total;
  final sec = <String, int?>{};
  String tag = '';
  final note = TextEditingController();
  final reason = TextEditingController();
  final totalC = TextEditingController();
  final secC = <String, TextEditingController>{};
  final errors = <String, String>{};
  bool inited = false;

  bool get edit => widget.edit;

  @override
  void dispose() {
    note.dispose();
    reason.dispose();
    totalC.dispose();
    for (final c in secC.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _load(MarksState s, Exam ex, String sid) {
    studentId = sid;
    final m = s.markOf(ex.id, sid);
    status = m?.status ?? 'Present';
    total = m?.marks;
    totalC.text = total?.toString() ?? '';
    tag = m?.tag ?? '';
    note.text = m?.note ?? '';
    reason.clear();
    errors.clear();
    for (final sc in ex.sections) {
      final v = m?.sections[sc.field];
      sec[sc.key] = v;
      (secC[sc.key] ??= TextEditingController()).text = v?.toString() ?? '';
    }
  }

  void _setTotal(int? v) => setState(() {
        total = v;
        totalC.text = v?.toString() ?? '';
        errors.remove('total');
      });

  void _clearSections() {
    for (final k in sec.keys) {
      sec[k] = null;
      secC[k]!.clear();
    }
  }

  void _secChanged(String k, String v, int max) {
    final n = int.tryParse(v);
    setState(() {
      sec[k] = n;
      if (v.isNotEmpty && (n == null || n > max)) {
        errors[k] = 'Max $max';
      } else {
        errors.remove(k);
      }
      final filled = sec.values.whereType<int>();
      if (filled.isNotEmpty) {
        total = filled.reduce((a, b) => a + b);
        totalC.text = '$total';
        errors.remove('total');
      }
    });
  }

  /// Validates and dispatches the save; returns false when the form has errors.
  bool _save(MarksState s, Exam ex) {
    errors.removeWhere((k, v) => k == 'total' || k == 'reason');
    if (status == 'Present') {
      if (total == null) {
        errors['total'] = 'Enter the total marks';
      } else if (total! > ex.max) {
        errors['total'] = 'Cannot exceed max of ${ex.max}';
      }
    }
    if (edit && reason.text.trim().length < 5) errors['reason'] = 'A reason (min 5 characters) is required to edit submitted marks';
    if (errors.isNotEmpty) {
      setState(() {});
      return false;
    }
    final old = s.markOf(ex.id, studentId!);
    final present = status == 'Present';
    var mark = (old ?? StudentMark(examId: ex.id, studentId: studentId!)).copyWith(
      status: status, marks: () => present ? total : null, tag: tag, note: note.text.trim(),
      sections: {for (final sc in ex.sections) sc.field: present ? sec[sc.key] : null},
    );
    if (edit) {
      final at = DateTime.now().toIso8601String();
      mark = mark.copyWith(modifiedAt: at, modifiedBy: s.teacherName, history: [
        MarkEdit(at: at, by: s.teacherName, reason: reason.text.trim(), from: old?.marks, to: mark.marks),
        ...?old?.history,
      ]);
    }
    context.read<MarksBloc>().add(MarkSaved(mark));
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<MarksBloc>().state;
    final title = edit ? 'Edit Marks' : 'Enter Marks';
    if (s.status != LoadStatus.loaded) return DetailScaffold(title: title, fallbackRoute: RoutePaths.marks, body: attLoading());
    final ex = s.exam;
    if (ex == null) return DetailScaffold(title: title, fallbackRoute: RoutePaths.marks, body: const Center(child: AppEmptyState('Exam not found')));
    final roster = s.roster;
    if (roster.isEmpty) return DetailScaffold(title: title, fallbackRoute: RoutePaths.marks, body: const Center(child: AppEmptyState('No students in this class')));
    if (!inited) {
      inited = true;
      _load(s, ex, roster.any((r) => r.id == widget.studentId) ? widget.studentId! : roster.first.id);
    }
    final idx = roster.indexWhere((r) => r.id == studentId).clamp(0, roster.length - 1);
    final st = roster[idx];
    final max = ex.max;
    final marks = s.marksOf(ex.id);
    final all = marks.values.where((m) => m.marks != null).toList()..sort((a, b) => b.marks!.compareTo(a.marks!));
    final rank = all.indexWhere((m) => m.studentId == st.id) + 1;
    final rate = s.attendanceRate(st);
    final cur = marks[st.id];
    final pct = total == null ? 0.0 : total! * 100 / max;
    final present = status == 'Present';
    final classAvg = all.isEmpty ? 0.0 : all.map((m) => m.marks!).reduce((a, b) => a + b) / all.length;
    final stats = s.statsOf(ex);

    void go(int to) {
      if (to < 0 || to >= roster.length) return;
      setState(() => _load(s, ex, roster[to].id));
    }

    return DetailScaffold(
      title: title,
      subtitle: edit ? '${ex.name} • Max $max Marks' : null,
      fallbackRoute: RoutePaths.marks,
      bottom: edit
          ? Column(mainAxisSize: MainAxisSize.min, children: [
              AppButton('Update Student Marks', icon: Icons.save_outlined, onPressed: () {
                if (_save(s, ex)) {
                  toast(context, 'Marks updated for ${st.name}');
                  goBack(context, RoutePaths.marks);
                }
              }),
              TextButton(onPressed: () => goBack(context, RoutePaths.marks), child: const Text('Cancel & Return')),
            ])
          : Row(children: [
              Expanded(child: AppButton('Save Draft', kind: BtnKind.outline, onPressed: () {
                if (_save(s, ex)) toast(context, 'Draft saved for ${st.name}');
              })),
              SizedBox(width: 10.w),
              Expanded(child: AppButton('Save & Next', icon: Icons.arrow_forward_rounded, onPressed: () {
                if (!_save(s, ex)) return;
                toast(context, 'Saved ${st.name}');
                if (idx + 1 < roster.length) {
                  go(idx + 1);
                } else {
                  goBack(context, RoutePaths.marks);
                }
              })),
            ]),
      body: AttBody(children: [
        if (!edit) _NavBar(roster: roster, idx: idx, onGo: go),
        if (edit && cur?.modifiedAt != null)
          Container(
            margin: EdgeInsets.only(bottom: 10.h), padding: EdgeInsets.all(10.r),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
            child: Text('Last modified ${fmtKey(cur!.modifiedAt!.substring(0, 10), 'MMM d')} by ${cur.modifiedBy}', style: T.small),
          ),
        SizedBox(height: 12.h),
        AppCard(radius: R.xl, child: Row(children: [
          Avatar(st.name, size: 56), SizedBox(width: 12.w),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text(st.name, style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis)),
              SizedBox(width: 6.w),
              Pill('Roll #${two(st.roll)}', tone: Tone.brand),
            ]),
            Text('GRN: ${st.adm} • ${ex.name}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
            SizedBox(height: 4.h),
            Wrap(spacing: 6.w, runSpacing: 4.h, children: [
              Pill('${rate.toStringAsFixed(1)}% Attd', tone: rate < 75 ? Tone.danger : Tone.neutral, icon: Icons.event_available_outlined),
              if (rank > 0) Pill('Rank #${two(rank)}', tone: Tone.brand, icon: Icons.emoji_events_outlined),
            ]),
          ])),
          if (edit && total != null) Text('${pct.toStringAsFixed(1)}%', style: T.h1.copyWith(color: C.primary)),
        ])),
        SizedBox(height: 12.h),
        AppCard(radius: R.xl, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CapsLabel(edit ? 'Attendance & Sitting Status' : 'Examination Sitting Status',
              trailing: Pill(edit ? 'Required' : 'Verified', tone: edit ? Tone.neutral : Tone.brand, icon: edit ? null : Icons.verified_outlined)),
          SizedBox(height: 4.h),
          AppChoiceChips(
            items: _statuses, value: status, solid: true, icons: _statusIcons,
            toneOf: (x) => x == 'Present' ? Tone.brand : Tone.danger,
            onChanged: (x) => setState(() {
              status = x;
              errors.remove('total');
            }),
          ),
        ])),
        if (present) ...[
          SizedBox(height: 12.h),
          AppCard(radius: R.xl, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(edit ? 'AGGREGATE MARKS' : 'TOTAL AGGREGATE SCORE', style: T.capsMuted),
            SizedBox(height: 6.h),
            Row(children: [
              SizedBox(width: 96.w, child: TextField(
                controller: totalC, keyboardType: TextInputType.number, textAlign: TextAlign.center,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(3)],
                style: T.title.copyWith(color: C.primary, fontSize: 28.sp),
                onChanged: (v) => setState(() {
                  total = int.tryParse(v);
                  _clearSections();
                  if (total != null && total! > max) {
                    errors['total'] = 'Cannot exceed max of $max';
                  } else {
                    errors.remove('total');
                  }
                }),
                decoration: InputDecoration(
                  hintText: '--',
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(R.md), borderSide: BorderSide(color: errors['total'] != null ? C.danger : C.panelBorder)),
                ),
              )),
              SizedBox(width: 8.w), Text('/ $max', style: T.h2.copyWith(color: C.slate)),
              const Spacer(),
              if (total != null && total! <= max)
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Pill('Grade ${gradeOf(pct)}', tone: pct >= 80 ? Tone.success : Tone.brand), SizedBox(height: 4.h),
                  Text('Class Avg: ${classAvg.toStringAsFixed(1)}', style: T.small),
                ]),
            ]),
            if (errors['total'] != null) Padding(padding: EdgeInsets.only(top: 6.h), child: Text(errors['total']!, style: T.small.copyWith(color: C.danger))),
            SizedBox(height: 10.h),
            AppProgress(total == null ? 0 : pct / 100),
            SizedBox(height: 10.h),
            Wrap(spacing: 6.w, runSpacing: 6.h, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text('Quick Fill:', style: T.small),
              for (final inc in [1, 5, 10]) _Chip('+$inc', () => _setTotal(((total ?? 0) + inc).clamp(0, max))),
              _Chip('Full ($max)', () => _setTotal(max), primary: true),
              _Chip('Reset', () {
                setState(_clearSections);
                _setTotal(null);
              }, danger: true),
            ]),
          ])),
          if (ex.sections.isNotEmpty) ...[
            SectionHeader('Section Breakdown', action: 'Max Total: $max pts'),
            for (final sc in ex.sections)
              _SectionRow(
                section: sc, controller: secC[sc.key]!, error: errors[sc.key], dense: edit,
                onChanged: (v) => _secChanged(sc.key, v, sc.max),
                accuracy: stats.graded == 0 ? null : _accuracy(marks.values, sc),
              ),
            Container(
              margin: EdgeInsets.only(top: 4.h), padding: EdgeInsets.all(12.r),
              decoration: BoxDecoration(color: (total ?? 0) > max ? C.dangerSoft : C.successSoft, borderRadius: BorderRadius.circular(R.md)),
              child: Row(children: [
                Icon((total ?? 0) > max ? Icons.error_outline_rounded : Icons.fact_check_outlined, size: 18.r, color: (total ?? 0) > max ? C.danger : C.successDark), SizedBox(width: 8.w),
                Expanded(child: Text('Validation Check', style: T.smallStrong)),
                Flexible(child: Text('${ex.sections.map((x) => sec[x.key] ?? 0).join(' + ')} = ${total ?? 0} / $max', textAlign: TextAlign.end,
                    style: T.smallStrong.copyWith(color: (total ?? 0) > max ? C.danger : C.successDark))),
              ]),
            ),
          ],
        ],
        SectionHeader(edit ? 'Performance Remark' : 'Performance Tags', caps: true),
        Text(edit ? 'Select one tag' : 'Categorize student aptitude for consolidated report', style: T.small),
        SizedBox(height: 8.h),
        AppChoiceChips(items: edit ? _editTags : _tags, value: tag, deselectable: true, onChanged: (v) => setState(() => tag = v)),
        SectionHeader(edit ? 'Report Card Evaluation Note' : 'Report Card & Parent Note', caps: true),
        TextField(
          controller: note, maxLines: 4, maxLength: 300, onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(hintText: 'Write a short remark for the report card...'),
        ),
        if (edit) ...[
          SizedBox(height: 8.h),
          Text('REASON FOR EDIT (REQUIRED)', style: T.capsMuted),
          SizedBox(height: 6.h),
          TextField(
            controller: reason, maxLines: 2, onChanged: (_) => setState(() => errors.remove('reason')),
            decoration: InputDecoration(hintText: 'e.g. Re-evaluation of Q12 approved by HOD', errorText: errors['reason'], errorMaxLines: 2),
          ),
          if (cur?.history.isNotEmpty == true) ...[
            SizedBox(height: 12.h),
            Text('EDIT HISTORY', style: T.capsMuted),
            for (final h in cur!.history.take(3))
              Padding(
                padding: EdgeInsets.only(top: 4.h),
                child: Text('${fmtKey(h.at.substring(0, 10), 'MMM d')} • ${h.from ?? '--'} → ${h.to ?? '--'} • ${h.reason}', style: T.small),
              ),
          ],
        ],
      ]),
    );
  }

  double? _accuracy(Iterable<StudentMark> marks, ExamSection sc) {
    final v = [for (final m in marks) if (m.sections[sc.field] != null) m.sections[sc.field]!.toDouble()];
    if (v.isEmpty) return null;
    return v.reduce((a, b) => a + b) / v.length * 100 / sc.max;
  }
}

class _NavBar extends StatelessWidget {
  const _NavBar({required this.roster, required this.idx, required this.onGo});
  final List<Student> roster;
  final int idx;
  final ValueChanged<int> onGo;
  @override
  Widget build(BuildContext context) {
    Widget side(int to, bool prev) {
      final ok = to >= 0 && to < roster.length;
      final name = ok ? '${two(roster[to].roll)} ${roster[to].name.split(' ').first}' : '--';
      return Expanded(
        child: Semantics(
          button: true, enabled: ok, label: prev ? 'Previous student' : 'Next student',
          child: InkWell(
            borderRadius: BorderRadius.circular(R.md), onTap: ok ? () => onGo(to) : null,
            child: Container(
              constraints: BoxConstraints(minHeight: 48.h), padding: EdgeInsets.symmetric(horizontal: 6.w),
              child: Row(mainAxisAlignment: prev ? MainAxisAlignment.start : MainAxisAlignment.end, children: [
                if (prev) Icon(Icons.chevron_left_rounded, size: 20.r, color: ok ? C.ink : C.muted),
                Flexible(child: Column(crossAxisAlignment: prev ? CrossAxisAlignment.start : CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
                  Text(prev ? 'PREV' : 'NEXT', style: T.capsMuted.copyWith(fontSize: 10.sp)),
                  Text(name, style: T.smallStrong.copyWith(color: ok ? C.ink : C.muted), maxLines: 1, overflow: TextOverflow.ellipsis),
                ])),
                if (!prev) Icon(Icons.chevron_right_rounded, size: 20.r, color: ok ? C.ink : C.muted),
              ]),
            ),
          ),
        ),
      );
    }

    return AppCard(
      radius: R.lg, padding: EdgeInsets.all(6.r),
      child: Row(children: [
        side(idx - 1, true),
        Container(
          padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 6.h),
          decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
          child: Column(children: [
            Text('EVALUATION', style: T.capsMuted.copyWith(fontSize: 10.sp)),
            Text.rich(TextSpan(children: [
              TextSpan(text: two(idx + 1), style: T.h3.copyWith(color: C.primary)),
              TextSpan(text: ' / ${roster.length}', style: T.small),
            ])),
          ]),
        ),
        side(idx + 1, false),
      ]),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.label, this.onTap, {this.danger = false, this.primary = false});
  final String label;
  final VoidCallback onTap;
  final bool danger, primary;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true, label: label,
        child: InkWell(
          borderRadius: BorderRadius.circular(R.sm), onTap: onTap,
          child: Container(
            constraints: BoxConstraints(minHeight: 44.r, minWidth: 44.r), alignment: Alignment.center, padding: EdgeInsets.symmetric(horizontal: 8.w),
            decoration: BoxDecoration(color: danger ? C.dangerSoft : primary ? C.primarySoft : C.surface, borderRadius: BorderRadius.circular(R.sm), border: Border.all(color: C.border)),
            child: Text(label, style: T.smallStrong.copyWith(color: danger ? C.danger : primary ? C.primary : C.ink, fontSize: 12.sp)),
          ),
        ),
      );
}

class _SectionRow extends StatelessWidget {
  const _SectionRow({required this.section, required this.controller, required this.onChanged, this.error, this.accuracy, this.dense = false});
  final ExamSection section;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final String? error;
  final double? accuracy;
  final bool dense;
  @override
  Widget build(BuildContext context) => Container(
        margin: EdgeInsets.only(bottom: 8.h), padding: EdgeInsets.all(12.r),
        decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: error != null ? C.danger : C.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 32.r, height: 32.r, alignment: Alignment.center,
              decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.sm)),
              child: Text(section.key, style: T.bodyStrong.copyWith(color: C.primary)),
            ),
            SizedBox(width: 10.w),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(section.name, style: T.bodyStrong.copyWith(fontSize: 13.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
              if (!dense) Text(section.desc, style: T.small.copyWith(fontSize: 11.sp)),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('MAX', style: T.capsMuted.copyWith(fontSize: 10.sp)),
              Text('${section.max} pts', style: T.smallStrong),
            ]),
          ]),
          SizedBox(height: 10.h),
          Row(children: [
            AppNumberStepper(controller: controller, max: section.max, label: section.name, error: error != null, onChanged: onChanged),
            const Spacer(),
            if (accuracy != null && !dense)
              Flexible(child: Container(
                padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 6.h),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.sm)),
                child: Text.rich(TextSpan(children: [
                  TextSpan(text: 'Accuracy ', style: T.small.copyWith(fontSize: 11.sp)),
                  TextSpan(text: '${accuracy!.toStringAsFixed(1)}%', style: T.smallStrong.copyWith(color: C.primary)),
                ]), maxLines: 1, overflow: TextOverflow.ellipsis),
              )),
          ]),
          if (error != null) Padding(padding: EdgeInsets.only(top: 4.h), child: Text(error!, style: T.small.copyWith(color: C.danger))),
        ]),
      );
}
