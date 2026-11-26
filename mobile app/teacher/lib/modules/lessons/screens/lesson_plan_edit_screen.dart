import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/app_config.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../engage/models/attachment_models.dart';
import '../../engage/screens/widgets/attachment_sheet.dart';
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
  final _outcomeFocus = FocusNode();
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
    _outcomeFocus.dispose();
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
    final dates = suggestSessionDates(
      periods: st.slotsFor(_cls, _subject),
      from: from,
      count: n,
      taken: taken,
      skip: periodPassed,
    );
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
    final dates = suggestSessionDates(
      periods: st.slotsFor(_cls, _subject),
      from: todayIso(),
      count: open.length,
      skip: periodPassed,
    );
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
    _outcomeFocus.requestFocus(); // ready for the next one
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
    // drop focus first, or the outcome field takes it back (and opens the keyboard) when the sheet closes
    FocusScope.of(context).unfocus();
    final s = _sessions[i];
    final next = await showAppSheet<LessonSession>(
      context,
      title: 'Session ${i + 1}',
      subtitle: [if (s.date.isNotEmpty) sessionDay(s.date), if (s.slot.isNotEmpty) slotLabel(s.slot)].join(' · '),
      builder: (ctx) => _SessionEditor(session: s),
    );
    if (next != null) setState(() => _sessions[i] = next);
  }

  Future<void> _pick(String title, List<String> items, String value, ValueChanged<String> onPick) async {
    final v = await showAppSheet<String>(
      context,
      title: title,
      builder: (ctx) => Column(
        children: [
          for (final it in items)
            ListTile(
              contentPadding: EdgeInsets.symmetric(horizontal: 4.w),
              minTileHeight: 46.h,
              title: Text(
                it,
                style: T.body.copyWith(color: C.ink, fontWeight: it == value ? FontWeight.w700 : FontWeight.w500),
              ),
              trailing: it == value ? Icon(Icons.check_rounded, color: C.primary, size: 20.r) : null,
              onTap: () => Navigator.pop(ctx, it),
            ),
        ],
      ),
    );
    if (v != null) setState(() => onPick(v));
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
    final slots = st.slotsFor(_cls, _subject);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final periods = ([...slots]..sort((a, b) => a.day != b.day ? a.day.compareTo(b.day) : a.slot.compareTo(b.slot)))
        .map((s) => '${days[(s.day - 1).clamp(0, 6)]} ${s.slot}')
        .join(' · ');
    final mins = _sessions.fold<int>(0, (a, s) => a + s.mins);

    return DetailScaffold(
      title: title,
      subtitle: _isNew ? null : _existing!.code,
      fallbackRoute: RoutePaths.lessonPlans,
      bottom: Row(
        children: [
          Expanded(
            child: AppButton(
              'Save draft',
              kind: BtnKind.outline,
              onPressed: st.uploading ? null : () => _save(draft: true),
            ),
          ),
          SizedBox(width: 10.w),
          Expanded(
            flex: 2,
            child: AppButton(
              st.uploading ? 'Uploading…' : 'Save plan',
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
          padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 24.h),
          children: [
            // ---- class & subject
            Row(
              children: [
                Expanded(
                  child: _Picker(
                    label: 'Class',
                    value: _cls.isEmpty ? 'Choose' : _cls,
                    onTap: classes.isEmpty ? null : () => _pick('Class', classes, _cls, (v) => _cls = v),
                  ),
                ),
                SizedBox(width: 10.w),
                Expanded(
                  child: _Picker(
                    label: 'Subject',
                    value: _subject.isEmpty ? 'Choose' : _subject,
                    onTap: subjects.isEmpty ? null : () => _pick('Subject', subjects, _subject, (v) => _subject = v),
                  ),
                ),
              ],
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(4.w, 8.h, 4.w, 0),
              child: Row(
                children: [
                  Icon(
                    slots.isEmpty ? Icons.event_busy_outlined : Icons.schedule_rounded,
                    size: 14.r,
                    color: slots.isEmpty ? C.warningDark : C.slate,
                  ),
                  SizedBox(width: 6.w),
                  Expanded(
                    child: Text(
                      classes.isEmpty
                          ? 'No classes assigned to you yet'
                          : slots.isEmpty
                          ? 'Not in your timetable — you will pick session dates'
                          : 'Your periods: $periods',
                      style: T.small.copyWith(fontSize: 12.sp, color: slots.isEmpty ? C.warningDark : C.slate),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),

            // ---- chapter
            const _Head('Chapter'),
            _Box(
              child: Column(
                children: [
                  _Field(
                    controller: _title,
                    hint: 'Chapter title, e.g. Quadratic Equations',
                    strong: true,
                    validator: (v) => (v ?? '').trim().length < 3 ? 'Enter a title (min 3 characters)' : null,
                  ),
                  Divider(height: 1, color: C.border),
                  _Field(
                    controller: _chapter,
                    hint: 'Textbook reference, e.g. NCERT Ch 4',
                    icon: Icons.menu_book_outlined,
                  ),
                  Divider(height: 1, color: C.border),
                  _Field(
                    controller: _summary,
                    hint: 'Short summary (optional)',
                    icon: Icons.notes_rounded,
                    maxLines: 3,
                  ),
                ],
              ),
            ),

            // ---- outcomes
            _Head('Learning outcomes', trailing: _outcomes.isEmpty ? null : '${_outcomes.length}'),
            for (var i = 0; i < _outcomes.length; i++)
              _ListRow(
                n: i + 1,
                text: _outcomes[i],
                onRemove: () => setState(() => _outcomes = [..._outcomes]..removeAt(i)),
              ),
            _InlineAdd(
              key: const ValueKey('outcome-input'),
              controller: _outcome,
              focusNode: _outcomeFocus,
              hint: 'Students will be able to…',
              onAdd: _addOutcome,
            ),

            // ---- sessions
            _Head(
              'Sessions',
              trailing: _sessions.isEmpty ? null : '${_sessions.length}${mins > 0 ? ' · $mins min' : ''}',
            ),
            if (_sessions.isEmpty)
              Padding(
                padding: EdgeInsets.only(bottom: 10.h),
                child: Text(
                  'One session = one class period of this chapter. Add as many as you need; each takes your next period. Tap one to plan it.',
                  style: T.small.copyWith(fontSize: 12.5.sp, height: 1.45),
                ),
              )
            else
              _Box(
                child: Column(
                  children: [
                    for (var i = 0; i < _sessions.length; i++) ...[
                      if (i > 0) Divider(height: 1, indent: 58.w, color: C.border),
                      _SessionRow(
                        n: i + 1,
                        session: _sessions[i],
                        onTap: () => _editSession(i),
                        onRemove: _sessions[i].taught
                            ? null
                            : () => setState(() => _sessions = [..._sessions]..removeAt(i)),
                      ),
                    ],
                  ],
                ),
              ),
            if (_sessionErr != null)
              Padding(
                padding: EdgeInsets.only(top: 6.h),
                child: Text(_sessionErr!, style: T.small.copyWith(color: C.danger)),
              ),
            SizedBox(height: 8.h),
            Wrap(
              spacing: 6.w,
              runSpacing: 6.h,
              children: [
                _SmallAction(icon: Icons.add_rounded, label: 'Add a session', onTap: () => _addSessions(st, 1)),
                _SmallAction(icon: Icons.playlist_add_rounded, label: 'Add 5', onTap: () => _addSessions(st, 5)),
                if (_sessions.any((s) => s.open) && slots.isNotEmpty)
                  _SmallAction(icon: Icons.event_repeat_rounded, label: 'Re-date', onTap: () => _refillDates(st)),
              ],
            ),

            // ---- files
            _Head(
              'Files',
              trailing: _attachments.length + _files.length == 0 ? null : '${_attachments.length + _files.length}',
            ),
            for (var i = 0; i < _attachments.length; i++)
              _FileRow(
                name: _attachments[i].name,
                sub: _attachments[i].size,
                onRemove: () => setState(() => _attachments = [..._attachments]..removeAt(i)),
              ),
            for (var i = 0; i < _files.length; i++)
              _FileRow(
                name: _files[i].name,
                sub: '${_files[i].sizeLabel} · uploads on save',
                onRemove: () => setState(() => _files = [..._files]..removeAt(i)),
              ),
            Align(
              alignment: Alignment.centerLeft,
              child: _SmallAction(
                icon: Icons.attach_file_rounded,
                label: 'Attach files',
                onTap: () async {
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
            ),
          ],
        ),
      ),
    );
  }
}

/// Small grey section heading with an optional count.
class _Head extends StatelessWidget {
  const _Head(this.text, {this.trailing});
  final String text;
  final String? trailing;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(4.w, 20.h, 4.w, 8.h),
    child: Row(
      children: [
        Text(text.toUpperCase(), style: T.capsMuted.copyWith(fontSize: 11.sp, letterSpacing: .6)),
        const Spacer(),
        if (trailing != null) Text(trailing!, style: T.small.copyWith(fontSize: 11.5.sp)),
      ],
    ),
  );
}

/// White rounded container for a group of rows.
class _Box extends StatelessWidget {
  const _Box({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: C.bg,
      borderRadius: BorderRadius.circular(R.lg),
      border: Border.all(color: C.border),
    ),
    clipBehavior: Clip.antiAlias,
    child: child,
  );
}

/// Compact picker: small label over the value, opens a list.
class _Picker extends StatelessWidget {
  const _Picker({required this.label, required this.value, this.onTap});
  final String label, value;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: C.bg,
    borderRadius: BorderRadius.circular(R.lg),
    child: InkWell(
      borderRadius: BorderRadius.circular(R.lg),
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.fromLTRB(12.w, 8.h, 8.w, 8.h),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(R.lg),
          border: Border.all(color: C.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: T.small.copyWith(fontSize: 11.sp)),
                  Text(
                    value,
                    style: T.bodyStrong.copyWith(fontSize: 14.sp),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Icon(Icons.expand_more_rounded, size: 20.r, color: C.slate),
          ],
        ),
      ),
    ),
  );
}

/// A borderless text field for use inside a [_Box] (the theme's own box is switched off).
class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.hint,
    this.icon,
    this.strong = false,
    this.maxLines = 1,
    this.validator,
  });
  final TextEditingController controller;
  final String hint;
  final IconData? icon;
  final bool strong;
  final int maxLines;
  final String? Function(String?)? validator;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(horizontal: 12.w),
    child: TextFormField(
      controller: controller,
      validator: validator,
      minLines: 1,
      maxLines: maxLines,
      textCapitalization: TextCapitalization.sentences,
      style: strong ? T.bodyStrong.copyWith(fontSize: 15.sp) : T.body.copyWith(color: C.ink, fontSize: 13.5.sp),
      decoration: InputDecoration(
        isDense: true,
        filled: false,
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        errorBorder: InputBorder.none,
        focusedErrorBorder: InputBorder.none,
        contentPadding: EdgeInsets.symmetric(vertical: 13.h),
        prefixIcon: icon == null ? null : Icon(icon, size: 17.r, color: C.slate),
        prefixIconConstraints: BoxConstraints(minWidth: 28.w),
        hintText: hint,
        hintStyle: (strong ? T.bodyStrong.copyWith(fontSize: 15.sp) : T.body.copyWith(fontSize: 13.5.sp)).copyWith(
          color: C.muted,
        ),
      ),
    ),
  );
}

