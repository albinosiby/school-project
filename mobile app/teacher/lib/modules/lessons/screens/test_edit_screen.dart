import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/online_tests_bloc.dart';
import '../bloc/online_tests_events.dart';
import '../bloc/online_tests_states.dart';
import '../models/online_test_models.dart';
import 'widgets/lessons_common.dart';

const _types = ['Unit Test', 'Quiz', 'Mid-Term', 'Diagnostic'];
const _sections = ['A', 'B', 'C'];
const _sectionNames = {'A': 'MCQ', 'B': 'Short', 'C': 'Cases'};
int _qSeq = 0;
String _qid() => 'q_${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}${_qSeq++}';

/// Figma 1153:3871 "5.2.1 Create Test" (id `new`) and 1153:4157 "5.2.2 Edit Test".
class TestEditScreen extends StatelessWidget {
  const TestEditScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<OnlineTestsBloc>()..add(const OnlineTestsLoadRequested()),
        child: BlocListener<OnlineTestsBloc, OnlineTestsState>(
          listenWhen: (a, b) => a.notice != b.notice && b.notice != null,
          listener: (context, s) => handleNotice(context, s.notice!),
          child: _TestEditView(id: id),
        ),
      );
}

class _TestEditView extends StatefulWidget {
  const _TestEditView({required this.id});
  final String id;
  @override
  State<_TestEditView> createState() => _TestEditViewState();
}

