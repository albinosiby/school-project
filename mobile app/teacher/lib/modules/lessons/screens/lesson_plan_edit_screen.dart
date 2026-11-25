import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/app_config.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../engage/models/attachment_models.dart';
import '../../engage/screens/widgets/attachment_sheet.dart';
import '../../engage/screens/widgets/engage_widgets.dart' show FieldLabel;
import '../../engage/screens/widgets/form_steps.dart';
import '../../home/models/timetable_models.dart' as bell;
import '../../school/bloc/school_bloc.dart';
import '../bloc/lesson_plans_bloc.dart';
import '../bloc/lesson_plans_events.dart';
import '../bloc/lesson_plans_states.dart';
import '../models/lesson_plan_models.dart';
import '../models/teaching_options.dart';
import 'widgets/lesson_plan_widgets.dart';
import 'widgets/lessons_common.dart';

/// Create (`id == 'new'`) or edit a lesson plan: class & subject, the chapter, outcomes, sessions (dates from the
/// teacher's timetable) and attachments.
class LessonPlanEditScreen extends StatelessWidget {
  const LessonPlanEditScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<LessonPlansBloc>()..add(const LessonPlansLoadRequested()),
    child: BlocListener<LessonPlansBloc, LessonPlansState>(
      listenWhen: (a, b) => a.notice != b.notice && b.notice != null,
      listener: (context, s) => handleNotice(context, s.notice!),
      child: _EditView(id: id),
    ),
  );
}

class _EditView extends StatefulWidget {
  const _EditView({required this.id});
  final String id;
  @override
  State<_EditView> createState() => _EditViewState();
}

