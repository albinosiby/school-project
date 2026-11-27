import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../engage/models/attachment_models.dart';
import '../../engage/screens/widgets/attachment_sheet.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/models/school_models.dart';
import '../../tasks/models/homework_grading.dart';
import '../../tasks/models/homework_models.dart';
import '../bloc/new_homework_bloc.dart';
import '../bloc/new_homework_events.dart';
import '../bloc/new_homework_states.dart';

const _mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
String _iso(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
DateTime _day(DateTime d) => DateTime(d.year, d.month, d.day);
String _dayLabel(DateTime d) => '${_wd[d.weekday - 1]}, ${d.day} ${_mon[d.month - 1]}';
String _time(DateTime d) {
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  return '$h:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'AM' : 'PM'}';
}

/// Quick due choices (days from today).
const _dueQuick = [(1, 'Tomorrow'), (2, 'In 2 days'), (3, 'In 3 days'), (7, 'In a week')];
const _marksQuick = [5, 10, 20, 25, 50, 100];

/// New assignment for a class (or edit one with `?id=`), in four steps: class & subject, the work (title,
/// instructions, files), when (publish now or later, due day, with the reminder timeline) and grading.
/// Parents get it in the parent app with a notification and hand in there.
class NewHomeworkScreen extends StatelessWidget {
  const NewHomeworkScreen({super.key, this.classId, this.editId});
  final String? classId, editId;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<NewHomeworkBloc>()..add(NewHomeworkLoadRequested(editId: editId)),
    child: BlocListener<NewHomeworkBloc, NewHomeworkState>(
      listenWhen: (a, b) => a.status != b.status && (b.status == NewHomeworkStatus.saved || b.status == NewHomeworkStatus.failure),
      listener: (ctx, s) {
        if (s.message != null) AppDialogs.showSnackBar(ctx, message: s.message!);
        if (s.status != NewHomeworkStatus.saved || s.saved == null) return;
        if (editId != null) {
          ctx.pop();
        } else {
          ctx.pushReplacement(RoutePaths.homework(s.saved!.id));
        }
      },
      child: _Form(classId: classId, editId: editId),
    ),
  );
}

class _Form extends StatefulWidget {
  const _Form({this.classId, this.editId});
  final String? classId, editId;
  @override
  State<_Form> createState() => _FormState();
}

class _FormState extends State<_Form> {
  final _title = TextEditingController();
  final _notes = TextEditingController();
  final _marks = TextEditingController(text: '10');
  late DateTime _due = _day(DateTime.now()).add(const Duration(days: 1));
  String? _classId;
  String _subject = '';
  bool _graded = true, _late = true, _filled = false;

  /// Publish later: parents are told at [_publishAt] (the server publishes it).
  bool _schedule = false;
  late DateTime _publishAt = () {
    final n = DateTime.now().add(const Duration(days: 1));
    return DateTime(n.year, n.month, n.day, 8);
  }();
  String? _scheduleErr;
  List<FileRef> _kept = const [];
  final List<PickedAttachment> _picked = [];
  String? _titleErr, _marksErr;

  @override
  void initState() {
    super.initState();
    _classId = widget.classId;
  }

  @override
  void dispose() {
    _title.dispose();
    _notes.dispose();
    _marks.dispose();
    super.dispose();
  }

  /// Fills the form once from the assignment being edited.
  void _fill(Homework h) {
    if (_filled) return;
    _filled = true;
    _classId = h.classId;
    _title.text = h.title;
    _notes.text = h.description;
    _subject = h.subject;
    _graded = h.graded;
    _marks.text = h.graded ? '${h.maxMarks}' : '10';
    _late = h.allowLate;
    _kept = h.attachments;
    _due = DateTime.tryParse(h.due.length >= 10 ? h.due.substring(0, 10) : h.due) ?? _due;
    _schedule = h.scheduled;
    _publishAt = h.publishAt ?? _publishAt;
  }

  List<String> _subjects(SchoolClass c) => c.subjectNames.isNotEmpty ? c.subjectNames : [if (c.subject.isNotEmpty) c.subject];