class _TestEditViewState extends State<_TestEditView> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController(), _duration = TextEditingController(text: '45'), _cutoff = TextEditingController(text: '18');
  String _cls = '10-B', _subject = 'Mathematics', _type = 'Unit Test', _section = 'A';
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _time = const TimeOfDay(hour: 9, minute: 30);
  bool _proctor = true, _grace = true, _notify = true, _loaded = false, _errors = false;
  List<TestQuestion> _qs = [];
  OnlineTest? _existing;

  bool get _isNew => widget.id == 'new';
  int get _total => _qs.fold(0, (a, q) => a + q.marks);
  int _secMarks(String sec) => _qs.where((q) => q.section == sec).fold(0, (a, q) => a + q.marks);
  int get _durationMins => int.tryParse(_duration.text.trim()) ?? 0;

  @override
  void initState() {
    super.initState();
    _duration.addListener(_refresh);
    _cutoff.addListener(_refresh);
  }

  void _refresh() => setState(() {});

  @override
  void dispose() {
    _title.dispose();
    _duration.dispose();
    _cutoff.dispose();
    super.dispose();
  }

  void _load(OnlineTestsState st) {
    if (_loaded || st.status != OnlineTestsStatus.loaded) return;
    _loaded = true;
    final t = _isNew ? null : st.byId(widget.id);
    _existing = t;
    if (t == null) return;
    _title.text = t.title;
    _duration.text = '${t.duration}';
    _cls = t.cls;
    _subject = t.subject;
    _type = _types.contains(t.type) ? t.type : 'Unit Test';
    _date = DateTime.tryParse(t.date) ?? _date;
    _time = parseTime(t.time);
    _proctor = t.proctor;
    _grace = t.grace;
    _notify = t.notify;
    _qs = [...t.questions];
    _cutoff.text = '${t.cutoff * (t.totalMarks == 0 ? 50 : t.totalMarks) ~/ 100}';
  }

  void _save({required bool publish}) {
    setState(() => _errors = true);
    if (!_form.currentState!.validate()) {
      AppDialogs.showSnackBar(context, message: 'Please fix the highlighted fields', isError: true);
      return;
    }
    if (publish && _qs.isEmpty) {
      AppDialogs.showSnackBar(context, message: 'Add at least one question before publishing', isError: true);
      return;
    }
    final total = _total == 0 ? 1 : _total;
    final school = context.read<SchoolBloc>().state;
    final students = school.classes.where((c) => c.label == _cls).map((c) => c.students).firstOrNull ?? 40;
    final base = _existing ?? OnlineTest(id: '', title: '', cls: _cls, subject: _subject, students: students);
    final test = base.copyWith(
      title: _title.text.trim(), cls: _cls, subject: _subject, type: _type, duration: int.parse(_duration.text.trim()),
      cutoff: (int.parse(_cutoff.text.trim()) * 100 / total).round(), date: isoOf(_date), time: hhmm(_time),
      proctor: _proctor, grace: _grace, notify: _notify, questions: _qs, nq: _qs.length,
    );
    context.read<OnlineTestsBloc>().add(OnlineTestSaved(test, publish: publish));
  }

  Future<void> _addQuestion(String type) async {
    final r = await _questionSheet(context, type, _section);
    if (r != null) setState(() => _qs.add(r));
  }

  void _addFromBank() {
    setState(() => _qs.add(TestQuestion(id: _qid(), section: _section, prompt: 'Bank question: Evaluate tan 45° + sin 90°', options: const ['1', '2', '0', '1/2'], correct: 1)));
    AppDialogs.showSnackBar(context, message: 'Added 1 question from the bank');
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2024), lastDate: DateTime(2030));
    if (d != null) setState(() => _date = d);
  }

  Future<void> _pickTime() async {
    final t = await showTimePicker(context: context, initialTime: _time);
    if (t != null) setState(() => _time = t);
  }

  @override
  Widget build(BuildContext context) {
    final st = context.watch<OnlineTestsBloc>().state;
    final classes = context.select<SchoolBloc, List<String>>((b) => [for (final c in b.state.classes) c.label]);
    _load(st);
    final title = _isNew ? 'Create Test' : 'Edit Test';
    if (!_loaded) return DetailScaffold(title: title, fallbackRoute: RoutePaths.tests, body: const LessonsLoading());
    if (!_isNew && _existing == null) return DetailScaffold(title: title, fallbackRoute: RoutePaths.tests, body: Center(child: AppEmptyState('Test not found')));
    final classOpts = {...classes, _cls}.toList();
    final subjects = {'Mathematics', 'Physics', 'Science', 'Foundation Math', _subject}.toList();
    final secQs = [for (var i = 0; i < _qs.length; i++) if (_qs[i].section == _section) i];
    final cutoffPct = _total == 0 ? 0 : ((int.tryParse(_cutoff.text) ?? 0) * 100 / _total).round();
    final end = addMins(hhmm(_time), _durationMins);

    return DetailScaffold(
      title: title,
      subtitle: _isNew ? 'Term 2 • 2024–25' : _existing!.code,
      fallbackRoute: RoutePaths.tests,
      bottom: Row(children: [
        Expanded(
          child: AppButton(_isNew ? 'Save Draft' : 'Cancel', kind: BtnKind.outline, onPressed: () {
            if (_isNew) {
              _save(publish: false);
            } else {
              context.pop();
            }
          }),
        ),
        SizedBox(width: 10.w),
        Expanded(flex: 2, child: AppButton(_isNew ? 'Finish' : 'Save Changes', icon: Icons.check_rounded, onPressed: () => _save(publish: true))),
      ]),
      body: Form(
        key: _form,
        autovalidateMode: _errors ? AutovalidateMode.onUserInteraction : AutovalidateMode.disabled,
        child: ListView(padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 24.h), children: [
          AppTextField(label: 'Assessment title', controller: _title, hint: 'e.g. Unit Test 4: Trigonometric Ratios',
              validator: (v) => (v ?? '').trim().length < 3 ? 'Enter a title (min 3 characters)' : null),
          Row(children: [
            Expanded(child: AppDropdown<String>(label: 'Assessment Type', value: _type, items: _types, onChanged: (v) => setState(() => _type = v))),
            SizedBox(width: 12.w),
            Expanded(child: AppDropdown<String>(label: 'Batch / Class', value: _cls, items: classOpts, onChanged: (v) => setState(() => _cls = v), labelOf: (v) => 'Class $v')),
          ]),
          AppDropdown<String>(label: 'Subject', value: _subject, items: subjects, onChanged: (v) => setState(() => _subject = v)),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: AppTextField(label: 'Duration (mins)', controller: _duration, keyboard: TextInputType.number, validator: (v) {
                final n = int.tryParse((v ?? '').trim());
                return n == null || n < 5 || n > 300 ? '5–300 mins' : null;
              }),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: AppTextField(label: 'Pass cutoff (marks)', controller: _cutoff, keyboard: TextInputType.number, validator: (v) {
                final n = int.tryParse((v ?? '').trim());
                return n == null || n < 0 || (_total > 0 && n > _total) ? 'Max $_total' : null;
              }),
            ),
          ]),
          Row(children: [
            Expanded(child: _StatBox(icon: Icons.emoji_events_outlined, label: 'TOTAL MARKS', value: '$_total', sub: '${_qs.length} Questions')),
            SizedBox(width: 8.w),
            Expanded(child: _StatBox(icon: Icons.schedule_rounded, label: 'DURATION', value: '${_duration.text}m', sub: 'Timed Session')),
            SizedBox(width: 8.w),
            Expanded(child: _StatBox(icon: Icons.verified_outlined, label: 'CUTOFF', value: _cutoff.text, sub: '$cutoffPct% Min Pass', good: true)),
          ]),
          SizedBox(height: 12.h),
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(Icons.pie_chart_outline_rounded, size: 20.r, color: C.primary),
                SizedBox(width: 8.w),
                Expanded(child: Text('Section Breakdown', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
                Text('3 Sections • ${_total}m', style: T.smallStrong.copyWith(color: C.primary)),
              ]),
              SizedBox(height: 10.h),
              ClipRRect(
                borderRadius: BorderRadius.circular(R.pill),
                child: SizedBox(
                  height: 8.h,
                  child: Row(children: [
                    for (final (i, sec) in _sections.indexed)
                      if (_total == 0 || _secMarks(sec) > 0)
                        Expanded(
                        flex: _total == 0 ? 1 : _secMarks(sec),
                        child: Container(color: [C.primary, C.primary.withValues(alpha: .7), C.primary.withValues(alpha: .35)][i]),
                      ),
                  ]),
                ),
              ),
              SizedBox(height: 10.h),
              Row(children: [
                for (final sec in _sections)
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(right: sec == 'C' ? 0 : 8.w),
                      child: AppCard(
                        radius: R.md, padding: EdgeInsets.all(10.r), onTap: () => setState(() => _section = sec),
                        color: _section == sec ? C.primarySoft : C.surface, border: _section == sec ? C.primary : C.border,
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Sec $sec: ${_sectionNames[sec]}', style: T.smallStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                          Text('${_secMarks(sec)} Marks (${_total == 0 ? 0 : (_secMarks(sec) * 100 / _total).round()}%)',
                              style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                        ]),
                      ),
                    ),
                  ),
              ]),
            ]),
          ),
          LessonHeading('Add Questions', icon: Icons.add_circle_outline_rounded, trailing: 'Auto-calculates total marks'),
          Row(children: [
            Expanded(child: _TypeTile(Icons.radio_button_checked_rounded, 'Multiple Choice', () => _addQuestion('MCQ'), selected: true)),
            SizedBox(width: 10.w),
            Expanded(child: _TypeTile(Icons.short_text_rounded, 'Short Answer', () => _addQuestion('Short Answer'))),
          ]),
          SizedBox(height: 10.h),
          Row(children: [
            Expanded(child: _TypeTile(Icons.toggle_on_outlined, 'True / False', () => _addQuestion('True / False'))),
            SizedBox(width: 10.w),
            Expanded(child: _TypeTile(Icons.cloud_download_outlined, 'From Question Bank', _addFromBank)),
          ]),
          SizedBox(height: 14.h),
          FilterChips(
            items: [for (final s in _sections) 'Section $s: ${_sectionNames[s]} (${_secMarks(s)}m)'],
            value: 'Section $_section: ${_sectionNames[_section]} (${_secMarks(_section)}m)',
            onChanged: (v) => setState(() => _section = v.substring(8, 9)),
          ),
          LessonHeading('Questions in Section $_section (${secQs.length} added)', trailing: '${_secMarks(_section)} marks'),
          if (secQs.isEmpty) AppCard(child: Center(child: Text('No questions in this section yet', style: T.body))),
          for (final i in secQs) _QuestionCard(
            index: i, q: _qs[i],
            onEdit: () async {
              final r = await _questionSheet(context, _qs[i].type, _section, initial: _qs[i]);
              if (r != null) setState(() => _qs[i] = r);
            },
            onDuplicate: () => setState(() => _qs.insert(i + 1, TestQuestion(id: _qid(), section: _qs[i].section, type: _qs[i].type, prompt: _qs[i].prompt, marks: _qs[i].marks, options: _qs[i].options, correct: _qs[i].correct))),
            onDelete: () => setState(() => _qs.removeAt(i)),
          ),
          SizedBox(height: 4.h),
          AppButton('Add Question to Section $_section', kind: BtnKind.soft, icon: Icons.add_rounded, onPressed: () => _addQuestion(_section == 'A' ? 'MCQ' : 'Short Answer')),
          LessonHeading('Schedule & Security Controls', icon: Icons.shield_outlined),
          AppPickTile(icon: Icons.calendar_today_outlined, caption: 'Examination Date', label: fmtIso(isoOf(_date), 'EEE, d MMM yyyy'), onTap: _pickDate),
          SizedBox(height: 10.h),
          Row(children: [
            Expanded(child: AppPickTile(icon: Icons.schedule_rounded, caption: 'Start Time', label: fmtTime(hhmm(_time)), onTap: _pickTime)),
            SizedBox(width: 10.w),
            Expanded(
              child: Container(
                constraints: BoxConstraints(minHeight: 56.h),
                padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('End Window', style: T.small.copyWith(fontSize: 11.sp)),
                  Text(fmtTime(end), style: T.bodyStrong.copyWith(fontSize: 13.5.sp), maxLines: 1),
                ]),
              ),
            ),
          ]),
          SizedBox(height: 14.h),
          AppSwitchTile(title: 'Webcam & Tab Lock Proctoring', subtitle: 'Restricts browser focus and logs tab departures', value: _proctor, onChanged: (v) => setState(() => _proctor = v)),
          AppSwitchTile(title: '5-Minute Grace Period', subtitle: 'Accommodates brief internet or bus delays', value: _grace, onChanged: (v) => setState(() => _grace = v)),
          AppSwitchTile(
            title: 'Notify parents & students',
            subtitle: 'Send blueprint notifications and exam alerts to Class $_cls parents & student app feeds upon saving.',
            value: _notify, onChanged: (v) => setState(() => _notify = v),
          ),
        ]),
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  const _StatBox({required this.icon, required this.label, required this.value, required this.sub, this.good = false});
  final IconData icon;
  final String label, value, sub;
  final bool good;
  @override
  Widget build(BuildContext context) => AppCard(
        radius: R.lg, padding: EdgeInsets.all(10.r),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(icon, size: 14.r, color: C.primary),
            SizedBox(width: 4.w),
            Expanded(child: Text(label, style: T.capsMuted.copyWith(fontSize: 9.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
          ]),
          SizedBox(height: 6.h),
          FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(value.isEmpty ? '0' : value, style: T.stat.copyWith(fontSize: 22.sp))),
          Text(sub, style: T.small.copyWith(fontSize: 11.sp, color: good ? C.successDark : C.slate), maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
      );
}

