import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/models/school_models.dart';
import '../bloc/engage_notice.dart';
import '../bloc/meetings_bloc.dart';
import '../bloc/meetings_events.dart';
import '../bloc/meetings_states.dart';
import '../models/live_class_rules.dart';
import '../models/meeting_models.dart';
import 'widgets/engage_widgets.dart';
import 'widgets/form_steps.dart';

/// In person / Online, as stored in `format`.
const meetingInPerson = 'In-Person Meeting', meetingOnline = 'Online Meeting';
bool isInPerson(Meeting m) => m.format.toLowerCase().contains('person');

/// Schedule / edit a parent-teacher meeting: class, details, where (in person or a Google Meet link), when and
/// the agenda points. Scheduling notifies the class's parents with the invitation (Cloud Function on `pm_meetings`).
class MeetingScheduleScreen extends StatelessWidget {
  const MeetingScheduleScreen({super.key, this.editId});
  final String? editId;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<MeetingsBloc>()..add(const MeetingsLoadRequested()),
    child: NoticeListener<MeetingsBloc, MeetingsState>(child: _ScheduleForm(editId: editId)),
  );
}

class _ScheduleForm extends StatefulWidget {
  const _ScheduleForm({this.editId});
  final String? editId;
  @override
  State<_ScheduleForm> createState() => _ScheduleFormState();
}

class _ScheduleFormState extends State<_ScheduleForm> {
  static const _categories = ['PTM General', 'Academic Review', 'Orientation', 'Exam Briefing'];
  static const _durations = [30, 45, 60, 90];

  final _key = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _venue = TextEditingController();
  final _link = TextEditingController();
  final _point = TextEditingController();
  final _pointFocus = FocusNode();
  String classId = '', category = _categories.first, date = plusDays(3), time = '10:00';
  bool online = false, _prefilled = false;
  int mins = 60;
  List<AgendaTopic> agenda = [];
  String? agendaErr, dateErr;

  @override
  void dispose() {
    for (final c in [_title, _venue, _link, _point]) {
      c.dispose();
    }
    _pointFocus.dispose();
    super.dispose();
  }

  void _prefill(Meeting? e) {
    _prefilled = true;
    if (e == null) return;
    _title.text = e.title;
    classId = e.classId;
    if (e.category.isNotEmpty) category = e.category;
    online = !isInPerson(e);
    _venue.text = online ? '' : e.venue;
    _link.text = online ? e.link : '';
    date = e.date;
    time = e.time;
    mins = e.mins;
    agenda = [...e.agenda];
  }

  void _defaultClass(List<SchoolClass> classes) {
    if (classes.isEmpty || classes.any((c) => c.id == classId)) return;
    classId = classes.first.id;
    if (_venue.text.isEmpty) _venue.text = classes.first.room;
  }

  void _addPoint() {
    final text = _point.text.trim();
    if (text.isEmpty) return;
    setState(() {
      agenda = [...agenda, AgendaTopic(title: text, mins: 0)];
      agendaErr = null;
      _point.clear();
    });
    _pointFocus.requestFocus();
  }

