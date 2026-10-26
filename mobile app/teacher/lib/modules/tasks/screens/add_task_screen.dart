import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/models/school_models.dart';
import '../bloc/task_form_bloc.dart';
import '../bloc/task_form_events.dart';
import '../bloc/task_form_states.dart';
import '../models/task_models.dart';
import '../models/tasks_format.dart';
import 'widgets/pick_field.dart';

const _catIcons = {
  'Academic & Grading': Icons.school_outlined,
  'Lesson Prep': Icons.menu_book_outlined,
  'Admin & Compliance': Icons.business_center_outlined,
  'Student Follow-up': Icons.support_agent_outlined,
};
const _pris = {'urgent': 'Urgent', 'medium': 'Medium', 'normal': 'Normal'};

/// Add / edit task or reminder (Figma 1153:1152). [editId] edits an existing record.
class AddTaskScreen extends StatelessWidget {
  const AddTaskScreen({super.key, this.editId});
  final String? editId;
  @override
  Widget build(BuildContext context) =>
      BlocProvider(create: (_) => getIt<TaskFormBloc>()..add(TaskFormLoadRequested(editId: editId)), child: const _AddTaskView());
}

class _AddTaskView extends StatefulWidget {
  const _AddTaskView();
  @override
  State<_AddTaskView> createState() => _AddTaskViewState();
}