class _TypeTile extends StatelessWidget {
  const _TypeTile(this.icon, this.label, this.onTap, {this.selected = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool selected;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true, label: 'Add $label question',
        excludeSemantics: true,
        child: AppCard(
          radius: R.md, padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 12.h), onTap: onTap,
          color: selected ? C.primarySoft : C.surface, border: selected ? C.panelBorder : C.border,
          child: Row(children: [
            Icon(icon, size: 18.r, color: selected ? C.primary : C.slate),
            SizedBox(width: 8.w),
            Expanded(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.smallStrong.copyWith(fontSize: 13.sp, color: selected ? C.primary : C.ink))),
          ]),
        ),
      );
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({required this.index, required this.q, required this.onEdit, required this.onDuplicate, required this.onDelete});
  final int index;
  final TestQuestion q;
  final VoidCallback onEdit, onDuplicate, onDelete;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 10.h),
        child: AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                width: 26.r, height: 26.r, alignment: Alignment.center,
                decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle),
                child: Text('${index + 1}', style: T.smallStrong.copyWith(color: Colors.white)),
              ),
              SizedBox(width: 10.w),
              Flexible(child: Pill('${q.marks} Mark${q.marks == 1 ? '' : 's'} • ${q.type}')),
              const Spacer(),
              IconButton(tooltip: 'Edit question', onPressed: onEdit, icon: Icon(Icons.edit_outlined, size: 18.r)),
              IconButton(tooltip: 'Duplicate question', onPressed: onDuplicate, icon: Icon(Icons.copy_rounded, size: 18.r)),
              IconButton(tooltip: 'Delete question', onPressed: onDelete, icon: Icon(Icons.delete_outline_rounded, size: 18.r, color: C.danger)),
            ]),
            Text(q.prompt, style: T.bodyStrong),
            for (var o = 0; o < q.options.length; o++)
              Padding(
                padding: EdgeInsets.only(top: 6.h),
                child: Row(children: [
                  Container(
                    width: 22.r, height: 22.r, alignment: Alignment.center,
                    decoration: BoxDecoration(color: q.correct == o ? C.successSoft : C.surface, shape: BoxShape.circle),
                    child: Text(String.fromCharCode(65 + o), style: T.small.copyWith(fontWeight: FontWeight.w700, color: q.correct == o ? C.successDark : C.slate)),
                  ),
                  SizedBox(width: 8.w),
                  Expanded(child: Text(q.options[o], style: T.body)),
                  if (q.correct == o) Text('Correct Key', style: T.small.copyWith(color: C.successDark)),
                ]),
              ),
          ]),
        ),
      );
}

