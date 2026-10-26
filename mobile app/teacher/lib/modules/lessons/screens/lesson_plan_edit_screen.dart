import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/lesson_plans_bloc.dart';
import '../bloc/lesson_plans_events.dart';
import '../bloc/lesson_plans_states.dart';
import '../models/lesson_plan_models.dart';
import 'widgets/lessons_common.dart';

const _blooms = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'];
const _periodOpts = ['Period 1 (45m)', 'Period 2 (45m)', 'Double (90m)'];

/// Figma 1153:3675 "5.1.2 Edit Lesson Plan". [id] `new` creates a plan.
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
  final _title = TextEditingController(), _summary = TextEditingController(), _outcome = TextEditingController(), _ncert = TextEditingController(), _concept = TextEditingController();
  final _dateCtl = TextEditingController();
  String _cls = '10-B', _subject = 'Mathematics', _bloom = 'Apply', _period = _periodOpts[1];
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  bool _draft = false, _loaded = false, _showErrors = false;
  List<String> _concepts = [];
  List<LessonObjective> _objectives = [];
  List<LessonActivity> _activities = [];
  List<LessonResource> _resources = [];
  int _day = 1;
  LessonPlan? _existing;

  bool get _isNew => widget.id == 'new';

  void _load(LessonPlansState st) {
    if (_loaded || st.status != LessonPlansStatus.loaded) return;
    _loaded = true;
    final p = _isNew ? null : st.byId(widget.id);
    _existing = p;
    if (p != null) {
      _title.text = p.title;
      _summary.text = p.summary;
      _outcome.text = p.outcome;
      _ncert.text = p.ncert;
      _cls = p.cls;
      _subject = p.subject;
      _bloom = _blooms.contains(p.bloom) ? p.bloom : 'Apply';
      _date = DateTime.tryParse(p.date) ?? _date;
      _draft = p.draft;
      _concepts = [...p.concepts];
      _objectives = [...p.objectives];
      _activities = [...p.activities];
      _resources = [...p.resources];
      _day = p.day;
      if (_periodOpts.contains(p.period)) _period = p.period;
    }
    _dateCtl.text = fmtIso(isoOf(_date), 'd MMM yyyy');
  }

  @override
  void dispose() {
    for (final c in [_title, _summary, _outcome, _ncert, _concept, _dateCtl]) {
      c.dispose();
    }
    super.dispose();
  }

  void _save({required bool draft}) {
    setState(() => _showErrors = true);
    if (!_form.currentState!.validate()) {
      AppDialogs.showSnackBar(context, message: 'Please fix the highlighted fields', isError: true);
      return;
    }
    if (!draft && _objectives.isEmpty && _outcome.text.trim().isEmpty) {
      AppDialogs.showSnackBar(context, message: 'Add at least one learning objective', isError: true);
      return;
    }
    final now = DateTime.now();
    final stage = _existing?.stage == 'completed' ? 'completed' : (DateUtils.isSameDay(_date, now) || _date.isBefore(now) ? 'ongoing' : 'upcoming');
    final base = _existing ??
        LessonPlan(id: '', cls: _cls, subject: _subject, title: '', day: 1, days: 5, periods: 1, milestones: LessonPlansBloc.milestonesFor(_concepts));
    final plan = base.copyWith(
      title: _title.text.trim(), summary: _summary.text.trim(), outcome: _outcome.text.trim(), ncert: _ncert.text.trim(), cls: _cls, subject: _subject,
      bloom: _bloom, date: isoOf(_date), draft: draft, concepts: _concepts, objectives: _objectives, activities: _activities, resources: _resources,
      period: _period, saved: draft ? 'Auto-saved just now' : '', stage: stage, sched: _period.split(' (').first, day: _isNew ? 1 : _day,
    );
    context.read<LessonPlansBloc>().add(LessonPlanSaved(plan));
  }

  void _addConcept() {
    final t = _concept.text.trim();
    if (t.isEmpty || _concepts.contains(t)) return;
    setState(() {
      _concepts.add(t);
      _concept.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final st = context.watch<LessonPlansBloc>().state;
    final classes = context.select<SchoolBloc, List<String>>((b) => [for (final c in b.state.classes) c.label]);
    _load(st);
    final title = _isNew ? 'New Lesson Plan' : 'Edit Lesson Plan';
    if (!_loaded) return DetailScaffold(title: title, fallbackRoute: RoutePaths.lessonPlans, body: const LessonsLoading());
    if (!_isNew && _existing == null) {
      return DetailScaffold(title: title, fallbackRoute: RoutePaths.lessonPlans, body: Center(child: AppEmptyState('Lesson plan not found')));
    }
    final classOpts = {...classes, _cls}.toList();
    final subjects = {'Mathematics', 'Physics', 'Science', 'Foundation Math', _subject}.toList();
    final dayLabels = [for (var i = 1; i <= 5; i++) 'Day $i', 'Day 6 (New)'];
    return DetailScaffold(
      title: title,
      subtitle: _isNew ? 'Draft' : '${_existing!.code} • ${_draft ? 'Draft' : 'Active'} Curriculum',
      fallbackRoute: RoutePaths.lessonPlans,
      bottom: Row(children: [
        Expanded(child: AppButton('Save Draft', kind: BtnKind.outline, onPressed: () => _save(draft: true))),
        SizedBox(width: 10.w),
        Expanded(flex: 2, child: AppButton('Save & Publish', icon: Icons.done_all_rounded, onPressed: () => _save(draft: false))),
      ]),
      body: Form(
        key: _form,
        autovalidateMode: _showErrors ? AutovalidateMode.onUserInteraction : AutovalidateMode.disabled,
        child: ListView(padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 24.h), children: [
          LessonHeading('Sequence & Slot Schedule', icon: Icons.timeline_rounded),
          AppTextField(label: 'Lesson title', controller: _title, hint: 'e.g. Chapter 4: Quadratic Equations',
              validator: (v) => (v ?? '').trim().length < 3 ? 'Enter a title (min 3 characters)' : null),
          AppTextField(label: 'Short summary', controller: _summary, maxLines: 2, hint: 'What will this lesson cover?'),
          Row(children: [
            Expanded(child: AppDropdown<String>(label: 'Class', value: _cls, items: classOpts, onChanged: (v) => setState(() => _cls = v), labelOf: (v) => 'Class $v')),
            SizedBox(width: 12.w),
            Expanded(child: AppDropdown<String>(label: 'Subject', value: _subject, items: subjects, onChanged: (v) => setState(() => _subject = v))),
          ]),
          if (!_isNew) ...[
            Text('Lesson Sequence Position', style: T.smallStrong.copyWith(color: C.slate)),
            SizedBox(height: 8.h),
            AppChoiceChips(items: dayLabels, value: dayLabels[(_day - 1).clamp(0, 5)], onChanged: (v) => setState(() => _day = dayLabels.indexOf(v) + 1)),
            SizedBox(height: 14.h),
          ],
          AppTextField(
            label: 'Target Teaching Date', readOnly: true, controller: _dateCtl,
            suffix: Icon(Icons.calendar_today_outlined, size: 18.r),
            onTap: () async {
              final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2024), lastDate: DateTime(2030));
              if (d != null) {
                setState(() {
                  _date = d;
                  _dateCtl.text = fmtIso(isoOf(d), 'd MMM yyyy');
                });
              }
            },
          ),
          Text('Target Period Allocation', style: T.smallStrong.copyWith(color: C.slate)),
          SizedBox(height: 8.h),
          AppChoiceChips(items: _periodOpts, value: _period, solid: true, check: true, onChanged: (v) => setState(() => _period = v)),
          SizedBox(height: 14.h),
          AppTextField(label: 'NCERT reference', controller: _ncert, hint: 'e.g. NCERT Ch 4.3'),
          LessonHeading('Topic & Sub-Concepts', icon: Icons.menu_book_outlined, trailing: '${_concepts.length} Added'),
          Wrap(spacing: 8.w, runSpacing: 8.h, children: [
            for (final c in _concepts)
              InputChip(
                label: Text(c, style: T.smallStrong.copyWith(color: C.primary)),
                backgroundColor: C.primarySoft, side: const BorderSide(color: C.panelBorder),
                deleteIconColor: C.primary,
                onDeleted: () => setState(() => _concepts.remove(c)),
              ),
          ]),
          SizedBox(height: 8.h),
          Row(children: [
            Expanded(child: TextField(controller: _concept, decoration: const InputDecoration(hintText: 'Add Concept'), onSubmitted: (_) => _addConcept())),
            SizedBox(width: 10.w),
            AppButton('Add', expand: false, small: true, kind: BtnKind.soft, icon: Icons.add_rounded, onPressed: _addConcept),
          ]),
          LessonHeading('Pedagogical Intent', icon: Icons.psychology_outlined),
          Text("Bloom's Level", style: T.smallStrong.copyWith(color: C.slate)),
          SizedBox(height: 8.h),
          AppChoiceChips(items: _blooms, value: _bloom, onChanged: (v) => setState(() => _bloom = v)),
          SizedBox(height: 14.h),
          AppTextField(label: 'Primary Learning Outcome', controller: _outcome, maxLines: 3, hint: 'Students will…',
              validator: (v) => (v ?? '').trim().length < 10 ? 'Describe the outcome (min 10 characters)' : null),
          LessonHeading('Objectives', trailing: '${_objectives.length} added'),
          for (var i = 0; i < _objectives.length; i++)
            RemovableItemTile(title: _objectives[i].title, sub: _objectives[i].desc, onDelete: () => setState(() => _objectives.removeAt(i))),
          AppButton('Add objective', kind: BtnKind.soft, icon: Icons.add_rounded, onPressed: () async {
            final r = await promptSheet(context, 'Add objective', [('Objective', ''), ('Details', '')]);
            if (r != null) setState(() => _objectives.add(LessonObjective(title: r[0], desc: r[1])));
          }),
          LessonHeading('Activities', trailing: '${_activities.fold<int>(0, (a, e) => a + e.mins)} mins'),
          for (var i = 0; i < _activities.length; i++)
            RemovableItemTile(title: '${_activities[i].title} • ${_activities[i].mins} min', sub: _activities[i].desc, onDelete: () => setState(() => _activities.removeAt(i))),
          AppButton('Add activity', kind: BtnKind.soft, icon: Icons.add_rounded, onPressed: () async {
            final r = await promptSheet(context, 'Add activity', [('Activity', ''), ('Minutes', 'number'), ('Description', '')]);
            if (r != null) setState(() => _activities.add(LessonActivity(title: r[0], mins: int.tryParse(r[1]) ?? 5, desc: r[2])));
          }),
          LessonHeading('Resources', trailing: '${_resources.length} items'),
          for (var i = 0; i < _resources.length; i++)
            RemovableItemTile(title: _resources[i].name, sub: _resources[i].meta, onDelete: () => setState(() => _resources.removeAt(i))),
          AppButton('Attach resource', kind: BtnKind.soft, icon: Icons.attach_file_rounded, onPressed: () async {
            final r = await promptSheet(context, 'Attach resource', [('File name', ''), ('Type (e.g. Handout)', '')]);
            if (r != null) setState(() => _resources.add(LessonResource(name: r[0], meta: '${r[1].isEmpty ? 'Attachment' : r[1]} • 1.0 MB')));
          }),
          SizedBox(height: 16.h),
          if (!_isNew)
            AppButton('Discard', kind: BtnKind.ghost, onPressed: () async {
              final ok = await AppDialogs.showConfirmDialog(context, title: 'Discard changes?', message: 'Your edits will be lost.', confirm: 'Discard', danger: true);
              if (ok && context.mounted) context.pop();
            }),
        ]),
      ),
    );
  }
}
