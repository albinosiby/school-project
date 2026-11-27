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

/// Set homework for a class (or edit one with `?id=`): title, subject, instructions, due day, marks or not graded,
/// late hand-ins, and attachments. Parents get it in the parent app (with a push) and can hand in there.
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
  late DateTime _due = DateTime.now().add(const Duration(days: 1));
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

  /// Fills the form once from the homework being edited.
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

  Future<void> _pickPublish() async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: _publishAt.isBefore(now) ? now : _publishAt,
      firstDate: DateTime(now.year, now.month, now.day),
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

  List<String> _subjects(SchoolClass c) => c.subjectNames.isNotEmpty ? c.subjectNames : [if (c.subject.isNotEmpty) c.subject];

  Future<void> _pickDue() async {
    final today = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: _due.isBefore(today) ? today : _due,
      firstDate: DateTime(today.year, today.month, today.day),
      lastDate: today.add(const Duration(days: 180)),
    );
    if (d != null) setState(() => _due = d);
  }

  Future<void> _addFiles(bool photos) async {
    final more = photos ? await pickPhotos() : await pickDocuments();
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
      _titleErr = title.length < 3 ? 'Give the homework a title (at least 3 characters)' : null;
      _marksErr = _graded && (marks == null || marks < 1 || marks > 1000) ? 'Enter marks from 1 to 1000' : null;
      _scheduleErr = !_schedule
          ? null
          : !_publishAt.isAfter(DateTime.now())
          ? 'Pick a publish time in the future'
          : _publishAt.isAfter(dueEnd)
          ? 'Publish on or before the due day'
          : null;
    });
    if (_titleErr != null || _marksErr != null || _scheduleErr != null) return;
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
      // scheduled until its time (the server publishes it), else open; a closed homework stays closed when edited
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
      return DetailScaffold(title: 'Edit homework', fallbackRoute: RoutePaths.classes, body: const AppEmptyState('Homework not found', icon: Icons.assignment_late_outlined));
    }
    if (c == null) {
      return DetailScaffold(title: 'New homework', fallbackRoute: RoutePaths.classes, body: const AppEmptyState('No classes assigned', icon: Icons.class_outlined));
    }
    final subjects = _subjects(c);
    final enrolled = school.studentsOf(c.id).length;
    final saving = s.status == NewHomeworkStatus.saving;
    return DetailScaffold(
      title: editing == null ? 'New homework' : 'Edit homework',
      subtitle: 'Class ${c.label} • $enrolled students',
      fallbackRoute: '${RoutePaths.students}?classId=${c.id}&view=subject',
      bottom: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(16.w, 8.h, 16.w, 10.h),
          child: AppButton(
            saving ? 'Saving…' : (editing == null ? (_schedule ? 'Schedule homework' : 'Set homework') : 'Save changes'),
            key: const ValueKey('hw-submit'),
            icon: Icons.send_rounded,
            busy: saving,
            onPressed: saving || s.status == NewHomeworkStatus.initial ? null : () => _save(c, editing, enrolled),
          ),
        ),
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 24.h),
        children: [
          if (editing == null && teaching.length > 1) ...[
            _Label('Class'),
            AppPickTile(
              icon: Icons.groups_rounded,
              plainIcon: true,
              label: 'Class ${c.label}',
              caption: subjects.join(', '),
              onTap: () async {
                final r = await showPickSheet<SchoolClass>(context, title: 'Class', items: teaching, label: (x) => 'Class ${x.label}', selected: c);
                if (r != null) {
                  setState(() {
                    _classId = r.id;
                    _subject = '';
                  });
                }
              },
            ),
            SizedBox(height: 14.h),
          ],
          if (subjects.length > 1) ...[
            _Label('Subject'),
            AppChoiceChips(items: subjects, value: _subject.isEmpty ? subjects.first : _subject, onChanged: (v) => setState(() => _subject = v)),
            SizedBox(height: 14.h),
          ],
          _Label('Title'),
          TextField(
            key: const ValueKey('hw-title'),
            controller: _title,
            maxLength: 100,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(hintText: 'e.g. Fractions — exercise 4.2', errorText: _titleErr, counterText: ''),
            onChanged: (_) => setState(() => _titleErr = null),
          ),
          SizedBox(height: 12.h),
          _Label('Instructions (optional)'),
          TextField(
            key: const ValueKey('hw-notes'),
            controller: _notes,
            minLines: 3,
            maxLines: 6,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(hintText: 'What to do, pages, how to hand in…'),
          ),
          SizedBox(height: 16.h),
          _Label('Due'),
          AppPickTile(
            icon: Icons.event_outlined,
            plainIcon: true,
            label: '${_wd[_due.weekday - 1]}, ${_due.day} ${_mon[_due.month - 1]} ${_due.year}',
            caption: () {
              final left = DateTime(_due.year, _due.month, _due.day).difference(DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day)).inDays;
              return left <= 0 ? 'Today' : left == 1 ? 'Tomorrow' : 'In $left days';
            }(),
            onTap: _pickDue,
          ),
          SizedBox(height: 16.h),
          _Label('Publish'),
          AppSegmented(
            items: const ['Now', 'Schedule'],
            value: _schedule ? 'Schedule' : 'Now',
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
              label: () {
                final d = _publishAt;
                final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
                return '${_wd[d.weekday - 1]}, ${d.day} ${_mon[d.month - 1]} • $h:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'AM' : 'PM'}';
              }(),
              caption: 'Parents get it and the notification then',
              onTap: _pickPublish,
            ),
            if (_scheduleErr != null) Padding(padding: EdgeInsets.only(top: 4.h), child: Text(_scheduleErr!, style: T.small.copyWith(color: C.danger))),
          ],
          SizedBox(height: 16.h),
          AppCard(
            radius: R.lg,
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 4.h),
            child: Column(
              children: [
                SwitchListTile(
                  key: const ValueKey('hw-graded'),
                  contentPadding: EdgeInsets.zero,
                  value: _graded,
                  onChanged: (v) => setState(() => _graded = v),
                  title: Text('Give marks', style: T.bodyStrong),
                  subtitle: Text(_graded ? 'Grade each student out of the marks below' : 'Not graded — mark each one as done', style: T.small),
                ),
                if (_graded)
                  Padding(
                    padding: EdgeInsets.only(bottom: 10.h),
                    child: Row(
                      children: [
                        Text('Out of', style: T.body),
                        SizedBox(width: 12.w),
                        SizedBox(
                          width: 90.w,
                          child: TextField(
                            key: const ValueKey('hw-max'),
                            controller: _marks,
                            keyboardType: TextInputType.number,
                            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4)],
                            textAlign: TextAlign.center,
                            decoration: InputDecoration(isDense: true, errorText: _marksErr),
                            onChanged: (_) => setState(() => _marksErr = null),
                          ),
                        ),
                        SizedBox(width: 8.w),
                        Text('marks', style: T.body),
                      ],
                    ),
                  ),
                Divider(height: 1, color: C.border),
                SwitchListTile(
                  key: const ValueKey('hw-late'),
                  contentPadding: EdgeInsets.zero,
                  value: _late,
                  onChanged: (v) => setState(() => _late = v),
                  title: Text('Accept late hand-ins', style: T.bodyStrong),
                  subtitle: Text(_late ? 'Hand-ins after the due day are marked late' : 'Close hand-ins yourself after the due day', style: T.small),
                ),
              ],
            ),
          ),
          SizedBox(height: 16.h),
          Row(
            children: [
              Expanded(child: _Label('Attachments')),
              TextButton.icon(onPressed: saving ? null : () => _addFiles(true), icon: Icon(Icons.photo_outlined, size: 18.r), label: const Text('Photos')),
              TextButton.icon(onPressed: saving ? null : () => _addFiles(false), icon: Icon(Icons.attach_file_rounded, size: 18.r), label: const Text('Files')),
            ],
          ),
          if (_kept.isEmpty && _picked.isEmpty) Text('Worksheets or references for the students (optional, up to 15 MB each).', style: T.small),
          for (final f in _kept)
            _AttachRow(name: f.name, size: FileRef.sizeLabel(f.bytes), image: f.isImage, onRemove: saving ? null : () => setState(() => _kept = [..._kept]..remove(f))),
          for (final f in _picked)
            _AttachRow(name: f.name, size: f.sizeLabel, image: f.isImage, isNew: true, onRemove: saving ? null : () => setState(() => _picked.remove(f))),
          SizedBox(height: 16.h),
          Container(
            padding: EdgeInsets.all(12.r),
            decoration: BoxDecoration(color: C.panel, borderRadius: BorderRadius.circular(R.lg)),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline_rounded, size: 18.r, color: C.primary),
                SizedBox(width: 8.w),
                Expanded(
                  child: Text(
                    editing == null
                        ? '${_schedule ? 'At the publish time, parents' : 'Parents'} of the $enrolled students get it in the parent app with a notification, and can hand in photos or PDFs there. '
                              'Parents who have not handed in get a reminder 2 days before it is due; you get a summary on the due day.'
                        : 'Changes show in the parent app straight away.',
                    style: T.small.copyWith(fontSize: 12.sp, color: C.ink),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(padding: EdgeInsets.only(bottom: 6.h), child: Text(text, style: T.smallStrong));
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
    decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
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
