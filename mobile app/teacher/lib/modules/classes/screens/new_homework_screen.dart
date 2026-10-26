import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/models/school_models.dart';
import '../../tasks/models/homework_models.dart';
import '../bloc/new_homework_bloc.dart';
import '../bloc/new_homework_events.dart';
import '../bloc/new_homework_states.dart';
import '../models/student_metrics.dart';
import 'widgets/classes_ui.dart';

const _formatOptions = [('Handwritten Paper (Photo/Scan)', 'Up to 5 images per student'), ('In-Class Physical Notebook', 'Desk verification during roll call')];

/// Figma 1153:11677 "3.4 New Homework". Creates homework only through IHomeworkRepository (tasks module).
class NewHomeworkScreen extends StatelessWidget {
  const NewHomeworkScreen({super.key, this.classId});
  final String? classId;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<NewHomeworkBloc>()..add(const NewHomeworkLoadRequested()),
        child: BlocListener<NewHomeworkBloc, NewHomeworkState>(
          listenWhen: (a, b) => a.status != b.status && (b.status == NewHomeworkStatus.saved || b.status == NewHomeworkStatus.failure),
          listener: (ctx, s) {
            AppDialogs.showSnackBar(ctx, message: s.message ?? '', isError: s.status == NewHomeworkStatus.failure);
            if (s.status == NewHomeworkStatus.saved) ctx.canPop() ? ctx.pop() : ctx.go(RoutePaths.classes);
          },
          child: _NewHomeworkForm(classId: classId),
        ),
      );
}

class _NewHomeworkForm extends StatefulWidget {
  const _NewHomeworkForm({this.classId});
  final String? classId;
  @override
  State<_NewHomeworkForm> createState() => _NewHomeworkFormState();
}

class _NewHomeworkFormState extends State<_NewHomeworkForm> {
  late String? _classId = widget.classId;
  final _title = TextEditingController();
  final _desc = TextEditingController();
  final _marks = TextEditingController(text: '25');
  String? _topic;
  int _days = 1;
  final _formats = <String>{_formatOptions.first.$1};
  String? _attachment;
  DateTime _due = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _cutoff = const TimeOfDay(hour: 17, minute: 0);
  bool _late = false, _notify = true;
  String? _titleErr, _marksErr, _dueErr;

  @override
  void dispose() {
    _title.dispose();
    _desc.dispose();
    _marks.dispose();
    super.dispose();
  }

  DateTime get _dueAt => DateTime(_due.year, _due.month, _due.day, _cutoff.hour, _cutoff.minute);

  String _code(SchoolClass c, int existing) => 'HW-${subjectCode(c)}-${c.grade}${c.section}-${(existing + 1).toString().padLeft(2, '0')}';

  Future<void> _switch(List<SchoolClass> classes, Map<String, int> enrolled) async {
    final c = await showPickSheet<SchoolClass>(
      context, title: 'Switch class', items: classes, label: (c) => 'Class ${clsLong(c)} • ${c.subject}',
      sub: (c) => '${enrolled[c.id] ?? 0} Enrolled • ${c.room}', selected: classes.where((x) => x.id == _classId).firstOrNull,
    );
    if (c != null) {
      setState(() {
        _classId = c.id;
        _topic = null;
      });
    }
  }

  void _rephrase() {
    var t = _desc.text.trim();
    if (t.isEmpty) {
      showNotice(context, 'Write some instructions first');
      return;
    }
    t = t.replaceAll(RegExp(r'\s+'), ' ');
    t = t[0].toUpperCase() + t.substring(1);
    if (!RegExp(r'[.!?]$').hasMatch(t)) t = '$t.';
    setState(() => _desc.text = t);
    showNotice(context, 'Instructions polished');
  }

  bool _validate() {
    final m = int.tryParse(_marks.text.trim());
    setState(() {
      _titleErr = _title.text.trim().isEmpty ? 'Enter an assignment title' : null;
      _marksErr = (m == null || m <= 0) ? 'Enter marks greater than 0' : null;
      _dueErr = _dueAt.isBefore(DateTime.now()) ? 'Deadline must be in the future' : null;
    });
    return _titleErr == null && _marksErr == null && _dueErr == null;
  }