  Future<void> _pickPublish() async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: _publishAt.isBefore(now) ? now : _publishAt,
      firstDate: _day(now),
      lastDate: now.add(const Duration(days: 180)),
    );
    if (d == null || !mounted) return;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_publishAt));
    if (t == null) return;
    setState(() {
      _publishAt = DateTime(d.year, d.month, d.day, t.hour, t.minute);
      _scheduleErr = null;
    });
  }

  Future<void> _pickDue() async {
    final today = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: _due.isBefore(today) ? today : _due,
      firstDate: _day(today),
      lastDate: today.add(const Duration(days: 180)),
    );
    if (d != null) setState(() => _due = d);
  }

  Future<void> _addFiles(String from) async {
    final more = switch (from) {
      'camera' => await pickCamera(),
      'photos' => await pickPhotos(),
      _ => await pickDocuments(),
    };
    if (more.isEmpty) return;
    final big = more.where((f) => f.bytes > 15 * 1024 * 1024).length;
    setState(() => _picked.addAll(more.where((f) => f.bytes <= 15 * 1024 * 1024)));
    if (big > 0 && mounted) AppDialogs.showSnackBar(context, message: '$big file(s) over 15 MB were skipped');
  }

  void _save(SchoolClass c, Homework? editing, int enrolled) {
    final title = _title.text.trim();
    final marks = int.tryParse(_marks.text.trim());
    final dueEnd = DateTime(_due.year, _due.month, _due.day, 23, 59);
    setState(() {
      _titleErr = title.length < 3 ? 'Give the assignment a title (at least 3 characters)' : null;
      _marksErr = _graded && (marks == null || marks < 1 || marks > 1000) ? 'Enter marks from 1 to 1000' : null;
      _scheduleErr = !_schedule
          ? null
          : !_publishAt.isAfter(DateTime.now())
          ? 'Pick a publish time in the future'
          : _publishAt.isAfter(dueEnd)
          ? 'Publish on or before the due day'
          : null;
    });
    if (_titleErr != null || _marksErr != null || _scheduleErr != null) {
      AppDialogs.showSnackBar(context, message: _titleErr ?? _marksErr ?? _scheduleErr!);
      return;
    }
    final subjects = _subjects(c);
    final subject = _subject.isNotEmpty ? _subject : (subjects.isEmpty ? '' : subjects.first);
    final base = editing ?? Homework(id: '', classId: c.id, title: '', subject: subject, due: '', maxMarks: 0, createdAt: DateTime.now().toIso8601String());
    final hw = Homework(
      id: base.id,
      classId: c.id,
      title: title,
      subject: subject,
      due: _iso(_due),
      maxMarks: _graded ? marks! : 0,
      description: _notes.text.trim(),
      // scheduled until its time (the server publishes it), else open; a closed assignment stays closed when edited
      status: _schedule ? 'scheduled' : (base.status == 'scheduled' || base.id.isEmpty ? 'open' : base.status),
      createdAt: base.createdAt,
      submissions: base.submissions,
      extra: {
        ...base.extra,
        'allowLate': _late,
        'attachments': [for (final f in _kept) f.toJson()],
        'publishAt': _schedule ? _publishAt.toUtc().toIso8601String() : null,
      }..removeWhere((k, v) => k == 'publishAt' && v == null),
    );
    context.read<NewHomeworkBloc>().add(NewHomeworkSubmitted(hw, enrolled: enrolled, files: List.of(_picked)));
  }

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final s = context.watch<NewHomeworkBloc>().state;
    final editing = s.editing;
    if (editing != null) _fill(editing);
    final teaching = [for (final c in school.classes) if (_subjects(c).isNotEmpty || !c.classTeacher) c];
    final c = school.classById(_classId ?? '') ?? (teaching.isEmpty ? null : teaching.first);
    if (widget.editId != null && s.status == NewHomeworkStatus.ready && editing == null) {
      return DetailScaffold(title: 'Edit assignment', fallbackRoute: RoutePaths.assignments, body: const AppEmptyState('Assignment not found', icon: Icons.assignment_late_outlined));
    }
    if (c == null) {
      return DetailScaffold(title: 'New assignment', fallbackRoute: RoutePaths.assignments, body: const AppEmptyState('No classes assigned', icon: Icons.class_outlined));
    }
    final subjects = _subjects(c);
    final subject = _subject.isEmpty ? (subjects.isEmpty ? '' : subjects.first) : _subject;
    final enrolled = school.studentsOf(c.id).length;
    final saving = s.status == NewHomeworkStatus.saving;
    final today = _day(DateTime.now());
    final dueLeft = _day(_due).difference(today).inDays;
    final publishDay = _schedule ? _day(_publishAt) : today;
    final reminderDay = _day(_due).subtract(const Duration(days: 2));
    final hasReminder = reminderDay.isAfter(publishDay) || (reminderDay == publishDay && !_schedule);

    return DetailScaffold(
      title: editing == null ? 'New assignment' : 'Edit assignment',
      subtitle: 'Class ${c.label}${subject.isEmpty ? '' : ' • $subject'}',
      fallbackRoute: RoutePaths.assignments,
      bottom: _BottomBar(
        summary: '$enrolled students • due ${dueLeft <= 0 ? 'today' : dueLeft == 1 ? 'tomorrow' : _dayLabel(_due)}',
        detail: _schedule ? 'Publishes ${_dayLabel(_publishAt)}, ${_time(_publishAt)}' : (editing == null ? 'Parents are notified now' : 'Changes show straight away'),
        button: AppButton(
          saving ? 'Saving…' : (editing == null ? (_schedule ? 'Schedule' : 'Publish') : 'Save'),
          key: const ValueKey('hw-submit'),
          icon: _schedule ? Icons.schedule_send_rounded : Icons.send_rounded,
          busy: saving,
          expand: false,
          onPressed: saving || s.status == NewHomeworkStatus.initial ? null : () => _save(c, editing, enrolled),
        ),
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 24.h),
        children: [
          // 1. Who
          _Step(
            n: 1,
            title: editing == null ? 'Class & subject' : 'Subject',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (editing == null && teaching.length > 1) ...[
                  SizedBox(
                    height: 74.h,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: teaching.length,
                      separatorBuilder: (_, _) => SizedBox(width: 8.w),
                      itemBuilder: (_, i) {
                        final x = teaching[i];
                        return _ClassChoice(
                          key: ValueKey('hw-class-${x.id}'),
                          label: x.label,
                          count: school.studentsOf(x.id).length,
                          selected: x.id == c.id,
                          onTap: () => setState(() {
                            _classId = x.id;
                            _subject = '';
                          }),
                        );
                      },
                    ),
                  ),
                  SizedBox(height: 12.h),
                ],
                if (subjects.length > 1)
                  AppChoiceChips(items: subjects, value: subject, dense: true, onChanged: (v) => setState(() => _subject = v))
                else
                  Row(
                    children: [
                      Icon(Icons.menu_book_rounded, size: 18.r, color: C.primary),
                      SizedBox(width: 8.w),
                      Expanded(child: Text(subject.isEmpty ? 'Class ${c.label}' : '$subject • Class ${c.label}', style: T.bodyStrong)),
                      Text('$enrolled students', style: T.small),
                    ],
                  ),
              ],
            ),
          ),
          // 2. What
          _Step(
            n: 2,
            title: 'The work',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  key: const ValueKey('hw-title'),
                  controller: _title,
                  maxLength: 100,
                  textCapitalization: TextCapitalization.sentences,
                  style: T.h3,
                  decoration: InputDecoration(labelText: 'Title', hintText: 'e.g. Fractions — exercise 4.2', errorText: _titleErr, counterText: ''),
                  onChanged: (_) => setState(() => _titleErr = null),
                ),
                SizedBox(height: 12.h),
                TextField(
                  key: const ValueKey('hw-notes'),
                  controller: _notes,
                  minLines: 3,
                  maxLines: 8,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(labelText: 'Description', alignLabelWithHint: true, hintText: 'What to do, pages, questions, how to hand in…'),
                ),
                SizedBox(height: 14.h),
                Row(
                  children: [
                    Expanded(child: Text('Documents', style: T.smallStrong)),
                    Text(_kept.length + _picked.length == 0 ? 'Optional • 15 MB each' : '${_kept.length + _picked.length} attached', style: T.small),
                  ],
                ),
                SizedBox(height: 8.h),
                Row(
                  children: [
                    Expanded(child: _AddFile(key: const ValueKey('hw-add-camera'), icon: Icons.photo_camera_outlined, label: 'Camera', onTap: saving ? null : () => _addFiles('camera'))),
                    SizedBox(width: 8.w),
                    Expanded(child: _AddFile(key: const ValueKey('hw-add-photos'), icon: Icons.photo_library_outlined, label: 'Photos', onTap: saving ? null : () => _addFiles('photos'))),
                    SizedBox(width: 8.w),
                    Expanded(child: _AddFile(key: const ValueKey('hw-add-files'), icon: Icons.upload_file_rounded, label: 'Files', onTap: saving ? null : () => _addFiles('files'))),
                  ],
                ),
                if (_kept.isNotEmpty || _picked.isNotEmpty) SizedBox(height: 10.h),
                for (final f in _kept)
                  _AttachRow(name: f.name, size: FileRef.sizeLabel(f.bytes), image: f.isImage, onRemove: saving ? null : () => setState(() => _kept = [..._kept]..remove(f))),
                for (final f in _picked)
                  _AttachRow(name: f.name, size: f.sizeLabel, image: f.isImage, isNew: true, onRemove: saving ? null : () => setState(() => _picked.remove(f))),
              ],
            ),
          ),
          // 3. When
          _Step(
            n: 3,
            title: 'Publish & due date',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppSegmented(
                  items: const ['Publish now', 'Schedule'],
                  value: _schedule ? 'Schedule' : 'Publish now',
                  track: true,
                  onChanged: (v) => setState(() {
                    _schedule = v == 'Schedule';
                    _scheduleErr = null;
                  }),
                ),
                if (_schedule) ...[
                  SizedBox(height: 8.h),
                  AppPickTile(
                    key: const ValueKey('hw-publish-at'),
                    icon: Icons.schedule_send_rounded,
                    plainIcon: true,
                    label: '${_dayLabel(_publishAt)} • ${_time(_publishAt)}',
                    caption: 'Parents see it and get the notification then',
                    onTap: _pickPublish,
                  ),
                  if (_scheduleErr != null) Padding(padding: EdgeInsets.only(top: 4.h), child: Text(_scheduleErr!, style: T.small.copyWith(color: C.danger))),
                ],
                SizedBox(height: 14.h),
                Text('Due', style: T.smallStrong),
                SizedBox(height: 8.h),
                Wrap(
                  spacing: 8.w,
                  runSpacing: 8.h,
                  children: [
                    for (final q in _dueQuick)
                      _Chip(
                        key: ValueKey('hw-due-${q.$1}'),
                        label: q.$2,
                        selected: dueLeft == q.$1,
                        onTap: () => setState(() => _due = today.add(Duration(days: q.$1))),
                      ),
                    _Chip(
                      key: const ValueKey('hw-due-pick'),
                      label: _dueQuick.any((q) => q.$1 == dueLeft) ? 'Pick date' : _dayLabel(_due),
                      icon: Icons.event_outlined,
                      selected: !_dueQuick.any((q) => q.$1 == dueLeft),
                      onTap: _pickDue,
                    ),
                  ],
                ),
                SizedBox(height: 16.h),
                _Timeline(
                  steps: [
                    (Icons.campaign_rounded, _schedule ? 'Published' : 'Published now', _schedule ? '${_dayLabel(_publishAt)}, ${_time(_publishAt)}' : 'Parents notified', C.primary),
                    if (hasReminder)
                      (Icons.notifications_active_rounded, 'Reminder', '${_dayLabel(reminderDay)}, 8 AM • only to those not handed in', C.warning)
                    else
                      (Icons.notifications_off_outlined, 'No reminder', 'Due too soon for the 2-day reminder', C.slate),
                    (Icons.flag_rounded, 'Due', '${_dayLabel(_due)} • you get a hand-in summary at 8 AM', C.danger),
                  ],
                ),
              ],
            ),
          ),
          // 4. Grading
          _Step(
            n: 4,
            title: 'Grading',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SwitchRow(
                  key: const ValueKey('hw-graded'),
                  icon: Icons.grading_rounded,
                  title: 'Give marks',
                  subtitle: _graded ? 'Grade each student out of the marks below' : 'Not graded — mark each one as done',
                  value: _graded,
                  onChanged: (v) => setState(() => _graded = v),
                ),
                if (_graded) ...[
                  SizedBox(height: 10.h),
                  Row(
                    children: [
                      Expanded(
                        child: Wrap(
                          spacing: 6.w,
                          runSpacing: 6.h,
                          children: [
                            for (final m in _marksQuick)
                              _Chip(
                                key: ValueKey('hw-marks-$m'),
                                label: '$m',
                                selected: _marks.text.trim() == '$m',
                                onTap: () => setState(() {
                                  _marks.text = '$m';
                                  _marksErr = null;
                                }),
                              ),
                          ],
                        ),
                      ),
                      SizedBox(width: 8.w),
                      SizedBox(
                        width: 76.w,
                        child: TextField(
                          key: const ValueKey('hw-max'),
                          controller: _marks,
                          keyboardType: TextInputType.number,
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4)],
                          textAlign: TextAlign.center,
                          decoration: InputDecoration(isDense: true, labelText: 'Out of', errorText: _marksErr == null ? null : ''),
                          onChanged: (_) => setState(() => _marksErr = null),
                        ),
                      ),
                    ],
                  ),
                  if (_marksErr != null) Padding(padding: EdgeInsets.only(top: 4.h), child: Text(_marksErr!, style: T.small.copyWith(color: C.danger))),
                ],
                Padding(padding: EdgeInsets.symmetric(vertical: 10.h), child: Divider(height: 1, color: C.border)),
                _SwitchRow(
                  key: const ValueKey('hw-late'),
                  icon: Icons.more_time_rounded,
                  title: 'Accept late hand-ins',
                  subtitle: _late ? 'Late uploads are marked late and you are notified of each' : 'Hand-ins close after the due day',
                  value: _late,
                  onChanged: (v) => setState(() => _late = v),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A numbered card for one part of the form.
class _Step extends StatelessWidget {
  const _Step({required this.n, required this.title, required this.child});
  final int n;
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 14.h),
    child: AppCard(
      radius: R.xl,
      padding: EdgeInsets.fromLTRB(14.w, 14.h, 14.w, 16.h),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 24.r,
                height: 24.r,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle),
                child: Text('$n', style: T.smallStrong.copyWith(color: Colors.white, fontSize: 12.sp)),
              ),
              SizedBox(width: 10.w),
              Expanded(child: Text(title, style: T.h3)),
            ],
          ),
          SizedBox(height: 12.h),
          child,
        ],
      ),
    ),
  );
}

