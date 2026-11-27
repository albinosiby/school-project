import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../classes/screens/widgets/class_charts.dart';
import '../../engage/models/attachment_models.dart';
import '../../engage/screens/widgets/engage_widgets.dart' show openFileRef;
import '../bloc/homework_bloc.dart';
import '../bloc/homework_events.dart';
import '../bloc/homework_states.dart';
import '../models/homework_grading.dart';
import '../models/homework_models.dart';

const _mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// "Due tomorrow", "Overdue by 2 days", "Due Mon, 30 Nov".
String dueLabel(Homework h, DateTime today) {
  final d = DateTime.tryParse(h.due.length >= 10 ? h.due.substring(0, 10) : h.due);
  final left = h.daysLeft(today);
  if (d == null || left == null) return 'No due date';
  if (left == 0) return 'Due today';
  if (left == 1) return 'Due tomorrow';
  if (left < 0) return 'Overdue by ${-left} ${left == -1 ? 'day' : 'days'}';
  return 'Due ${_wd[d.weekday - 1]}, ${d.day} ${_mon[d.month - 1]}';
}

String _when(String iso) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '';
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  return '${d.day} ${_mon[d.month - 1]}, $h:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'AM' : 'PM'}';
}

enum _Filter { all, toGrade, graded, missing, late }

/// One homework: what was set, who handed in (parent app uploads or on paper), and grading (marks + feedback).
class HomeworkScreen extends StatelessWidget {
  const HomeworkScreen({super.key, required this.id, this.graded = false});
  final String id;

  /// Open on the graded students (the old graded route).
  final bool graded;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<HomeworkBloc>()..add(HomeworkLoadRequested(id)),
    child: _HomeworkView(initial: graded ? _Filter.graded : _Filter.all),
  );
}

class _HomeworkView extends StatefulWidget {
  const _HomeworkView({required this.initial});
  final _Filter initial;
  @override
  State<_HomeworkView> createState() => _HomeworkViewState();
}

class _HomeworkViewState extends State<_HomeworkView> {
  late _Filter _filter = widget.initial;

  Future<void> _grade(BuildContext context, String studentId) async {
    final bloc = context.read<HomeworkBloc>();
    var next = studentId;
    while (true) {
      final r = await showAppSheet<String>(context, title: 'Grade', builder: (_) => BlocProvider.value(value: bloc, child: _GradeSheet(studentId: next)));
      if (r == null || !context.mounted) return;
      // "next": open the next paper still to grade
      final n = bloc.state.stats.nextToGrade(r);
      if (n == null) return;
      next = n.id;
    }
  }