class _EditViewState extends State<_EditView> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController(), _chapter = TextEditingController(), _summary = TextEditingController();
  final _outcome = TextEditingController();
  String _cls = '', _subject = '';
  bool _loaded = false, _showErrors = false;
  List<String> _outcomes = [];
  List<LessonSession> _sessions = [];
  List<FileRef> _attachments = [];
  List<PickedAttachment> _files = [];
  String? _sessionErr;
  LessonPlan? _existing;
  int _nextId = 1;

  bool get _isNew => widget.id == 'new';

  void _load(LessonPlansState st) {
    if (_loaded || st.status != LessonPlansStatus.loaded) return;
    _loaded = true;
    final p = _isNew ? null : st.byId(widget.id);
    _existing = p;
    if (p == null) return;
    _title.text = p.title;
    _chapter.text = p.chapter;
    _summary.text = p.summary;
    _cls = p.cls;
    _subject = p.subject;
    _outcomes = [...p.outcomes];
    _sessions = [...p.sessions];
    _attachments = [...p.attachments];
    _nextId = p.sessions.length + 1;
  }

  @override
  void dispose() {
    for (final c in [_title, _chapter, _summary, _outcome]) {
      c.dispose();
    }
    super.dispose();
  }

  String _newSessionId() {
    while (_sessions.any((s) => s.id == 's$_nextId')) {
      _nextId++;
    }
    return 's${_nextId++}';
  }

  /// Adds [n] sessions dated from the timetable (after the last dated one, or from today).
  void _addSessions(LessonPlansState st, int n) {
    final taken = {
      for (final s in _sessions)
        if (s.date.isNotEmpty) '${s.date}|${s.slot}',
    };
    final last = _sessions
        .map((s) => s.date)
        .where((d) => d.isNotEmpty)
        .fold<String>('', (a, b) => b.compareTo(a) > 0 ? b : a);
    final from = last.isEmpty || last.compareTo(todayIso()) < 0 ? todayIso() : last;
    final dates = suggestSessionDates(periods: st.slotsFor(_cls, _subject), from: from, count: n, taken: taken);
    setState(() {
      for (var i = 0; i < n; i++) {
        _sessions.add(
          LessonSession(
            id: _newSessionId(),
            date: i < dates.length ? dates[i].date : '',
            slot: i < dates.length ? dates[i].slot : '',
          ),
        );
      }
      _sessionErr = null;
    });
    if (dates.length < n && mounted) {
      AppDialogs.showSnackBar(
        context,
        message: dates.isEmpty
            ? 'No $_subject periods for $_cls in your timetable — pick dates yourself.'
            : 'Only ${dates.length} timetable periods found; date the rest yourself.',
      );
    }
  }

  /// Re-dates every session that is not taught yet from the timetable, in order.
  void _refillDates(LessonPlansState st) {
    final open = [
      for (final s in _sessions)
        if (s.open) s,
    ];
    final dates = suggestSessionDates(periods: st.slotsFor(_cls, _subject), from: todayIso(), count: open.length);
    if (dates.isEmpty) {
      AppDialogs.showSnackBar(context, message: 'No $_subject periods for $_cls in your timetable.');
      return;
    }
    var i = 0;
    setState(() {
      _sessions = [
        for (final s in _sessions)
          if (s.open && i < dates.length) s.copyWith(date: dates[i].date, slot: dates[i++].slot) else s,
      ];
    });
  }

  void _addOutcome() {
    final t = _outcome.text.trim();
    if (t.isEmpty) return;
    setState(() {
      _outcomes = [..._outcomes, t];
      _outcome.clear();
    });
  }

  void _save({required bool draft}) {
    if (_outcome.text.trim().isNotEmpty) _addOutcome();
    final school = context.read<SchoolBloc>().state;
    if (_cls.isEmpty || _subject.isEmpty) {
      AppDialogs.showSnackBar(context, message: 'Choose the class and subject', isError: true);
      return;
    }
    setState(() {
      _showErrors = true;
      _sessionErr = !draft && _sessions.isEmpty ? 'Add at least one session' : null;
    });
    if (!_form.currentState!.validate() || _sessionErr != null) {
      AppDialogs.showSnackBar(context, message: 'Please fix the highlighted fields', isError: true);
      return;
    }
    final cls = school.classes.where((c) => c.label == _cls).firstOrNull;
    final base = _existing ?? LessonPlan(id: '', cls: _cls, subject: _subject, title: '');
    final plan = base.copyWith(
      cls: _cls,
      classId: cls?.id ?? base.classId,
      subject: _subject,
      title: _title.text.trim(),
      chapter: _chapter.text.trim(),
      summary: _summary.text.trim(),
      outcomes: _outcomes,
      sessions: _sessions,
      attachments: _attachments,
      draft: draft,
      // an edited plan that was approved / sent goes back to "not sent"; one with changes asked keeps the note
      review: base.review.state == ReviewState.changes ? base.review : const LessonReview(),
    );
    context.read<LessonPlansBloc>().add(LessonPlanSaved(plan, files: _files));
  }

  Future<void> _editSession(int i) async {
    final s = _sessions[i];
    final next = await showAppSheet<LessonSession>(
      context,
      title: 'Session ${i + 1}',
      builder: (ctx) => _SessionEditor(session: s),
    );
    if (next != null) setState(() => _sessions[i] = next);
  }

  @override
  Widget build(BuildContext context) {
    final st = context.watch<LessonPlansBloc>().state;
    final school = context.watch<SchoolBloc>().state;
    _load(st);
    final title = _isNew ? 'New Lesson Plan' : 'Edit Lesson Plan';
    if (!_loaded) {
      return DetailScaffold(title: title, fallbackRoute: RoutePaths.lessonPlans, body: const LessonsLoading());
    }
    if (!_isNew && _existing == null) {
      return DetailScaffold(
        title: title,
        fallbackRoute: RoutePaths.lessonPlans,
        body: Center(child: AppEmptyState('Lesson plan not found')),
      );
    }
    List<String> subjectsOf(String label) {
      final mine = teachingSubjects(school.teacher, school.classes, label);
      if (mine.isNotEmpty || AppConfig.isFirebase) return mine;
      final c = school.classes.where((c) => c.label == label).firstOrNull;
      return {...?c?.subjectNames, if (c != null && c.subject.isNotEmpty) c.subject}.toList();
    }

    final classes = [
      for (final c in school.classes)
        if (subjectsOf(c.label).isNotEmpty) c.label,
    ];
    if (_cls.isEmpty && classes.isNotEmpty) _cls = classes.first;
    final subjects = subjectsOf(_cls);
    if (!subjects.contains(_subject)) _subject = subjects.firstOrNull ?? _subject;
    final timetableSlots = st.slotsFor(_cls, _subject);
    final mins = _sessions.fold<int>(0, (a, s) => a + s.mins);

    return DetailScaffold(
      title: title,
      subtitle: _isNew ? 'Plan a chapter as sessions' : _existing!.code,
      fallbackRoute: RoutePaths.lessonPlans,
      bottom: Row(
        children: [
          Expanded(
            child: AppButton(
              'Save Draft',
              kind: BtnKind.outline,
              onPressed: st.uploading ? null : () => _save(draft: true),
            ),
          ),
          SizedBox(width: 10.w),
          Expanded(
            flex: 2,
            child: AppButton(
              st.uploading ? 'Uploading files…' : 'Save Plan',
              icon: Icons.check_rounded,
              busy: st.uploading,
              onPressed: () => _save(draft: false),
            ),
          ),
        ],
      ),
      body: Form(
        key: _form,
        autovalidateMode: _showErrors ? AutovalidateMode.onUserInteraction : AutovalidateMode.disabled,
        child: ListView(
          scrollCacheExtent: kFormScrollCache,
          padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 24.h),
          children: [
            FormStep(
              n: 1,
              title: 'Class & Subject',
              subtitle: timetableSlots.isEmpty
                  ? 'Not in your timetable — sessions need dates'
                  : '${timetableSlots.length} period${timetableSlots.length == 1 ? '' : 's'} a week in your timetable',
              icon: Icons.groups_2_outlined,
              children: [
                if (classes.isEmpty)
                  Text('No classes assigned to you yet.', style: T.small)
                else ...[
                  AppChoiceChips(
                    items: classes,
                    value: _cls,
                    solid: true,
                    dense: true,
                    onChanged: (v) => setState(() => _cls = v.isEmpty ? _cls : v),
                  ),
                  SizedBox(height: 10.h),
                  AppChoiceChips(
                    items: subjects,
                    value: _subject,
                    solid: true,
                    dense: true,
                    onChanged: (v) => setState(() => _subject = v.isEmpty ? _subject : v),
                  ),
                ],
              ],
            ),
            FormStep(
              n: 2,
              title: 'Chapter',
              subtitle: 'What this plan covers',
              icon: Icons.menu_book_outlined,
              children: [
                AppTextField(
                  label: 'Title',
                  controller: _title,
                  hint: 'e.g. Quadratic Equations',
                  validator: (v) => (v ?? '').trim().length < 3 ? 'Enter a title (min 3 characters)' : null,
                ),
                AppTextField(label: 'Chapter / textbook reference', controller: _chapter, hint: 'e.g. NCERT Ch 4'),
                AppTextField(label: 'Summary (optional)', controller: _summary, maxLines: 2, hint: 'One or two lines'),
              ],
            ),
            FormStep(
              n: 3,
              title: 'Learning Outcomes',
              subtitle: _outcomes.isEmpty ? 'What students will be able to do' : '${_outcomes.length} outcomes',
              icon: Icons.flag_outlined,
              children: [
                for (var i = 0; i < _outcomes.length; i++)
                  _ListRow(
                    n: i + 1,
                    text: _outcomes[i],
                    onRemove: () => setState(() => _outcomes = [..._outcomes]..removeAt(i)),
                  ),
                _InlineAdd(controller: _outcome, hint: 'e.g. Solve quadratics by factoring', onAdd: _addOutcome),
              ],
            ),
            FormStep(
              n: 4,
              title: 'Sessions',
              subtitle: _sessions.isEmpty
                  ? 'One per class period'
                  : '${_sessions.length} session${_sessions.length == 1 ? '' : 's'}${mins > 0 ? ' • $mins min planned' : ''}',
              icon: Icons.event_note_outlined,
              children: [
                for (var i = 0; i < _sessions.length; i++)
                  _SessionRow(
                    n: i + 1,
                    session: _sessions[i],
                    onTap: () => _editSession(i),
                    onRemove: _sessions[i].taught
                        ? null
                        : () => setState(() => _sessions = [..._sessions]..removeAt(i)),
                  ),
                if (_sessionErr != null)
                  Padding(
                    padding: EdgeInsets.only(bottom: 8.h),
                    child: Text(_sessionErr!, style: T.small.copyWith(color: C.danger)),
                  ),
                Wrap(
                  spacing: 8.w,
                  runSpacing: 8.h,
                  children: [
                    AppButton(
                      'Add 1',
                      icon: Icons.add_rounded,
                      kind: BtnKind.soft,
                      small: true,
                      expand: false,
                      onPressed: () => _addSessions(st, 1),
                    ),
                    AppButton(
                      'Add 5',
                      icon: Icons.playlist_add_rounded,
                      kind: BtnKind.soft,
                      small: true,
                      expand: false,
                      onPressed: () => _addSessions(st, 5),
                    ),
                    if (_sessions.any((s) => s.open) && timetableSlots.isNotEmpty)
                      AppButton(
                        'Re-date from timetable',
                        icon: Icons.event_repeat_rounded,
                        kind: BtnKind.outline,
                        small: true,
                        expand: false,
                        onPressed: () => _refillDates(st),
                      ),
                  ],
                ),
                SizedBox(height: 8.h),
                const StepHint(
                  icon: Icons.info_outline_rounded,
                  text: 'Tap a session to set its focus, steps and homework',
                ),
              ],
            ),
            FormStep(
              n: 5,
              title: 'Attachments',
              subtitle: 'Worksheets, slides, notes (15 MB each)',
              icon: Icons.attach_file_rounded,
              last: true,
              children: [
                for (var i = 0; i < _attachments.length; i++)
                  Padding(
                    padding: EdgeInsets.only(bottom: 8.h),
                    child: AppFileChip(
                      name: _attachments[i].name,
                      size: _attachments[i].size,
                      sub: 'Uploaded',
                      trailing: IconButton(
                        tooltip: 'Remove file',
                        icon: Icon(Icons.close_rounded, size: 18.r),
                        onPressed: () => setState(() => _attachments = [..._attachments]..removeAt(i)),
                      ),
                    ),
                  ),
                for (var i = 0; i < _files.length; i++)
                  Padding(
                    padding: EdgeInsets.only(bottom: 8.h),
                    child: AppFileChip(
                      name: _files[i].name,
                      size: _files[i].sizeLabel,
                      sub: 'Uploads when you save',
                      icon: _files[i].isImage ? Icons.image_outlined : null,
                      tone: _files[i].isImage ? Tone.purple : Tone.danger,
                      trailing: IconButton(
                        tooltip: 'Remove file',
                        icon: Icon(Icons.close_rounded, size: 18.r),
                        onPressed: () => setState(() => _files = [..._files]..removeAt(i)),
                      ),
                    ),
                  ),
                AppButton(
                  'Attach files',
                  icon: Icons.upload_file_rounded,
                  kind: BtnKind.soft,
                  small: true,
                  expand: false,
                  onPressed: () async {
                    final picked = await pickDocuments();
                    final ok = picked.where((f) => f.bytes <= kMaxAttachmentBytes).toList();
                    if (!context.mounted) return;
                    if (ok.length < picked.length) {
                      AppDialogs.showSnackBar(
                        context,
                        message: '${picked.length - ok.length} file(s) over 15 MB were skipped',
                      );
                    }
                    if (ok.isNotEmpty) setState(() => _files = [..._files, ...ok]);
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// A numbered line (an outcome) with remove.
class _ListRow extends StatelessWidget {
  const _ListRow({required this.n, required this.text, required this.onRemove});
  final int n;
  final String text;
  final VoidCallback onRemove;
  @override
  Widget build(BuildContext context) => Container(
    margin: EdgeInsets.only(bottom: 8.h),
    padding: EdgeInsets.fromLTRB(10.w, 10.h, 2.w, 10.h),
    decoration: BoxDecoration(color: C.primarySoft.withValues(alpha: .45), borderRadius: BorderRadius.circular(R.md)),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 22.r,
          height: 22.r,
          alignment: Alignment.center,
          decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle),
          child: Text(
            '$n',
            style: T.small.copyWith(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11.sp),
          ),
        ),
        SizedBox(width: 10.w),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(top: 1.h),
            child: Text(
              text,
              style: T.body.copyWith(color: C.ink, fontSize: 13.5.sp, height: 1.4),
            ),
          ),
        ),
        InkResponse(
          onTap: onRemove,
          radius: 18.r,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 8.w),
            child: Icon(Icons.close_rounded, size: 18.r, color: C.slate),
          ),
        ),
      ],
    ),
  );
}