class _ClassChoice extends StatelessWidget {
  const _ClassChoice({super.key, required this.label, required this.count, required this.selected, required this.onTap});
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: selected ? C.primary : C.surface,
    borderRadius: BorderRadius.circular(R.lg),
    child: InkWell(
      borderRadius: BorderRadius.circular(R.lg),
      onTap: onTap,
      child: Container(
        width: 96.w,
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: selected ? C.primary : C.border)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Class', style: T.small.copyWith(color: selected ? Colors.white70 : C.slate, fontSize: 11.sp)),
            Text(label, style: T.h3.copyWith(color: selected ? Colors.white : C.ink), maxLines: 1, overflow: TextOverflow.ellipsis),
            Text('$count students', style: T.small.copyWith(color: selected ? Colors.white70 : C.slate, fontSize: 11.sp), maxLines: 1),
          ],
        ),
      ),
    ),
  );
}

class _Chip extends StatelessWidget {
  const _Chip({super.key, required this.label, required this.selected, required this.onTap, this.icon});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Material(
    color: selected ? C.primarySoft : C.surface,
    borderRadius: BorderRadius.circular(R.pill),
    child: InkWell(
      borderRadius: BorderRadius.circular(R.pill),
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 7.h),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: selected ? C.primary : C.border)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: 15.r, color: selected ? C.primary : C.slate), SizedBox(width: 5.w)],
            Text(label, style: T.smallStrong.copyWith(color: selected ? C.primary : C.ink)),
          ],
        ),
      ),
    ),
  );
}