  Future<void> _menu(BuildContext context, String v, HomeworkState s) async {
    final bloc = context.read<HomeworkBloc>();
    final h = s.homework!;
    switch (v) {
      case 'edit':
        context.push('${RoutePaths.homeworkNew}?classId=${h.classId}&id=${h.id}');
      case 'toggle':
        bloc.add(const HomeworkStatusToggled());
        AppDialogs.showSnackBar(
          context,
          message: h.scheduled ? 'Published — parents are notified' : (h.open ? 'Closed — parents can no longer hand in' : 'Reopened for hand-ins'),
        );
      case 'delete':
        final ok = await AppDialogs.showConfirmDialog(
          context,
          title: 'Delete this assignment?',
          message: 'It disappears for the class and the parents. Grades and hand-ins are removed with it.',
          confirm: 'Delete',
        );
        if (ok) bloc.add(const HomeworkDeleted());
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<HomeworkBloc>().state;
    if (s.status == HomeworkStatus.deleted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted && context.canPop()) context.pop();
      });
    }
    final h = s.homework;
    if (h == null || s.status == HomeworkStatus.deleted) {
      return DetailScaffold(
        title: 'Assignment',
        fallbackRoute: RoutePaths.classes,
        body: switch (s.status) {
          HomeworkStatus.notFound || HomeworkStatus.deleted => const AppEmptyState('Assignment not found', icon: Icons.assignment_late_outlined),
          HomeworkStatus.failure => AppEmptyState('Could not load the assignment', hint: s.error, icon: Icons.cloud_off_rounded),
          _ => const Padding(padding: EdgeInsets.all(16), child: SchoolSkeletonList()),
        },
      );
    }
    final st = s.stats;
    final rows = [
      for (final r in st.rows)
        if (switch (_filter) {
          _Filter.all => true,
          _Filter.toGrade => r.status == SubmissionStatus.submitted,
          _Filter.graded => r.status == SubmissionStatus.graded,
          _Filter.missing => r.status == SubmissionStatus.pending,
          _Filter.late => r.status != SubmissionStatus.pending && r.sub.late,
        })
          r,
    ];
    final counts = {
      _Filter.all: st.total,
      _Filter.toGrade: st.toGrade,
      _Filter.graded: st.graded,
      _Filter.missing: st.notSubmitted,
      _Filter.late: st.late,
    };
    const names = {_Filter.all: 'All', _Filter.toGrade: 'To grade', _Filter.graded: 'Graded', _Filter.missing: 'Not handed in', _Filter.late: 'Late'};
    final labels = {for (final f in _Filter.values) f: '${names[f]} (${counts[f]})'};
    return DetailScaffold(
      title: h.title,
      subtitle: '${s.classLabel}${h.subject.isEmpty ? '' : ' • ${h.subject}'}',
      fallbackRoute: '${RoutePaths.students}?classId=${h.classId}&view=subject',
      actions: [
        PopupMenuButton<String>(
          tooltip: 'More',
          onSelected: (v) => _menu(context, v, s),
          itemBuilder: (_) => [
            const PopupMenuItem(value: 'edit', child: Text('Edit assignment')),
            PopupMenuItem(value: 'toggle', child: Text(h.scheduled ? 'Publish now' : (h.open ? 'Close hand-ins' : 'Reopen hand-ins'))),
            const PopupMenuItem(value: 'delete', child: Text('Delete')),
          ],
        ),
      ],
      body: ListView(
        padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 40.h),
        children: [
          _Brief(h: h),
          SizedBox(height: 12.h),
          _Progress(h: h, st: st),
          SizedBox(height: 16.h),
          Row(
            children: [
              Expanded(child: Text('Students', style: T.h2)),
              if (h.open && st.notSubmitted > 0)
                TextButton.icon(
                  key: const ValueKey('hw-all-in'),
                  onPressed: () async {
                    final ok = await AppDialogs.showConfirmDialog(
                      context,
                      title: 'Mark ${st.notSubmitted} as handed in?',
                      message: 'For papers collected in class. Students who uploaded in the parent app are not affected.',
                      confirm: 'Mark handed in',
                    );
                    if (ok && context.mounted) context.read<HomeworkBloc>().add(const HomeworkAllMarkedIn());
                  },
                  icon: Icon(Icons.done_all_rounded, size: 18.r),
                  label: const Text('All handed in'),
                ),
            ],
          ),
          SizedBox(height: 8.h),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: AppChoiceChips(
              items: [for (final f in _Filter.values) labels[f]!],
              value: labels[_filter]!,
              dense: true,
              onChanged: (v) => setState(() => _filter = labels.entries.firstWhere((e) => e.value == v).key),
            ),
          ),
          SizedBox(height: 10.h),
          if (rows.isEmpty)
            Padding(padding: EdgeInsets.only(top: 20.h), child: const AppEmptyState('No students here', icon: Icons.groups_outlined))
          else
            AppCard(
              radius: R.xl,
              padding: EdgeInsets.symmetric(vertical: 4.h),
              child: Column(
                children: [
                  for (var i = 0; i < rows.length; i++) ...[
                    if (i > 0) Divider(height: 1, indent: 64.w, color: C.border),
                    _StudentTile(r: rows[i], h: h, onTap: () => _grade(context, rows[i].id)),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// What was set: due, marks, status, instructions and the teacher's attachments.
class _Brief extends StatelessWidget {
  const _Brief({required this.h});
  final Homework h;
  @override
  Widget build(BuildContext context) {
    final left = h.daysLeft(DateTime.now());
    final overdue = left != null && left < 0;
    return AppCard(
      radius: R.xl,
      padding: EdgeInsets.all(14.r),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 6.w,
            runSpacing: 6.h,
            children: [
              Pill(dueLabel(h, DateTime.now()), tone: overdue && h.open ? Tone.danger : (left != null && left <= 1 ? Tone.warning : Tone.brand), icon: Icons.event_outlined),
              if (h.scheduled)
                Pill('Publishes ${_when(h.publishAt?.toIso8601String() ?? '')}', tone: Tone.purple, icon: Icons.schedule_send_rounded)
              else
                Pill(h.open ? 'Open for hand-ins' : 'Closed', tone: h.open ? Tone.success : Tone.neutral),
              Pill(h.graded ? 'Out of ${h.maxMarks}' : 'Not graded', tone: Tone.neutral, icon: Icons.grading_rounded),
              if (h.open && !h.allowLate) const Pill('No late hand-ins', tone: Tone.neutral),
            ],
          ),
          if (h.description.isNotEmpty) ...[
            SizedBox(height: 12.h),
            Text(h.description, style: T.body.copyWith(color: C.ink)),
          ],
          if (h.attachments.isNotEmpty) ...[
            SizedBox(height: 12.h),
            for (final f in h.attachments) _FileTile(f),
          ],
        ],
      ),
    );
  }
}

/// Hand-in progress as a ring, plus the grade spread once marks are in.
class _Progress extends StatelessWidget {
  const _Progress({required this.h, required this.st});
  final Homework h;
  final HomeworkStats st;
  @override
  Widget build(BuildContext context) {
    final avg = st.avg;
    return AppCard(
      radius: R.xl,
      padding: EdgeInsets.all(14.r),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Hand-ins', style: T.h3),
          Text(
            [
              '${st.turnedIn} of ${st.total} handed in',
              if (st.uploaded > 0) '${st.uploaded} in the parent app',
              if (st.late > 0) '${st.late} late',
            ].join(' • '),
            style: T.small,
          ),
          SizedBox(height: 12.h),
          DonutChart(
            center: '${st.total == 0 ? 0 : (st.turnedIn * 100 / st.total).round()}%',
            caption: 'handed in',
            segments: [
              (label: h.graded ? 'Graded' : 'Checked', value: st.graded, color: C.success),
              (label: 'To ${h.graded ? 'grade' : 'check'}', value: st.toGrade, color: C.primary),
              (label: 'Not handed in', value: st.notSubmitted, color: C.danger),
            ],
          ),
          if (h.graded && st.graded > 0) ...[
            SizedBox(height: 16.h),
            Row(
              children: [
                Expanded(child: Text('Marks', style: T.h3)),
                Text('Average ${avg!.toStringAsFixed(1)} / ${h.maxMarks}', style: T.bodyStrong.copyWith(color: C.primary)),
              ],
            ),
            SizedBox(height: 8.h),
            ColumnChart(
              values: st.bands,
              labels: const ['<40%', '40–60', '60–75', '75–90', '90%+'],
              colors: const [C.danger, C.warning, Color(0xFF60A5FA), C.primary, C.success],
              height: 100,
            ),
          ],
        ],
      ),
    );
  }
}