  void _save(SchoolClass c, {required bool publish, required String code, required String topic, required int enrolled}) {
    if (publish ? !_validate() : _title.text.trim().isEmpty) {
      if (!publish) setState(() => _titleErr = 'Enter a title to save a draft');
      return;
    }
    context.read<NewHomeworkBloc>().add(NewHomeworkSubmitted(
          Homework(
            id: '', classId: c.id, title: _title.text.trim(), subject: c.subject, due: isoOf(_due), maxMarks: int.tryParse(_marks.text.trim()) ?? 0,
            description: _desc.text.trim(), status: publish ? 'open' : 'draft', createdAt: nowIso(),
            extra: {
              'code': code, 'topic': topic, 'estDays': _days, 'formats': _formats.toList(), 'attachment': _attachment,
              'allowLate': _late, 'notify': _notify, 'dueTime': hhmm(_cutoff), 'dueAt': _dueAt.toIso8601String(),
            },
          ),
          enrolled: enrolled,
        ));
  }

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final hs = context.watch<NewHomeworkBloc>().state;
    final c = classOr(school.classes, _classId);
    if (c == null) return DetailScaffold(title: 'NEW HOMEWORK', fallbackRoute: RoutePaths.classes, body: const AppEmptyState('No classes assigned', icon: Icons.class_outlined));
    final enrolled = school.studentsOf(c.id).length;
    final code = _code(c, hs.countFor(c.id));
    final topics = <String>['Chapter 4: ${c.topic}', if (c.topic != 'Linear Equations') 'Linear Equations', 'Arithmetic Progressions'];
    final topic = _topic ?? topics.first;
    final now = DateTime.now();
    final diff = DateTime(_due.year, _due.month, _due.day).difference(DateTime(now.year, now.month, now.day)).inDays;
    final busy = hs.status == NewHomeworkStatus.saving;