/// Small tinted action ("+ Add a session").
class _SmallAction extends StatelessWidget {
  const _SmallAction({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: C.primarySoft,
    borderRadius: BorderRadius.circular(R.pill),
    child: InkWell(
      borderRadius: BorderRadius.circular(R.pill),
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16.r, color: C.primary),
            SizedBox(width: 6.w),
            Flexible(
              child: Text(
                label,
                style: T.smallStrong.copyWith(fontSize: 12.5.sp, color: C.primary),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _FileRow extends StatelessWidget {
  const _FileRow({required this.name, required this.sub, required this.onRemove});
  final String name, sub;
  final VoidCallback onRemove;
  @override
  Widget build(BuildContext context) => Container(
    margin: EdgeInsets.only(bottom: 8.h),
    padding: EdgeInsets.fromLTRB(12.w, 8.h, 2.w, 8.h),
    decoration: BoxDecoration(
      color: C.bg,
      borderRadius: BorderRadius.circular(R.md),
      border: Border.all(color: C.border),
    ),
    child: Row(
      children: [
        Icon(Icons.description_outlined, size: 18.r, color: C.danger),
        SizedBox(width: 10.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: T.bodyStrong.copyWith(fontSize: 13.sp),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (sub.isNotEmpty) Text(sub, style: T.small.copyWith(fontSize: 11.sp)),
            ],
          ),
        ),
        IconButton(
          tooltip: 'Remove file',
          icon: Icon(Icons.close_rounded, size: 18.r, color: C.slate),
          onPressed: onRemove,
        ),
      ],
    ),
  );
}

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
  const _InlineAdd({super.key, required this.controller, required this.hint, required this.onAdd, this.focusNode});
  final TextEditingController controller;
  final String hint;
  final VoidCallback onAdd;
  final FocusNode? focusNode;
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
                focusNode: focusNode,
                textInputAction: TextInputAction.done,
                textCapitalization: TextCapitalization.sentences,
                // handling "done" here keeps the field focused (the default would close the keyboard): type, Done, type…
                onEditingComplete: onAdd,
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

/// A session in the editor: date chip, "Session n · Period", focus; tap to plan it.
class _SessionRow extends StatelessWidget {
  const _SessionRow({required this.n, required this.session, required this.onTap, this.onRemove});
  final int n;
  final LessonSession session;
  final VoidCallback onTap;
  final VoidCallback? onRemove;
  static const _wd = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  @override
  Widget build(BuildContext context) {
    final s = session;
    final d = DateTime.tryParse(s.date);
    final undated = d == null;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.fromLTRB(10.w, 9.h, 0, 9.h),
        child: Row(
          children: [
            Container(
              width: 38.w,
              padding: EdgeInsets.symmetric(vertical: 4.h),
              decoration: BoxDecoration(
                color: s.taught ? C.successSoft : (undated ? C.dangerSoft : C.primarySoft),
                borderRadius: BorderRadius.circular(R.sm),
              ),
              child: Column(
                children: [
                  Text(
                    undated ? 'NO' : _wd[d.weekday - 1],
                    style: T.small.copyWith(
                      fontSize: 9.sp,
                      fontWeight: FontWeight.w800,
                      color: undated ? C.danger : C.slate,
                    ),
                  ),
                  Text(
                    undated ? 'DATE' : '${d.day}',
                    style: undated
                        ? T.small.copyWith(fontSize: 9.sp, fontWeight: FontWeight.w800, color: C.danger)
                        : T.bodyStrong.copyWith(
                            fontSize: 15.sp,
                            height: 1.1,
                            color: s.taught ? C.successDark : C.primary,
                          ),
                  ),
                ],
              ),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ['Session $n', if (s.slot.isNotEmpty) slotLabel(s.slot), if (s.taught) 'Taught'].join(' · '),
                    style: T.small.copyWith(fontSize: 11.sp),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    s.focus.isEmpty ? 'Tap to plan this session' : s.focus,
                    style: s.focus.isEmpty
                        ? T.small.copyWith(fontSize: 13.sp, color: C.primary, fontWeight: FontWeight.w600)
                        : T.bodyStrong.copyWith(fontSize: 13.5.sp),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (s.activities.isNotEmpty || s.homework.isNotEmpty)
                    Text(
                      [
                        if (s.activities.isNotEmpty) '${s.activities.length} steps · ${s.mins} min',
                        if (s.homework.isNotEmpty) 'Homework',
                      ].join(' · '),
                      style: T.small.copyWith(fontSize: 11.sp),
                    ),
                ],
              ),
            ),
            if (onRemove != null)
              IconButton(
                tooltip: 'Remove session',
                icon: Icon(Icons.close_rounded, size: 17.r, color: C.muted),
                onPressed: onRemove,
              )
            else
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 14.w),
                child: Icon(Icons.lock_outline_rounded, size: 15.r, color: C.muted),
              ),
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet that plans one session: what (focus), when (date + period), the steps with minutes, and homework.
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
  final _stepFocus = FocusNode();
  late String _date = widget.session.date;
  late String _slot = _slots.contains(widget.session.slot) ? widget.session.slot : (_slots.firstOrNull ?? '');
  late List<SessionActivity> _steps = [...widget.session.activities];
  int _stepMins = 10;
  static const _minutes = [5, 10, 15, 20, 25, 30, 40];

  static List<String> get _slots => [
    for (final s in bell.kSlots)
      if (!s.isBreak) s.id,
  ];

  @override
  void dispose() {
    for (final c in [_focus, _homework, _step]) {
      c.dispose();
    }
    _stepFocus.dispose();
    super.dispose();
  }

  void _addStep() {
    final t = _step.text.trim();
    if (t.isEmpty) return;
    setState(() {
      _steps = [..._steps, SessionActivity(title: t, mins: _stepMins)];
      _step.clear();
    });
    _stepFocus.requestFocus();
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_date) ?? DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (d != null) setState(() => _date = isoOf(d));
  }

  Future<void> _pickPeriod() async {
    final v = await showAppSheet<String>(
      context,
      title: 'Period',
      builder: (ctx) => Column(
        children: [
          for (final p in _slots)
            ListTile(
              contentPadding: EdgeInsets.symmetric(horizontal: 4.w),
              minTileHeight: 44.h,
              title: Text(
                slotLabel(p),
                style: T.body.copyWith(color: C.ink, fontWeight: p == _slot ? FontWeight.w700 : FontWeight.w500),
              ),
              trailing: p == _slot ? Icon(Icons.check_rounded, color: C.primary, size: 20.r) : null,
              onTap: () => Navigator.pop(ctx, p),
            ),
        ],
      ),
    );
    if (v != null) setState(() => _slot = v);
  }

  @override
  Widget build(BuildContext context) {
    final total = _steps.fold<int>(0, (a, e) => a + e.mins);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // what
        _Box(
          child: _Field(
            controller: _focus,
            hint: 'What will you teach? e.g. Personal pronouns',
            strong: true,
            maxLines: 2,
          ),
        ),
        SizedBox(height: 10.h),
        // when
        Row(
          children: [
            Expanded(
              child: _Picker(label: 'Date', value: _date.isEmpty ? 'Pick a date' : sessionDay(_date), onTap: _pickDate),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: _Picker(
                label: 'Period',
                value: _slot.isEmpty ? 'Pick' : slotLabel(_slot),
                onTap: _slots.isEmpty ? null : _pickPeriod,
              ),
            ),
          ],
        ),
        // steps
        Padding(
          padding: EdgeInsets.fromLTRB(4.w, 18.h, 4.w, 8.h),
          child: Row(
            children: [
              Text('STEPS', style: T.capsMuted.copyWith(fontSize: 11.sp, letterSpacing: .6)),
              const Spacer(),
              if (total > 0) Text('$total min', style: T.small.copyWith(fontSize: 11.5.sp)),
            ],
          ),
        ),
        if (_steps.isNotEmpty)
          Padding(
            padding: EdgeInsets.only(bottom: 8.h),
            child: _Box(
              child: Column(
                children: [
                  for (var i = 0; i < _steps.length; i++) ...[
                    if (i > 0) Divider(height: 1, color: C.border),
                    Padding(
                      padding: EdgeInsets.fromLTRB(12.w, 2.h, 0, 2.h),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 44.w,
                            child: Text(
                              '${_steps[i].mins} min',
                              style: T.smallStrong.copyWith(fontSize: 12.sp, color: C.primary),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              _steps[i].title,
                              style: T.body.copyWith(color: C.ink, fontSize: 13.5.sp),
                            ),
                          ),
                          IconButton(
                            tooltip: 'Remove step',
                            icon: Icon(Icons.close_rounded, size: 17.r, color: C.muted),
                            onPressed: () => setState(() => _steps = [..._steps]..removeAt(i)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        Row(
          key: const ValueKey('step-add-row'),
          children: [
            PopupMenuButton<int>(
              tooltip: 'Minutes',
              initialValue: _stepMins,
              onSelected: (v) => setState(() => _stepMins = v),
              itemBuilder: (_) => [for (final m in _minutes) PopupMenuItem(value: m, child: Text('$m min'))],
              child: Container(
                height: 46.h,
                padding: EdgeInsets.symmetric(horizontal: 10.w),
                decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.md)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$_stepMins min',
                      style: T.smallStrong.copyWith(fontSize: 12.5.sp, color: C.primary),
                    ),
                    Icon(Icons.arrow_drop_down_rounded, size: 20.r, color: C.primary),
                  ],
                ),
              ),
            ),
            SizedBox(width: 8.w),
            Expanded(
              child: _InlineAdd(
                key: const ValueKey('step-input'),
                controller: _step,
                focusNode: _stepFocus,
                hint: 'Step, e.g. Warm-up quiz',
                onAdd: _addStep,
              ),
            ),
          ],
        ),
        // homework
        Padding(
          padding: EdgeInsets.fromLTRB(4.w, 18.h, 4.w, 8.h),
          child: Text('HOMEWORK', style: T.capsMuted.copyWith(fontSize: 11.sp, letterSpacing: .6)),
        ),
        _Box(
          child: _Field(
            controller: _homework,
            hint: 'Optional, e.g. Workbook p. 12',
            icon: Icons.home_work_outlined,
            maxLines: 2,
          ),
        ),
        SizedBox(height: 16.h),
        AppButton(
          'Save session',
          icon: Icons.check_rounded,
          onPressed: () => Navigator.pop(
            context,
            widget.session.copyWith(
              focus: _focus.text.trim(),
              date: _date,
              slot: _slot,
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
}