class _FileTile extends StatelessWidget {
  const _FileTile(this.f);
  final FileRef f;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 6.h),
    child: Material(
      color: C.surface,
      borderRadius: BorderRadius.circular(R.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(R.md),
        onTap: f.url.startsWith('http') ? () => openFileRef(context, f) : null,
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 9.h),
          child: Row(
            children: [
              Icon(f.isImage ? Icons.image_outlined : Icons.picture_as_pdf_outlined, size: 20.r, color: C.primary),
              SizedBox(width: 8.w),
              Expanded(child: Text(f.name, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
              if (f.bytes > 0) Text(FileRef.sizeLabel(f.bytes), style: T.small.copyWith(fontSize: 11.sp)),
              SizedBox(width: 4.w),
              Icon(Icons.open_in_new_rounded, size: 16.r, color: C.slate),
            ],
          ),
        ),
      ),
    ),
  );
}

class _StudentTile extends StatelessWidget {
  const _StudentTile({required this.r, required this.h, required this.onTap});
  final StudentRow r;
  final Homework h;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final hi = r.sub.handin;
    final (label, tone) = switch (r.status) {
      SubmissionStatus.graded => (h.graded && r.sub.marks != null ? '${_n(r.sub.marks!)}/${h.maxMarks}' : 'Done', Tone.success),
      SubmissionStatus.submitted => (h.graded ? 'To grade' : 'To check', Tone.brand),
      SubmissionStatus.pending => ('Not handed in', Tone.danger),
    };
    final detail = [
      if (r.roll > 0) 'Roll ${r.roll.toString().padLeft(2, '0')}',
      if (hi != null) '${hi.files.length} ${hi.files.length == 1 ? 'file' : 'files'} • ${_when(hi.submittedAt)}' else if (r.sub.onPaper) 'On paper',
    ].join(' • ');
    return InkWell(
      key: ValueKey('hw-student-${r.id}'),
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
        child: Row(
          children: [
            Avatar(r.name, size: 40, image: r.photo.isEmpty ? null : r.photo),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(r.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (detail.isNotEmpty) Text(detail, style: T.small.copyWith(fontSize: 11.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            if (r.status != SubmissionStatus.pending && r.sub.late) ...[const Pill('Late', tone: Tone.warning), SizedBox(width: 6.w)],
            Pill(label, tone: tone),
          ],
        ),
      ),
    );
  }
}

String _n(num v) => v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(1);

const _quickFeedback = ['Excellent work', 'Good effort', 'Neat and complete', 'Needs more practice', 'Incomplete — please redo', 'Show your working'];

/// Grade one student: what they handed in (files, note, when), marks out of the max (or "done") and feedback.
/// Pops with the student id after saving and "Save & next" (the screen opens the next paper), else null.
class _GradeSheet extends StatefulWidget {
  const _GradeSheet({required this.studentId});
  final String studentId;
  @override
  State<_GradeSheet> createState() => _GradeSheetState();
}

class _GradeSheetState extends State<_GradeSheet> {
  late final HomeworkState _s0 = context.read<HomeworkBloc>().state;
  late final Submission _sub = _s0.homework!.submissions[widget.studentId] ?? const Submission();
  late final _marks = TextEditingController(text: _sub.marks == null ? '' : _n(_sub.marks!));
  late final _feedback = TextEditingController(text: _sub.feedback);
  String? _error;
  bool _next = false;