    return DetailScaffold(
      title: 'NEW HOMEWORK', fallbackRoute: RoutePaths.classes,
      bottom: Row(children: [
        AppButton('Save Draft', icon: Icons.bookmark_border_rounded, kind: BtnKind.outline, expand: false,
            onPressed: busy ? null : () => _save(c, publish: false, code: code, topic: topic, enrolled: enrolled)),
        SizedBox(width: 10.w),
        Expanded(child: AppButton('Publish HW', icon: Icons.send_rounded, busy: busy, onPressed: () => _save(c, publish: true, code: code, topic: topic, enrolled: enrolled))),
      ]),
      body: ListView(padding: EdgeInsets.fromLTRB(16.w, 14.h, 16.w, 30.h), children: [
        AppCard(
          radius: R.xl, padding: EdgeInsets.all(14.w),
          child: Row(children: [
            const IconTile(Icons.calculate_outlined, size: 48),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Class ${clsLong(c)} • ${c.subject}', style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis),
                SizedBox(height: 4.h),
                const Pill('SECURED', tone: Tone.brand),
                SizedBox(height: 4.h),
                Text('$enrolled Enrolled • ${c.room} • ${c.wing}', style: T.small),
              ]),
            ),
            AppButton('Switch', icon: Icons.swap_horiz_rounded, kind: BtnKind.soft, small: true, expand: false,
                onPressed: () => _switch(school.classes, {for (final x in school.classes) x.id: school.studentsOf(x.id).length})),
          ]),
        ),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.xl, padding: EdgeInsets.all(14.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Pill(code, icon: Icons.tag_rounded)),
              SizedBox(width: 8.w),
              const Flexible(child: Pill('Term 2 Curriculum', tone: Tone.neutral)),
              const Spacer(),
              Text('${_title.text.length}/100', style: T.small),
            ]),
            SizedBox(height: 10.h),
            Text('ASSIGNMENT TITLE', style: T.capsMuted),
            SizedBox(height: 6.h),
            TextField(
              controller: _title, maxLength: 100, onChanged: (_) => setState(() => _titleErr = null),
              decoration: InputDecoration(
                hintText: 'e.g. Quadratic Equations — Practice Set 5', counterText: '', errorText: _titleErr,
                suffixIcon: _title.text.isEmpty ? null : IconButton(tooltip: 'Clear title', icon: Icon(Icons.cancel_outlined, size: 20.r), onPressed: () => setState(_title.clear)),
              ),
            ),
            SizedBox(height: 10.h),
            Row(children: [
              Expanded(child: Text('LINKED SYLLABUS TOPIC', style: T.capsMuted)),
              TextButton(
                onPressed: () => showNotice(context, 'Syllabus: ${topics.length} topics for ${clsName(c)}'),
                style: TextButton.styleFrom(minimumSize: Size(44.r, 44.r)),
                child: Text('Browse all', style: T.smallStrong.copyWith(color: C.primary)),
              ),
            ]),
            AppChoiceChips(items: topics, value: topic, solid: true, onChanged: (v) => setState(() => _topic = v)),
          ]),
        ),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.xl, padding: EdgeInsets.all(14.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.edit_note_rounded, color: C.primary, size: 24.r),
              SizedBox(width: 8.w),
              Expanded(child: Text('Instructions & Guidelines', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
              AppButton('AI Rephrase', icon: Icons.auto_awesome_rounded, kind: BtnKind.soft, small: true, expand: false, onPressed: _rephrase),
            ]),
            SizedBox(height: 10.h),
            TextField(controller: _desc, maxLines: 5, minLines: 4, decoration: const InputDecoration(hintText: 'Describe the task, exercises and expectations...')),
            SizedBox(height: 8.h),
            Row(children: [
              Icon(Icons.info_outline_rounded, size: 16.r, color: C.primary),
              SizedBox(width: 6.w),
              Expanded(child: Text('Students will see these notes under their task timeline.', style: T.small)),
            ]),
          ]),
        ),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.xl, padding: EdgeInsets.all(14.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Icon(Icons.star_border_rounded, color: C.primary, size: 24.r), SizedBox(width: 8.w), Text('Grading & Targets', style: T.h3)]),
            SizedBox(height: 10.h),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: AppTextField(label: 'Total Max Marks', controller: _marks, keyboard: TextInputType.number, onChanged: (_) => setState(() => _marksErr = null))),
              SizedBox(width: 10.w),
              Expanded(
                child: Container(
                  padding: EdgeInsets.all(12.r), decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Submissions Target', style: T.smallStrong.copyWith(color: C.slate), maxLines: 1, overflow: TextOverflow.ellipsis),
                    FittedBox(
                      fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                      child: Text.rich(TextSpan(children: [TextSpan(text: '$enrolled', style: T.stat), TextSpan(text: ' Students', style: T.small)])),
                    ),
                    Row(children: [
                      Container(width: 6.r, height: 6.r, decoration: const BoxDecoration(color: C.success, shape: BoxShape.circle)),
                      SizedBox(width: 4.w),
                      Flexible(child: Text('All Batches Active', style: T.small.copyWith(fontSize: 11.sp, color: C.successDark), overflow: TextOverflow.ellipsis)),
                    ]),
                  ]),
                ),
              ),
            ]),
            if (_marksErr != null) Text(_marksErr!, style: T.small.copyWith(color: C.danger)),
            SizedBox(height: 6.h),
            Text('EST. TIME TO COMPLETE', style: T.capsMuted),
            SizedBox(height: 6.h),
            AppChoiceChips(items: const ['1 day', '2 day', '3 day', '4 day'], value: '$_days day', onChanged: (v) => setState(() => _days = int.parse(v[0]))),
          ]),
        ),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.xl, padding: EdgeInsets.all(14.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Expanded(child: Text('Allowed Submission Formats', style: T.h3)), Text('Max 15 MB', style: T.small)]),
            for (final f in _formatOptions)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.trailing, value: _formats.contains(f.$1),
                title: Text(f.$1, style: T.bodyStrong), subtitle: Text(f.$2, style: T.small),
                onChanged: (v) => setState(() => v == true ? _formats.add(f.$1) : _formats.remove(f.$1)),
              ),
            Divider(color: C.border, height: 16.h),
            if (_attachment != null)
              ListTile(
                contentPadding: EdgeInsets.zero, leading: const IconTile(Icons.picture_as_pdf_rounded, tone: Tone.danger, size: 40),
                title: Text(_attachment!, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis), subtitle: Text('1.4 MB • Preview ready', style: T.small),
                trailing: IconAction(Icons.close_rounded, 'Remove attachment', () => setState(() => _attachment = null)),
              )
            else
              AppButton(
                'Attach Reference Sheet / Hint Key (Optional)', icon: Icons.attach_file_rounded, kind: BtnKind.outline, small: true,
                onPressed: () => setState(() => _attachment = '${_title.text.trim().isEmpty ? 'Reference_Sheet' : _title.text.trim().replaceAll(RegExp(r'\W+'), '_')}.pdf'),
              ),
          ]),
        ),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.xl, padding: EdgeInsets.all(14.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('Deadline & Submissions Window', style: T.h3, maxLines: 2)),
              Pill(diff <= 0 ? 'Today' : '$diff ${diff == 1 ? 'day' : 'days'} left', tone: Tone.warning),
            ]),
            SizedBox(height: 10.h),
            Row(children: [
              Expanded(
                child: AppPickTile(
                  icon: Icons.calendar_today_rounded, plainIcon: true, caption: 'Due Date', label: DateFormat('d MMM yyyy').format(_due),
                  onTap: () async {
                    final d = await showDatePicker(context: context, initialDate: _due.isBefore(now) ? now : _due, firstDate: now, lastDate: now.add(const Duration(days: 365)));
                    if (d == null) return;
                    setState(() {
                      _due = d;
                      _dueErr = null;
                    });
                  },
                ),
              ),
              SizedBox(width: 10.w),
              Expanded(
                child: AppPickTile(
                  icon: Icons.schedule_rounded, plainIcon: true, caption: 'Cut-off Time', label: _cutoff.format(context),
                  onTap: () async {
                    final t = await showTimePicker(context: context, initialTime: _cutoff);
                    if (t == null) return;
                    setState(() {
                      _cutoff = t;
                      _dueErr = null;
                    });
                  },
                ),
              ),
            ]),
            if (_dueErr != null) Padding(padding: EdgeInsets.only(top: 6.h), child: Text(_dueErr!, style: T.small.copyWith(color: C.danger))),
            SizedBox(height: 10.h),
            AppToggleRow(title: 'Accept late submissions', subtitle: 'Penalty applies (-2 marks / day late)', value: _late, onChanged: (v) => setState(() => _late = v)),
          ]),
        ),
        SizedBox(height: 14.h),
        Text('Alerts & Collaboration', style: T.h3),
        SizedBox(height: 8.h),
        AppToggleRow(
          title: 'Instant Push & WhatsApp Alert', subtitle: 'Dispatches assignment brief directly to $enrolled students & parent registered phones.',
          value: _notify, onChanged: (v) => setState(() => _notify = v),
        ),
      ]),
    );
  }
}