class _AddTaskViewState extends State<_AddTaskView> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _notes = TextEditingController();
  bool _reminder = false, _notify = true, _submitted = false;
  String _cat = kTaskCategories.first, _pri = 'medium', _class = '';
  late DateTime _date;
  TimeOfDay _time = const TimeOfDay(hour: 17, minute: 0);
  String? _dateError;

  @override
  void initState() {
    super.initState();
    _date = dayOf(DateTime.now().add(const Duration(days: 1)));
    _title.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _title.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _fill(TaskItem? t) {
    if (t == null) return;
    _title.text = t.title;
    _notes.text = t.notes;
    _reminder = t.isReminder;
    _cat = kTaskCategories.contains(t.category) ? t.category : kTaskCategories.first;
    _pri = _pris.containsKey(t.priority) ? t.priority : 'medium';
    _class = t.classId;
    _notify = t.notify;
    final d = t.dueAt;
    if (d != null) {
      _date = dayOf(d);
      _time = TimeOfDay(hour: d.hour, minute: d.minute);
    }
  }

  DateTime get _due => DateTime(_date.year, _date.month, _date.day, _time.hour, _time.minute);

  String? _validateDue(bool editing) => !editing && _due.isBefore(DateTime.now()) ? 'Due date and time must be in the future' : null;

  void _close() => context.canPop() ? context.pop() : context.go(RoutePaths.tasks);

  void _save(TaskFormState s) {
    final dueErr = _validateDue(s.isEdit);
    setState(() {
      _submitted = true;
      _dateError = dueErr;
    });
    if (!_form.currentState!.validate() || dueErr != null) return;
    context.read<TaskFormBloc>().add(TaskFormSubmitted(TaskItem(
          id: '', title: _title.text.trim(), kind: _reminder ? 'reminder' : 'task', category: _reminder ? kReminderCategory : _cat, priority: _pri,
          classId: _class, due: _due.toIso8601String(), notify: _notify, notes: _notes.text.trim(),
        )));
  }

  Future<void> _pickClass(TaskFormState s) async {
    final picked = await showPickSheet<String>(context,
        title: 'Class & Batch Assignment', items: ['', ...s.classes.map((c) => c.id)], selected: _class,
        label: (id) => id.isEmpty ? 'General (no class)' : 'Class ${_classOf(s, id)?.label ?? id}',
        sub: (id) => id.isEmpty ? 'Not linked to a class' : '${_classOf(s, id)?.students ?? 0} enrolled students');
    if (picked != null) setState(() => _class = picked);
  }

  SchoolClass? _classOf(TaskFormState s, String id) => s.classes.where((c) => c.id == id).firstOrNull;

  @override
  Widget build(BuildContext context) => BlocConsumer<TaskFormBloc, TaskFormState>(
        listenWhen: (a, b) => a.status != b.status,
        listener: (context, s) {
          if (s.status == TaskFormStatus.ready) setState(() => _fill(s.task));
          if (s.status == TaskFormStatus.saved) {
            final noun = s.savedReminder ? 'Reminder' : 'Task';
            AppDialogs.showSnackBar(context, message: s.task != null ? '$noun updated' : '$noun created');
            _close();
          }
          if (s.status == TaskFormStatus.failure) AppDialogs.showSnackBar(context, message: s.error ?? 'Could not save', isError: true);
        },
        builder: (context, s) {
          final noun = _reminder ? 'Reminder' : 'Task';
          final editing = s.isEdit;
          final loading = s.status == TaskFormStatus.initial || s.status == TaskFormStatus.loading;
          return DetailScaffold(
            title: editing ? 'Edit $noun' : 'Add $noun',
            fallbackRoute: RoutePaths.tasks,
            bottom: Row(children: [
              Expanded(child: AppButton('Cancel', kind: BtnKind.outline, onPressed: _close)),
              SizedBox(width: 12.w),
              Expanded(flex: 2, child: AppButton(editing ? 'Save Changes' : 'Create $noun', busy: s.status == TaskFormStatus.saving, onPressed: loading ? null : () => _save(s))),
            ]),
            body: loading ? const Center(child: CircularProgressIndicator()) : _body(s, noun),
          );
        },
      );

  Widget _body(TaskFormState s, String noun) {
    final c = _classOf(s, _class);
    Widget label(String t) => Padding(padding: EdgeInsets.only(bottom: 8.h), child: Text(t, style: T.smallStrong.copyWith(color: C.slate)));
    return Form(
      key: _form,
      autovalidateMode: _submitted ? AutovalidateMode.onUserInteraction : AutovalidateMode.disabled,
      child: ListView(padding: EdgeInsets.all(S.page), children: [
        AppSegmented(items: const ['Task', 'Reminder'], value: _reminder ? 'Reminder' : 'Task', track: true, onChanged: (v) => setState(() => _reminder = v == 'Reminder')),
        SizedBox(height: 16.h),
        Row(children: [
          Expanded(child: Text.rich(TextSpan(style: T.smallStrong.copyWith(color: C.slate), children: [TextSpan(text: '$noun Title '), TextSpan(text: '*', style: TextStyle(color: C.danger))]))),
          Text('${_title.text.length}/80', style: T.small),
        ]),
        SizedBox(height: 6.h),
        TextFormField(
          controller: _title, maxLength: 80, style: T.bodyStrong.copyWith(fontWeight: FontWeight.w500),
          decoration: const InputDecoration(hintText: 'e.g. Grade 10-B Math Term Mid-Papers', counterText: ''),
          validator: (v) => (v == null || v.trim().isEmpty) ? 'Please enter a title' : (v.trim().length < 3 ? 'Title is too short' : null),
        ),
        SizedBox(height: 16.h),
        if (!_reminder) ...[
          label('Category'),
          AppChoiceChips(items: kTaskCategories, value: _cat, solid: true, icons: _catIcons, onChanged: (v) => setState(() => _cat = v)),
          SizedBox(height: 16.h),
        ],
        label('Priority Level'),
        AppChoiceChips(
          items: _pris.values.toList(), value: _pris[_pri]!,
          toneOf: (v) => switch (v) { 'Urgent' => Tone.danger, 'Medium' => Tone.warning, _ => Tone.neutral },
          onChanged: (v) => setState(() => _pri = _pris.entries.firstWhere((e) => e.value == v).key),
        ),
        SizedBox(height: 16.h),
        PickField(
          label: 'Class & Batch Assignment', icon: Icons.groups_outlined, tile: true,
          title: c == null ? 'General (no class)' : 'Class ${c.label}',
          sub: c == null ? 'Not linked to a class' : '${c.students} enrolled students${s.term.isEmpty ? '' : ' • ${s.term}'}',
          trailing: Icon(Icons.keyboard_arrow_down_rounded, color: C.slate, size: 24.r),
          onTap: () => _pickClass(s),
        ),
        SizedBox(height: 16.h),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: PickField(
              label: 'Due Date', icon: Icons.calendar_today_outlined, title: relDay(_date), sub: fmtLong(_date),
              onTap: () async {
                final now = DateTime.now();
                final d = await showDatePicker(
                    context: context, initialDate: _date.isBefore(now.subtract(const Duration(days: 365))) ? now : _date,
                    firstDate: now.subtract(const Duration(days: 365)), lastDate: now.add(const Duration(days: 365 * 2)));
                if (d == null) return;
                setState(() {
                  _date = d;
                  _dateError = _submitted ? _validateDue(s.isEdit) : null;
                });
              },
            ),
          ),
          SizedBox(width: 12.w),
          Expanded(
            child: PickField(
              label: 'Due Time', icon: Icons.schedule_rounded, title: _time.format(context),
              sub: _time.hour < 12 ? 'Morning' : _time.hour < 15 ? 'Afternoon' : 'End of school',
              onTap: () async {
                final t = await showTimePicker(context: context, initialTime: _time);
                if (t == null) return;
                setState(() {
                  _time = t;
                  _dateError = _submitted ? _validateDue(s.isEdit) : null;
                });
              },
            ),
          ),
        ]),
        if (_dateError != null) Padding(padding: EdgeInsets.only(top: 6.h), child: Text(_dateError!, style: T.small.copyWith(color: C.danger))),
        SizedBox(height: 14.h),
        AppToggleRow(title: 'Notify 30 mins before', subtitle: 'Push alert + SMS summary', value: _notify, tinted: true, onChanged: (v) => setState(() => _notify = v)),
        SizedBox(height: 16.h),
        AppTextField(label: 'Objective & Notes (Optional)', controller: _notes, maxLines: 3, hint: 'Add details…'),
      ]),
    );
  }
}