  @override
  void dispose() {
    _marks.dispose();
    _feedback.dispose();
    super.dispose();
  }

  void _save({required bool next}) {
    final h = _s0.homework!;
    num? m;
    if (h.graded) {
      m = num.tryParse(_marks.text.trim());
      if (m == null || m < 0 || m > h.maxMarks) {
        setState(() => _error = 'Enter marks from 0 to ${h.maxMarks}');
        return;
      }
    }
    _next = next;
    context.read<HomeworkBloc>().add(HomeworkGradeSaved(studentId: widget.studentId, marks: m, feedback: _feedback.text));
  }

  void _step(num by) {
    final h = _s0.homework!;
    final cur = num.tryParse(_marks.text.trim()) ?? 0;
    final v = (cur + by).clamp(0, h.maxMarks);
    setState(() {
      _marks.text = _n(v);
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) => BlocConsumer<HomeworkBloc, HomeworkState>(
    listenWhen: (a, b) => b.savedSeq > a.savedSeq,
    listener: (ctx, _) => Navigator.pop(ctx, _next ? widget.studentId : null),
    builder: (ctx, s) {
      final h = s.homework!;
      final sub = h.submissions[widget.studentId] ?? const Submission();
      final st = s.student(widget.studentId);
      final hi = sub.handin;
      final more = s.stats.nextToGrade(widget.studentId) != null;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Avatar(st?.name ?? '?', size: 44, image: (st?.photo ?? '').isEmpty ? null : st!.photo),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(st?.name ?? widget.studentId, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                    Text([if ((st?.roll ?? 0) > 0) 'Roll ${st!.roll}', h.title].join(' • '), style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 14.h),
          // what was handed in
          Container(
            padding: EdgeInsets.all(12.r),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Icon(
                      hi != null ? Icons.cloud_done_outlined : (sub.status == SubmissionStatus.pending ? Icons.hourglass_empty_rounded : Icons.description_outlined),
                      size: 18.r,
                      color: sub.status == SubmissionStatus.pending ? C.danger : C.successDark,
                    ),
                    SizedBox(width: 6.w),
                    Expanded(
                      child: Text(
                        hi != null
                            ? 'Handed in through the parent app • ${_when(hi.submittedAt)}'
                            : sub.status == SubmissionStatus.pending
                            ? 'Not handed in yet'
                            : 'Handed in on paper',
                        style: T.bodyStrong.copyWith(fontSize: 13.sp),
                      ),
                    ),
                    if (sub.late) const Pill('Late', tone: Tone.warning),
                  ],
                ),
                if (hi != null) ...[
                  SizedBox(height: 8.h),
                  for (final f in hi.files) _FileTile(f),
                  if (hi.note.isNotEmpty) Text('“${hi.note}”', style: T.small.copyWith(fontStyle: FontStyle.italic)),
                ],
                if (hi == null)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      key: const ValueKey('hw-paper-toggle'),
                      onPressed: () => context.read<HomeworkBloc>().add(
                        HomeworkSubmissionMarked(widget.studentId, handedIn: sub.status == SubmissionStatus.pending),
                      ),
                      icon: Icon(sub.status == SubmissionStatus.pending ? Icons.check_rounded : Icons.undo_rounded, size: 16.r),
                      label: Text(sub.status == SubmissionStatus.pending ? 'Mark handed in on paper' : 'Undo: not handed in'),
                    ),
                  ),
              ],
            ),
          ),
          SizedBox(height: 14.h),
          if (h.graded) ...[
            Text('Marks', style: T.smallStrong),
            SizedBox(height: 6.h),
            Row(
              children: [
                _StepButton(Icons.remove_rounded, () => _step(-1)),
                SizedBox(width: 8.w),
                SizedBox(
                  width: 90.w,
                  child: TextField(
                    key: const ValueKey('hw-marks'),
                    controller: _marks,
                    textAlign: TextAlign.center,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                    style: T.h2,
                    decoration: InputDecoration(isDense: true, suffixText: '/${h.maxMarks}', errorText: null),
                    onChanged: (_) => setState(() => _error = null),
                  ),
                ),
                SizedBox(width: 8.w),
                _StepButton(Icons.add_rounded, () => _step(1)),
                const Spacer(),
                for (final p in const [1.0, .75, .5])
                  Padding(
                    padding: EdgeInsets.only(left: 4.w),
                    child: ActionChip(
                      label: Text(p == 1 ? 'Full' : '${(p * 100).round()}%'),
                      visualDensity: VisualDensity.compact,
                      onPressed: () => setState(() {
                        _marks.text = _n((h.maxMarks * p).round());
                        _error = null;
                      }),
                    ),
                  ),
              ],
            ),
            if (_error != null) Padding(padding: EdgeInsets.only(top: 4.h), child: Text(_error!, style: T.small.copyWith(color: C.danger))),
            SizedBox(height: 12.h),
          ],
          Text('Feedback for the parent', style: T.smallStrong),
          SizedBox(height: 6.h),
          Wrap(
            spacing: 6.w,
            runSpacing: 4.h,
            children: [
              for (final q in _quickFeedback)
                ActionChip(
                  label: Text(q, style: T.small.copyWith(fontSize: 11.5.sp, color: C.ink)),
                  visualDensity: VisualDensity.compact,
                  onPressed: () => setState(() {
                    final t = _feedback.text.trim();
                    _feedback.text = t.isEmpty ? q : '$t. $q';
                  }),
                ),
            ],
          ),
          SizedBox(height: 8.h),
          TextField(
            key: const ValueKey('hw-feedback'),
            controller: _feedback,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(hintText: 'Optional note shown to the parent', isDense: true),
          ),
          SizedBox(height: 14.h),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  h.graded ? 'Save grade' : 'Mark as done',
                  key: const ValueKey('hw-save'),
                  icon: Icons.check_rounded,
                  kind: more ? BtnKind.outline : BtnKind.primary,
                  onPressed: () => _save(next: false),
                ),
              ),
              if (more) ...[
                SizedBox(width: 10.w),
                Expanded(child: AppButton('Save & next', key: const ValueKey('hw-save-next'), icon: Icons.arrow_forward_rounded, onPressed: () => _save(next: true))),
              ],
            ],
          ),
        ],
      );
    },
  );
}

class _StepButton extends StatelessWidget {
  const _StepButton(this.icon, this.onTap);
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: C.panel,
    shape: const CircleBorder(),
    child: InkWell(customBorder: const CircleBorder(), onTap: onTap, child: Padding(padding: EdgeInsets.all(8.r), child: Icon(icon, size: 20.r, color: C.primary))),
  );
}