  void _save(bool draft) {
    if (_point.text.trim().isNotEmpty) _addPoint(); // a typed point counts even if Add wasn't tapped
    final school = context.read<SchoolBloc>().state;
    final now = DateTime.now().toIso8601String().substring(0, 16).replaceFirst('T', ' ');
    setState(() {
      dateErr = !draft && '$date $time'.compareTo(now) < 0 ? 'Choose a future date and time' : null;
      agendaErr = !draft && agenda.isEmpty ? 'Add at least one agenda topic' : null;
    });
    if (!(_key.currentState?.validate() ?? false) || dateErr != null || agendaErr != null) return;
    final c = school.classById(classId);
    if (c == null) return;
    context.read<MeetingsBloc>().add(
      MeetingSaved(
        Meeting(
          id: widget.editId ?? '',
          title: _title.text.trim(),
          classId: classId,
          audience: '${classLabel(c).replaceFirst('–', '-')} • All Parents',
          category: category,
          format: online ? meetingOnline : meetingInPerson,
          date: date,
          time: time,
          mins: mins,
          venue: online ? 'Google Meet' : _venue.text.trim(),
          link: online ? (normalizeMeetLink(_link.text) ?? _link.text.trim()) : '',
          agenda: agenda,
          total: c.students,
        ),
        draft: draft,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ms = context.watch<MeetingsBloc>().state;
    final school = context.watch<SchoolBloc>().state;
    if (!_prefilled && ms.status == EngageStatus.loaded) {
      _prefill(widget.editId == null ? null : ms.byId(widget.editId!));
    }
    final classes = school.classes;
    _defaultClass(classes);
    final cls = school.classById(classId);
    final parents = cls?.students ?? 0;
    return DetailScaffold(
      title: widget.editId == null ? 'Schedule Parent Meeting' : 'Edit Parent Meeting',
      actions: [
        TextButton(
          style: TextButton.styleFrom(minimumSize: Size(44.w, 44.h)),
          onPressed: () => _save(true),
          child: const Text('Save Draft'),
        ),
      ],
      bottom: AppButton('Send Invitation', icon: Icons.send_rounded, onPressed: () => _save(false)),
      body: Form(
        key: _key,
        child: ListView(
          // keep every field built: Form.validate() only checks mounted fields
          scrollCacheExtent: kFormScrollCache,
          padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 24.h),
          children: [
            _Preview(
              title: _title.text.trim().isEmpty ? 'Untitled meeting' : _title.text.trim(),
              cls: cls == null ? '' : classLabel(cls),
              when: '${fmtDate(date)} • ${fmtTime(time)} – ${fmtTime(addMins(time, mins))}',
              where: online
                  ? 'Online • Google Meet'
                  : (_venue.text.trim().isEmpty ? 'In person' : 'In person • ${_venue.text.trim()}'),
              online: online,
              points: agenda.length,
              parents: parents,
            ),
            SizedBox(height: 18.h),

            FormStep(
              n: 1,
              title: 'Class / Section',
              subtitle: parents == 0 ? 'Choose the class to invite' : 'Parents of $parents students are invited',
              icon: Icons.groups_2_outlined,
              children: [
                if (classes.isEmpty || cls == null)
                  Text('No classes assigned to you yet.', style: T.small)
                else if (classes.length <= 6)
                  AppChoiceChips(
                    items: [for (final c in classes) classLabel(c)],
                    value: classLabel(cls),
                    solid: true,
                    dense: true,
                    onChanged: (v) => setState(() => classId = classes.firstWhere((c) => classLabel(c) == v).id),
                  )
                else
                  AppDropdown<String>(
                    key: ValueKey('class_$classId'),
                    label: 'Class',
                    value: classId,
                    items: [for (final c in classes) c.id],
                    labelOf: (v) => school.classById(v) == null ? v : classLabel(school.classById(v)!),
                    onChanged: (v) => setState(() => classId = v),
                  ),
                SizedBox(height: 12.h),
                OrganizerRow(teacher: school.teacher),
              ],
            ),

            FormStep(
              n: 2,
              title: 'Meeting Details',
              subtitle: 'Title and the kind of meeting',
              icon: Icons.edit_note_rounded,
              children: [
                AppTextField(
                  label: 'Meeting Title',
                  controller: _title,
                  hint: 'e.g. Term 2 Academic Review',
                  onChanged: (_) => setState(() {}),
                  validator: (v) => (v ?? '').trim().length < 5 ? 'Enter a meeting title (min 5 characters)' : null,
                ),
                const FieldLabel('Category'),
                AppChoiceChips(
                  items: _categories,
                  value: category,
                  solid: true,
                  dense: true,
                  onChanged: (v) => setState(() => category = v.isEmpty ? category : v),
                ),
              ],
            ),

            FormStep(
              n: 3,
              title: 'Meeting Format',
              subtitle: online ? 'Parents join with the Google Meet link' : 'Parents come to school',
              icon: online ? Icons.videocam_outlined : Icons.apartment_rounded,
              children: [
                AppSegmented(
                  track: true,
                  items: const ['In person', 'Online'],
                  value: online ? 'Online' : 'In person',
                  onChanged: (v) => setState(() => online = v == 'Online'),
                ),
                SizedBox(height: 12.h),
                if (online) ...[
                  AppTextField(
                    key: const ValueKey('meet_link'),
                    label: 'Google Meet Link',
                    controller: _link,
                    hint: 'https://meet.google.com/abc-defg-hij',
                    keyboard: TextInputType.url,
                    validator: validateMeetLink,
                  ),
                  const StepHint(
                    icon: Icons.info_outline_rounded,
                    text: 'Create a meeting in Google Meet and paste its link',
                  ),
                ] else ...[
                  AppTextField(
                    key: const ValueKey('venue'),
                    label: 'Venue',
                    controller: _venue,
                    hint: 'e.g. Room 12, Main Block',
                    onChanged: (_) => setState(() {}),
                    validator: (v) => (v ?? '').trim().isEmpty ? 'Enter where parents should come' : null,
                  ),
                  const StepHint(
                    icon: Icons.notifications_active_outlined,
                    text: 'Parents get the invitation as a notification',
                  ),
                ],
              ],
            ),

            FormStep(
              n: 4,
              title: 'Date & Duration',
              subtitle: '${fmtTime(time)} – ${fmtTime(addMins(time, mins))} ($mins mins)',
              icon: Icons.schedule_rounded,
              children: [
                DateTimeFields(
                  date: date,
                  time: time,
                  year: true,
                  onDate: (v) => setState(() => date = v),
                  onTime: (v) => setState(() => time = v),
                ),
                if (dateErr != null)
                  Padding(
                    padding: EdgeInsets.only(top: 8.h),
                    child: Text(dateErr!, style: T.small.copyWith(color: C.danger)),
                  ),
                SizedBox(height: 12.h),
                const FieldLabel('Duration'),
                AppChoiceChips(
                  items: [for (final m in _durations) '$m min'],
                  value: '$mins min',
                  solid: true,
                  dense: true,
                  onChanged: (v) => setState(() => mins = int.tryParse(v.split(' ').first) ?? mins),
                ),
              ],
            ),

            FormStep(
              n: 5,
              title: 'Agenda & Discussion',
              subtitle: agenda.isEmpty
                  ? 'Add the points to discuss, one by one'
                  : '${agenda.length} ${agenda.length == 1 ? 'point' : 'points'}',
              icon: Icons.checklist_rounded,
              last: true,
              children: [
                for (var i = 0; i < agenda.length; i++)
                  _PointRow(
                    n: i + 1,
                    text: agenda[i].title,
                    onRemove: () => setState(() => agenda = [...agenda]..removeAt(i)),
                  ),
                _PointInput(controller: _point, focus: _pointFocus, n: agenda.length + 1, onAdd: _addPoint),
                if (agendaErr != null)
                  Padding(
                    padding: EdgeInsets.only(top: 8.h),
                    child: Text(agendaErr!, style: T.small.copyWith(color: C.danger)),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// One agenda point: number, text and remove.
class _PointRow extends StatelessWidget {
  const _PointRow({required this.n, required this.text, required this.onRemove});
  final int n;
  final String text;
  final VoidCallback onRemove;
  @override
  Widget build(BuildContext context) => Container(
    margin: EdgeInsets.only(bottom: 8.h),
    padding: EdgeInsets.fromLTRB(10.w, 4.h, 0, 4.h),
    decoration: BoxDecoration(
      color: C.surface,
      borderRadius: BorderRadius.circular(R.md),
      border: Border.all(color: C.border),
    ),
    child: Row(
      children: [
        _Num(n),
        SizedBox(width: 10.w),
        Expanded(
          child: Text(
            text,
            style: T.body.copyWith(color: C.ink, fontSize: 13.5.sp),
          ),
        ),
        IconButton(
          tooltip: 'Remove point',
          icon: Icon(Icons.close_rounded, size: 18.r, color: C.slate),
          onPressed: onRemove,
        ),
      ],
    ),
  );
}

/// The inline "next point" field: type and press Add (or the keyboard's done) to append it.
class _PointInput extends StatelessWidget {
  const _PointInput({required this.controller, required this.focus, required this.n, required this.onAdd});
  final TextEditingController controller;
  final FocusNode focus;
  final int n;
  final VoidCallback onAdd;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.fromLTRB(10.w, 2.h, 4.w, 2.h),
    decoration: BoxDecoration(
      color: C.bg,
      borderRadius: BorderRadius.circular(R.md),
      border: Border.all(color: C.primary.withValues(alpha: .45)),
    ),
    child: Row(
      children: [
        _Num(n, hollow: true),
        SizedBox(width: 10.w),
        Expanded(
          child: TextField(
            controller: controller,
            focusNode: focus,
            textInputAction: TextInputAction.done,
            textCapitalization: TextCapitalization.sentences,
            onSubmitted: (_) => onAdd(),
            style: T.body.copyWith(color: C.ink, fontSize: 13.5.sp),
            decoration: InputDecoration(
              isDense: true,
              border: InputBorder.none,
              hintText: n == 1 ? 'Type a discussion point' : 'Add another point',
              hintStyle: T.small.copyWith(fontSize: 13.sp),
            ),
          ),
        ),
        ValueListenableBuilder<TextEditingValue>(
          valueListenable: controller,
          builder: (_, v, _) => TextButton.icon(
            onPressed: v.text.trim().isEmpty ? null : onAdd,
            style: TextButton.styleFrom(minimumSize: Size(44.w, 40.h)),
            icon: Icon(Icons.add_rounded, size: 18.r),
            label: const Text('Add'),
          ),
        ),
      ],
    ),
  );
}

class _Num extends StatelessWidget {
  const _Num(this.n, {this.hollow = false});
  final int n;
  final bool hollow;
  @override
  Widget build(BuildContext context) => Container(
    width: 22.r,
    height: 22.r,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: hollow ? C.bg : C.primarySoft,
      shape: BoxShape.circle,
      border: hollow ? Border.all(color: C.primary.withValues(alpha: .45)) : null,
    ),
    child: Text(
      '$n',
      style: T.small.copyWith(color: C.primary, fontWeight: FontWeight.w800, fontSize: 11.sp),
    ),
  );
}

/// Live summary of the invitation parents will get.
class _Preview extends StatelessWidget {
  const _Preview({
    required this.title,
    required this.cls,
    required this.when,
    required this.where,
    required this.online,
    required this.points,
    required this.parents,
  });
  final String title, cls, when, where;
  final bool online;
  final int points, parents;
  @override
  Widget build(BuildContext context) {
    final soft = Colors.white.withValues(alpha: .8);
    Widget line(IconData i, String t) => Padding(
      padding: EdgeInsets.only(top: 6.h),
      child: Row(
        children: [
          Icon(i, size: 14.r, color: soft),
          SizedBox(width: 6.w),
          Expanded(
            child: Text(
              t,
              style: T.small.copyWith(color: Colors.white, fontSize: 12.sp),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
    return Container(
      padding: EdgeInsets.all(14.w),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [C.primary, C.primaryDark],
        ),
        borderRadius: BorderRadius.circular(R.xl),
        boxShadow: [BoxShadow(color: C.primary.withValues(alpha: .28), blurRadius: 16, offset: const Offset(0, 6))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40.r,
                height: 40.r,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .18),
                  borderRadius: BorderRadius.circular(R.md),
                ),
                child: Icon(Icons.diversity_3_rounded, color: Colors.white, size: 22.r),
              ),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: T.h3.copyWith(color: Colors.white),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      [if (cls.isNotEmpty) cls, '$parents parents'].join(' • '),
                      style: T.small.copyWith(color: soft),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 6.h),
          line(Icons.event_rounded, when),
          line(online ? Icons.videocam_outlined : Icons.place_outlined, where),
          line(
            Icons.checklist_rounded,
            points == 0 ? 'No agenda points yet' : '$points agenda ${points == 1 ? 'point' : 'points'}',
          ),
        ],
      ),
    );
  }
}