/// One plain input with a round add button: type and press it (or Done) to append a line.
class _InlineAdd extends StatelessWidget {
  const _InlineAdd({required this.controller, required this.hint, required this.onAdd});
  final TextEditingController controller;
  final String hint;
  final VoidCallback onAdd;
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<TextEditingValue>(
    valueListenable: controller,
    builder: (_, v, _) {
      final ready = v.text.trim().isNotEmpty;
      return Container(
        padding: EdgeInsets.fromLTRB(12.w, 4.h, 4.w, 4.h),
        decoration: BoxDecoration(
          color: C.bg,
          borderRadius: BorderRadius.circular(R.md),
          border: Border.all(color: ready ? C.primary : C.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                textInputAction: TextInputAction.done,
                textCapitalization: TextCapitalization.sentences,
                onSubmitted: (_) => onAdd(),
                style: T.body.copyWith(color: C.ink, fontSize: 14.sp),
                // the theme draws its own box around fields: this one sits inside ours, so none here
                decoration: InputDecoration(
                  isDense: true,
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(vertical: 10.h),
                  hintText: hint,
                  hintStyle: T.small.copyWith(fontSize: 13.5.sp, color: C.muted),
                ),
              ),
            ),
            SizedBox(width: 6.w),
            Semantics(
              button: true,
              label: 'Add',
              child: InkResponse(
                onTap: ready ? onAdd : null,
                radius: 22.r,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 36.r,
                  height: 36.r,
                  decoration: BoxDecoration(color: ready ? C.primary : C.surface, shape: BoxShape.circle),
                  child: Icon(Icons.add_rounded, size: 20.r, color: ready ? Colors.white : C.muted),
                ),
              ),
            ),
          ],
        ),
      );
    },
  );
}