class _AddFile extends StatelessWidget {
  const _AddFile({super.key, required this.icon, required this.label, this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: C.panel,
    borderRadius: BorderRadius.circular(R.md),
    child: InkWell(
      borderRadius: BorderRadius.circular(R.md),
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 12.h),
        child: Column(
          children: [
            Icon(icon, size: 22.r, color: C.primary),
            SizedBox(height: 4.h),
            Text(label, style: T.smallStrong),
          ],
        ),
      ),
    ),
  );
}

/// Publish → reminder → due, as a small vertical timeline.
class _Timeline extends StatelessWidget {
  const _Timeline({required this.steps});
  final List<(IconData, String, String, Color)> steps;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.fromLTRB(12.w, 12.h, 12.w, 4.h),
    decoration: BoxDecoration(color: C.panel, borderRadius: BorderRadius.circular(R.lg)),
    child: Column(
      children: [
        for (var i = 0; i < steps.length; i++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Column(
                  children: [
                    Container(
                      width: 28.r,
                      height: 28.r,
                      decoration: BoxDecoration(color: steps[i].$4.withValues(alpha: 0.14), shape: BoxShape.circle),
                      child: Icon(steps[i].$1, size: 15.r, color: steps[i].$4),
                    ),
                    if (i < steps.length - 1) Expanded(child: Container(width: 2, margin: EdgeInsets.symmetric(vertical: 2.h), color: C.border)),
                  ],
                ),
                SizedBox(width: 10.w),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(top: 3.h, bottom: 12.h),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(steps[i].$2, style: T.smallStrong.copyWith(color: C.ink)),
                        Text(steps[i].$3, style: T.small.copyWith(fontSize: 12.sp)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    ),
  );
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({super.key, required this.icon, required this.title, required this.subtitle, required this.value, required this.onChanged});
  final IconData icon;
  final String title, subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: () => onChanged(!value),
    child: Row(
      children: [
        IconTile(icon, size: 34),
        SizedBox(width: 10.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: T.bodyStrong),
              Text(subtitle, style: T.small),
            ],
          ),
        ),
        Switch(value: value, onChanged: onChanged),
      ],
    ),
  );
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.summary, required this.detail, required this.button});
  final String summary, detail;
  final Widget button;
  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(color: C.surface, border: Border(top: BorderSide(color: C.border))),
    child: SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(16.w, 10.h, 16.w, 10.h),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(summary, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(detail, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            SizedBox(width: 12.w),
            button,
          ],
        ),
      ),
    ),
  );
}

class _AttachRow extends StatelessWidget {
  const _AttachRow({required this.name, required this.size, required this.image, this.isNew = false, this.onRemove});
  final String name, size;
  final bool image, isNew;
  final VoidCallback? onRemove;
  @override
  Widget build(BuildContext context) => Container(
    margin: EdgeInsets.only(bottom: 6.h),
    padding: EdgeInsets.only(left: 10.w),
    decoration: BoxDecoration(color: C.panel, borderRadius: BorderRadius.circular(R.md)),
    child: Row(
      children: [
        Icon(image ? Icons.image_outlined : Icons.description_outlined, size: 20.r, color: C.primary),
        SizedBox(width: 8.w),
        Expanded(child: Text(name, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
        if (isNew) Padding(padding: EdgeInsets.only(right: 6.w), child: const Pill('New', tone: Tone.brand)),
        if (size.isNotEmpty) Text(size, style: T.small.copyWith(fontSize: 11.sp)),
        IconButton(tooltip: 'Remove $name', onPressed: onRemove, icon: Icon(Icons.close_rounded, size: 18.r, color: C.slate)),
      ],
    ),
  );
}