/// Add/edit question sheet. Returns null when dismissed.
Future<TestQuestion?> _questionSheet(BuildContext context, String type, String section, {TestQuestion? initial}) {
  final prompt = TextEditingController(text: initial?.prompt ?? '');
  final marks = TextEditingController(text: '${initial?.marks ?? (type == 'Short Answer' ? 3 : 1)}');
  final opts = [for (var i = 0; i < 4; i++) TextEditingController(text: i < (initial?.options.length ?? 0) ? initial!.options[i] : '')];
  var correct = initial?.correct ?? 0;
  var sec = initial?.section ?? section;
  String? err;
  final tf = type == 'True / False';
  return showAppSheet<TestQuestion>(context, title: initial == null ? 'Add $type question' : 'Edit question', builder: (ctx) => StatefulBuilder(builder: (ctx, set) {
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AppTextField(label: 'Question Prompt', controller: prompt, maxLines: 3),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: AppTextField(label: 'Marks', controller: marks, keyboard: TextInputType.number)),
            SizedBox(width: 12.w),
            Expanded(child: AppDropdown<String>(label: 'Section', value: sec, items: _sections, onChanged: (v) => set(() => sec = v))),
          ]),
          RadioGroup<int>(
            groupValue: correct,
            onChanged: (v) => set(() => correct = v ?? 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (type == 'MCQ') ...[
                Text('Options & Correct Key', style: T.smallStrong.copyWith(color: C.slate)),
                SizedBox(height: 6.h),
                for (var i = 0; i < 4; i++)
                  Row(children: [
                    Radio<int>(value: i),
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(bottom: 8.h),
                        child: TextField(controller: opts[i], decoration: InputDecoration(hintText: 'Option ${String.fromCharCode(65 + i)}')),
                      ),
                    ),
                  ]),
              ],
              if (tf)
                Row(children: [
                  for (var i = 0; i < 2; i++)
                    Expanded(child: RadioListTile<int>(dense: true, contentPadding: EdgeInsets.zero, value: i, title: Text(['True', 'False'][i], style: T.bodyStrong))),
                ]),
            ]),
          ),
          if (err != null) Padding(padding: EdgeInsets.only(bottom: 8.h), child: Text(err!, style: T.small.copyWith(color: C.danger))),
          AppButton(initial == null ? 'Add Question' : 'Save Question', onPressed: () {
            final m = int.tryParse(marks.text.trim());
            if (prompt.text.trim().isEmpty) return set(() => err = 'Enter the question prompt');
            if (m == null || m < 1) return set(() => err = 'Marks must be at least 1');
            if (type == 'MCQ' && opts.where((o) => o.text.trim().isNotEmpty).length < 2) return set(() => err = 'Provide at least two options');
            if (type == 'MCQ' && opts[correct].text.trim().isEmpty) return set(() => err = 'The correct key must have text');
            Navigator.pop(
              ctx,
              TestQuestion(
                id: initial?.id ?? _qid(), section: sec, type: type, prompt: prompt.text.trim(), marks: m,
                options: type == 'MCQ' ? [for (final o in opts) o.text.trim()] : (tf ? const ['True', 'False'] : const []), correct: correct,
              ),
            );
          }),
        ]);
      }));
}