/// A session in the editor: number, when, focus; tap to edit.
class _SessionRow extends StatelessWidget {
  const _SessionRow({required this.n, required this.session, required this.onTap, this.onRemove});
  final int n;
  final LessonSession session;
  final VoidCallback onTap;
  final VoidCallback? onRemove;
  @override
  Widget build(BuildContext context) {
    final s = session;
    return Padding(
      padding: EdgeInsets.only(bottom: 8.h),
      child: Material(
        color: C.surface,
        borderRadius: BorderRadius.circular(R.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(R.md),
          onTap: onTap,
          child: Container(
            padding: EdgeInsets.fromLTRB(10.w, 8.h, 0, 8.h),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(R.md),
              border: Border.all(color: C.border),
            ),
            child: Row(
              children: [
                SessionDot(s, n),
                SizedBox(width: 10.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        [sessionDay(s.date), if (s.slot.isNotEmpty) slotLabel(s.slot)].join(' • '),
                        style: T.small.copyWith(
                          fontSize: 11.5.sp,
                          fontWeight: FontWeight.w700,
                          color: s.date.isEmpty ? C.danger : C.primary,
                        ),
                      ),
                      Text(
                        s.focus.isEmpty ? 'Tap to add the focus' : s.focus,
                        style: s.focus.isEmpty ? T.small : T.bodyStrong.copyWith(fontSize: 13.5.sp),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (s.activities.isNotEmpty || s.homework.isNotEmpty)
                        Text(
                          [
                            if (s.activities.isNotEmpty) '${s.activities.length} steps • ${s.mins} min',
                            if (s.homework.isNotEmpty) 'Homework',
                          ].join(' • '),
                          style: T.small.copyWith(fontSize: 11.sp),
                        ),
                    ],
                  ),
                ),
                if (onRemove != null)
                  IconButton(
                    tooltip: 'Remove session',
                    icon: Icon(Icons.close_rounded, size: 18.r, color: C.slate),
                    onPressed: onRemove,
                  )
                else
                  Padding(
                    padding: EdgeInsets.only(right: 12.w),
                    child: Icon(Icons.lock_outline_rounded, size: 16.r, color: C.muted),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Bottom sheet that edits one session: focus, date, period, steps (minutes + what) and homework.
class _SessionEditor extends StatefulWidget {
  const _SessionEditor({required this.session});
  final LessonSession session;
  @override
  State<_SessionEditor> createState() => _SessionEditorState();
}

class _SessionEditorState extends State<_SessionEditor> {
  late final _focus = TextEditingController(text: widget.session.focus);
  late final _homework = TextEditingController(text: widget.session.homework);
  final _step = TextEditingController();
  late String _date = widget.session.date, _slot = widget.session.slot;
  late List<SessionActivity> _steps = [...widget.session.activities];
  int _stepMins = 10;

  static List<String> get _slots => [
    for (final s in bell.kSlots)
      if (!s.isBreak) s.id,
  ];

  @override
  void dispose() {
    for (final c in [_focus, _homework, _step]) {
      c.dispose();
    }
    super.dispose();
  }

  void _addStep() {
    final t = _step.text.trim();
    if (t.isEmpty) return;
    setState(() {
      _steps = [..._steps, SessionActivity(title: t, mins: _stepMins)];
      _step.clear();
    });
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      AppTextField(label: 'Focus', controller: _focus, hint: 'e.g. The quadratic formula'),
      Row(
        children: [
          Expanded(
            child: AppPickTile(
              icon: Icons.event_outlined,
              label: _date.isEmpty ? 'Pick a date' : sessionDay(_date),
              caption: 'Date',
              onTap: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: DateTime.tryParse(_date) ?? DateTime.now(),
                  firstDate: DateTime.now().subtract(const Duration(days: 365)),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (d != null) setState(() => _date = isoOf(d));
              },
            ),
          ),
          SizedBox(width: 10.w),
          Expanded(
            child: AppDropdown<String>(
              label: 'Period',
              value: _slots.contains(_slot) ? _slot : (_slots.firstOrNull ?? ''),
              items: _slots,
              labelOf: (v) => slotLabel(v),
              onChanged: (v) => setState(() => _slot = v),
            ),
          ),
        ],
      ),
      SizedBox(height: 12.h),
      const FieldLabel('Steps'),
      for (var i = 0; i < _steps.length; i++)
        Container(
          margin: EdgeInsets.only(bottom: 6.h),
          padding: EdgeInsets.fromLTRB(10.w, 2.h, 0, 2.h),
          decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
          child: Row(
            children: [
              Text('${_steps[i].mins}′', style: T.smallStrong.copyWith(color: C.primary)),
              SizedBox(width: 10.w),
              Expanded(
                child: Text(
                  _steps[i].title,
                  style: T.body.copyWith(color: C.ink, fontSize: 13.5.sp),
                ),
              ),
              IconButton(
                tooltip: 'Remove step',
                icon: Icon(Icons.close_rounded, size: 18.r, color: C.slate),
                onPressed: () => setState(() => _steps = [..._steps]..removeAt(i)),
              ),
            ],
          ),
        ),
      Row(
        children: [
          AppDropdown<int>(
            label: '',
            value: _stepMins,
            items: const [5, 10, 15, 20, 25, 30, 40],
            labelOf: (v) => '$v min',
            onChanged: (v) => setState(() => _stepMins = v),
          ).wrapWidth(96.w),
          SizedBox(width: 8.w),
          Expanded(
            child: _InlineAdd(controller: _step, hint: 'e.g. Worked examples', onAdd: _addStep),
          ),
        ],
      ),
      SizedBox(height: 12.h),
      AppTextField(label: 'Homework (optional)', controller: _homework, hint: 'e.g. Ex 4.3 Q1–5'),
      SizedBox(height: 4.h),
      AppButton(
        'Done',
        icon: Icons.check_rounded,
        onPressed: () => Navigator.pop(
          context,
          widget.session.copyWith(
            focus: _focus.text.trim(),
            date: _date,
            slot: _slots.contains(_slot) ? _slot : (_slots.firstOrNull ?? ''),
            activities: [
              ..._steps,
              if (_step.text.trim().isNotEmpty) SessionActivity(title: _step.text.trim(), mins: _stepMins),
            ],
            homework: _homework.text.trim(),
          ),
        ),
      ),
    ],
  );
}

extension on Widget {
  Widget wrapWidth(double w) => SizedBox(width: w, child: this);
}
