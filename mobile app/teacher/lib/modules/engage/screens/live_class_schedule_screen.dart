import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/app_config.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/models/school_models.dart';
import '../bloc/engage_notice.dart';
import '../bloc/live_classes_bloc.dart';
import '../bloc/live_classes_events.dart';
import '../bloc/live_classes_states.dart';
import '../models/attachment_models.dart';
import '../models/live_class_models.dart';
import '../models/live_class_rules.dart';
import 'widgets/attachment_sheet.dart';
import 'widgets/engage_widgets.dart';
import 'widgets/form_steps.dart';

/// Schedule (or edit, with [editId]) a live class (Figma 1153:5033).
class LiveClassScheduleScreen extends StatelessWidget {
  const LiveClassScheduleScreen({super.key, this.editId});
  final String? editId;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<LiveClassesBloc>()..add(const LiveClassesLoadRequested()),
    child: NoticeListener<LiveClassesBloc, LiveClassesState>(child: _ScheduleForm(editId: editId)),
  );
}

class _ScheduleForm extends StatefulWidget {
  const _ScheduleForm({this.editId});
  final String? editId;
  @override
  State<_ScheduleForm> createState() => _ScheduleFormState();
}

class _ScheduleFormState extends State<_ScheduleForm> {
  final _key = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _link = TextEditingController();
  String classId = '',
      subject = '',
      category = 'Doubt Clearing',
      date = _defaultDate(),
      time = '16:30',
      medium = liveMedia(AppConfig.backend).last;
  int mins = 45;
  bool record = true, mute = true, share = false, notify = true, filled = false, calendarSync = true;

  /// Meet room created in the app for this form, and the calendar event of the session being edited.
  String meetSpace = '', calendarEventId = '', calendarLink = '';

  /// Notes already uploaded (editing) and files picked now (uploaded on save).
  List<FileRef> materials = [];
  List<PickedAttachment> files = [];
  String? dateErr;

  @override
  void dispose() {
    _title.dispose();
    _link.dispose();
    super.dispose();
  }

  /// Start on her first taught class, and keep the subject one she actually teaches there.
  void _defaultClass(List<SchoolClass> classes) {
    if (widget.editId != null || classes.isEmpty) return;
    final c = classes.where((c) => c.id == classId).firstOrNull;
    if (c == null) return _pickClass(classes.first, classes);
    if (!subjectsOf(c, classes).contains(subject)) subject = subjectsOf(c, classes).firstOrNull ?? '';
  }

  /// Subjects the teacher teaches [c] (assignments and timetable periods) — only these: the rules refuse any
  /// other subject (teaching_access anchors).
  static List<String> subjectsOf(SchoolClass? c, List<SchoolClass> all) {
    return {...?c?.subjectNames, if (c != null && c.subject.isNotEmpty) c.subject}.where((s) => s.isNotEmpty).toList();
  }

  /// Switch the target class; the subject follows it unless the current one is also taught there.
  void _pickClass(SchoolClass c, List<SchoolClass> all) {
    classId = c.id;
    final list = subjectsOf(c, all);
    if (!list.contains(subject)) subject = list.firstOrNull ?? '';
  }

  /// Google Meet: the link the teacher pasted (validated). Other media keep a generated placeholder.
  String get link => medium == 'Google Meet'
      ? (normalizeMeetLink(_link.text) ?? _link.text.trim())
      : 'https://zoom.us/j/edu-cls-${classId.split('_').last}';

  void _fill(LiveSession? e) {
    filled = true;
    if (e == null) return;
    _title.text = e.title;
    _link.text = e.medium == 'Google Meet' ? e.link : '';
    classId = e.classId;
    subject = e.subject;
    category = e.category;
    date = e.date;
    time = e.time;
    medium = e.medium;
    mins = e.mins;
    record = e.record;
    mute = e.mute;
    share = e.studentShare;
    notify = e.notify;
    materials = [...e.materials];
    meetSpace = e.meetSpace;
    calendarEventId = e.calendarEventId;
    calendarLink = e.calendarLink;
    calendarSync = e.calendarSync || e.calendarEventId.isNotEmpty;
  }

  void _save(bool draft) {
    final now = DateTime.now().toIso8601String().substring(0, 16).replaceFirst('T', ' ');
    final past = !draft && '$date $time'.compareTo(now) < 0;
    setState(() => dateErr = past ? 'Pick a start time in the future' : null);
    if (!(_key.currentState?.validate() ?? false) || past) return;
    final c = context.read<SchoolBloc>().state.classById(classId);
    if (c == null || subject.isEmpty) return;
    context.read<LiveClassesBloc>().add(
      LiveSessionSaved(
        LiveSession(
          id: widget.editId ?? '',
          title: _title.text.trim(),
          classId: classId,
          audience: '${classLabel(c)} (${c.students} Students)',
          subject: subject,
          category: category,
          date: date,
          time: time,
          mins: mins,
          medium: medium,
          link: medium == 'In-App Live' ? '' : link,
          record: record,
          mute: mute,
          studentShare: share,
          notify: notify,
          materials: materials,
          total: c.students,
          meetSpace: medium == 'Google Meet' ? meetSpace : '',
          calendarEventId: calendarEventId,
          calendarLink: calendarLink,
          calendarSync: AppConfig.googleMeetIntegration && medium == 'Google Meet' && calendarSync,
        ),
        draft: draft,
        files: [...files],
      ),
    );
  }

  /// "4:30 PM – 5:15 PM" from the start time and duration.
  String get _span {
    final parts = time.split(':');
    final startMin = (int.tryParse(parts.first) ?? 0) * 60 + (int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0);
    final endMin = (startMin + mins) % (24 * 60);
    String hhmm(int m) => '${(m ~/ 60).toString().padLeft(2, '0')}:${(m % 60).toString().padLeft(2, '0')}';
    return '${fmtTime(time)} – ${fmtTime(hhmm(endMin))}';
  }

  @override
  Widget build(BuildContext context) {
    final st = context.watch<LiveClassesBloc>().state;
    if (!filled && widget.editId != null && st.status == EngageStatus.loaded) _fill(st.byId(widget.editId!));
    final school = context.watch<SchoolBloc>().state;
    // classes she teaches a subject in (class-teacher-only or exam-only classes can't host a session)
    final classes = [
      for (final c in school.classes)
        if (subjectsOf(c, school.classes).isNotEmpty || c.id == classId && widget.editId != null) c,
    ];
    _defaultClass(classes);
    final cls = school.classById(classId);
    // only what the teacher teaches this class; a session edited with another subject keeps it visible
    final subjects = [
      ...subjectsOf(cls, classes),
      if (widget.editId != null && subject.isNotEmpty && !subjectsOf(cls, classes).contains(subject)) subject,
    ];
    final students = cls?.students ?? 0;
    final editing = widget.editId != null;
    return BlocListener<LiveClassesBloc, LiveClassesState>(
      listenWhen: (a, b) => b.meeting != null && a.meeting != b.meeting,
      listener: (_, s) => setState(() {
        _link.text = s.meeting!.uri;
        meetSpace = s.meeting!.space;
      }),
      child: DetailScaffold(
        title: editing ? 'Edit Live Class' : 'Schedule Live Class',
        actions: [
          TextButton(
            style: TextButton.styleFrom(minimumSize: Size(44.w, 44.h)),
            onPressed: () => _save(true),
            child: const Text('Save Draft'),
          ),
        ],
        bottom: AppButton(
          st.uploading > 0
              ? 'Uploading notes…'
              : notify
              ? 'Schedule & Send'
              : 'Schedule',
          icon: Icons.send_rounded,
          busy: st.uploading > 0,
          onPressed: () => _save(false),
        ),
        body: Form(
          key: _key,
          child: ListView(
            // keep every field built: Form.validate() only checks mounted fields, so a field scrolled out of a lazy list
            // would be skipped and an invalid value saved
            scrollCacheExtent: kFormScrollCache,
            padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 24.h),
            children: [
              // ---- live summary of what will be scheduled
              _SummaryCard(
                title: _title.text.trim().isEmpty ? 'Untitled session' : _title.text.trim(),
                cls: cls == null ? '' : classLabel(cls),
                subject: subject,
                category: category,
                date: date,
                span: _span,
                mins: mins,
                medium: medium,
                students: students,
                notify: notify,
              ),
              SizedBox(height: 18.h),

              // ---- 1. who
              FormStep(
                n: 1,
                title: 'Target Class & Section',
                subtitle: students == 0
                    ? 'Choose the class to invite'
                    : '$students students and their parents will be invited',
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
                      onChanged: (v) =>
                          setState(() => _pickClass(classes.firstWhere((c) => classLabel(c) == v), classes)),
                    )
                  else
                    AppDropdown<String>(
                      key: ValueKey('class_$classId'),
                      label: 'Class',
                      value: classId,
                      items: [for (final c in classes) c.id],
                      labelOf: (v) => school.classById(v) == null ? v : classLabel(school.classById(v)!),
                      onChanged: (v) => setState(() => _pickClass(classes.firstWhere((c) => c.id == v), classes)),
                    ),
                  SizedBox(height: 12.h),
                  OrganizerRow(teacher: school.teacher),
                ],
              ),

              // ---- 2. what
              FormStep(
                n: 2,
                title: 'Class Details',
                subtitle: 'Subject, title and the kind of session',
                icon: Icons.menu_book_outlined,
                children: [
                  const FieldLabel('Subject'),
                  AppChoiceChips(
                    items: subjects,
                    value: subject,
                    solid: true,
                    dense: true,
                    onChanged: (v) => setState(() => subject = v),
                  ),
                  SizedBox(height: 12.h),
                  AppTextField(
                    label: 'Class / Session Title',
                    controller: _title,
                    maxLines: 2,
                    hint: 'e.g. Quadratic Equations Doubt Clearing',
                    onChanged: (_) => setState(() {}),
                    validator: (v) => (v ?? '').trim().length < 5 ? 'Enter a session title (min 5 characters)' : null,
                  ),
                  const FieldLabel('Session Category'),
                  AppChoiceChips(
                    items: const ['Doubt Clearing', 'Masterclass', 'Revision & Quiz', 'Exam Prep'],
                    value: category,
                    dense: true,
                    onChanged: (v) => setState(() => category = v),
                  ),
                ],
              ),

              // ---- 3. when
              FormStep(
                n: 3,
                title: 'Date & Time',
                subtitle: '${fmtDate(date)} • $_span',
                icon: Icons.schedule_rounded,
                children: [
                  DateTimeFields(
                    date: date,
                    time: time,
                    onDate: (v) => setState(() => date = v),
                    onTime: (v) => setState(() => time = v),
                  ),
                  if (dateErr != null)
                    Padding(
                      padding: EdgeInsets.only(top: 8.h),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline_rounded, size: 16.r, color: C.danger),
                          SizedBox(width: 6.w),
                          Expanded(
                            child: Text(
                              dateErr!,
                              style: T.small.copyWith(color: C.danger, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
                  SizedBox(height: 12.h),
                  const FieldLabel('Duration'),
                  AppSegmented(
                    items: const ['30m', '45m', '60m', '90m'],
                    value: '${mins}m',
                    onChanged: (v) => setState(() => mins = int.parse(v.replaceAll('m', ''))),
                  ),
                ],
              ),

              // ---- 4. where
              FormStep(
                n: 4,
                title: 'Delivery',
                subtitle: medium == 'Google Meet' ? 'Parents join with the Meet link' : 'Link is generated for you',
                icon: Icons.videocam_outlined,
                children: [
                  if (liveMedia(AppConfig.backend).length > 1) ...[
                    AppChoiceChips(
                      items: liveMedia(AppConfig.backend),
                      value: medium,
                      onChanged: (v) => setState(() => medium = v),
                    ),
                    SizedBox(height: 12.h),
                  ],
                  if (medium == 'Google Meet') ...[
                    AppTextField(
                      label: 'Google Meet link',
                      controller: _link,
                      hint: 'https://meet.google.com/abc-defg-hij',
                      keyboard: TextInputType.url,
                      validator: validateMeetLink,
                      onChanged: (_) => setState(() => meetSpace = ''),
                    ),
                    // Create Google Meet + Google Calendar: off until the Google OAuth consent screen is set up
                    if (AppConfig.googleMeetIntegration) ...[
                      AppButton(
                        meetSpace.isEmpty ? 'Create Google Meet' : 'Create a new Google Meet',
                        key: const Key('create_meet'),
                        icon: Icons.video_call_outlined,
                        kind: BtnKind.outline,
                        busy: st.meetBusy,
                        onPressed: () => context.read<LiveClassesBloc>().add(const LiveMeetCreateRequested()),
                      ),
                      SizedBox(height: 6.h),
                      Text(
                        meetSpace.isNotEmpty
                            ? 'Created with your Google account. Anyone with the link can join.'
                            : 'Create a room with your Google account, or paste a link from Google Meet.',
                        style: T.small,
                      ),
                      SizedBox(height: 10.h),
                      AppToggleRow(
                        title: 'Add to my Google Calendar',
                        subtitle: calendarEventId.isEmpty
                            ? 'With a 10-minute reminder'
                            : 'Already on your calendar; changes are updated',
                        value: calendarSync,
                        onChanged: (v) => setState(() => calendarSync = v),
                      ),
                    ] else
                      StepHint(
                        icon: Icons.info_outline_rounded,
                        text: 'Create the meeting in Google Meet and paste its link here.',
                      ),
                  ] else
                    StepHint(
                      icon: Icons.link_rounded,
                      text: medium == 'In-App Live' ? 'In-app room, no link needed.' : link,
                      strong: medium != 'In-App Live',
                    ),
                ],
              ),

              // ---- 5. material
              FormStep(
                n: 5,
                title: 'Classroom Material',
                subtitle: materials.isEmpty && files.isEmpty
                    ? 'Optional worksheets or notes, up to 15 MB each'
                    : '${materials.length + files.length} ${materials.length + files.length == 1 ? 'file' : 'files'} attached',
                icon: Icons.attach_file_rounded,
                last: true,
                children: [
                  for (var i = 0; i < materials.length; i++)
                    Padding(
                      padding: EdgeInsets.only(bottom: 8.h),
                      child: AppFileChip(
                        name: materials[i].name,
                        size: materials[i].size,
                        sub: 'Uploaded • tap to open',
                        onTap: materials[i].url.startsWith('http') ? () => openFileRef(context, materials[i]) : null,
                        trailing: IconButton(
                          tooltip: 'Remove file',
                          onPressed: () => setState(() => materials = [...materials]..removeAt(i)),
                          icon: Icon(Icons.close_rounded, size: 18.r),
                        ),
                      ),
                    ),
                  for (var i = 0; i < files.length; i++)
                    Padding(
                      padding: EdgeInsets.only(bottom: 8.h),
                      child: AppFileChip(
                        name: files[i].name,
                        size: files[i].sizeLabel,
                        sub: 'Uploads when you schedule',
                        icon: files[i].isImage ? Icons.image_outlined : null,
                        tone: files[i].isImage ? Tone.purple : Tone.danger,
                        trailing: IconButton(
                          tooltip: 'Remove file',
                          onPressed: () => setState(() => files = [...files]..removeAt(i)),
                          icon: Icon(Icons.close_rounded, size: 18.r),
                        ),
                      ),
                    ),
                  AppButton(
                    materials.isEmpty && files.isEmpty ? 'Attach worksheet / notes' : 'Attach more',
                    icon: Icons.upload_file_outlined,
                    kind: BtnKind.outline,
                    onPressed: () async {
                      final picked = await pickDocuments();
                      final ok = picked.where((f) => f.bytes <= kMaxAttachmentBytes).toList();
                      if (!context.mounted) return;
                      if (ok.length < picked.length) {
                        showNotice(context, '${picked.length - ok.length} file(s) over 15 MB were skipped');
                      }
                      if (ok.isNotEmpty) setState(() => files = [...files, ...ok]);
                    },
                  ),
                ],
              ),

              SizedBox(height: 6.h),
              AppToggleRow(
                title: 'Notify $students Students & Parents',
                subtitle: 'In-app push the moment it is scheduled',
                value: notify,
                tinted: true,
                onChanged: (v) => setState(() => notify = v),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// What will be scheduled, updated as the form changes: title, class and subject, date, time span and medium.
class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.title,
    required this.cls,
    required this.subject,
    required this.category,
    required this.date,
    required this.span,
    required this.mins,
    required this.medium,
    required this.students,
    required this.notify,
  });
  final String title, cls, subject, category, date, span, medium;
  final int mins, students;
  final bool notify;
  @override
  Widget build(BuildContext context) => Container(
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
              child: Icon(Icons.cast_for_education_rounded, color: Colors.white, size: 22.r),
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
                    [if (cls.isNotEmpty) cls, subject, category].join(' • '),
                    style: T.small.copyWith(color: Colors.white70),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        SizedBox(height: 12.h),
        Wrap(
          spacing: 8.w,
          runSpacing: 6.h,
          children: [
            _Tag(Icons.calendar_today_rounded, fmtDate(date)),
            _Tag(Icons.schedule_rounded, span),
            _Tag(Icons.timer_outlined, '$mins min'),
            _Tag(Icons.videocam_rounded, medium),
            _Tag(
              notify ? Icons.notifications_active_outlined : Icons.notifications_off_outlined,
              notify ? '$students invited' : 'No notification',
            ),
          ],
        ),
      ],
    ),
  );
}

class _Tag extends StatelessWidget {
  const _Tag(this.icon, this.text);
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(horizontal: 9.w, vertical: 5.h),
    decoration: BoxDecoration(color: Colors.white.withValues(alpha: .16), borderRadius: BorderRadius.circular(R.pill)),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13.r, color: Colors.white),
        SizedBox(width: 5.w),
        Text(
          text,
          style: T.small.copyWith(color: Colors.white, fontWeight: FontWeight.w600),
        ),
      ],
    ),
  );
}

/// One numbered step of the form: a badge with a connector line, title, subtitle and the fields in a panel.
/// Delivery media offered in the schedule form. On the shared backend only Google Meet is offered (contract §6): parents
/// join with the link, and the other media have no real link (the local demo keeps them, the in-app room is simulated).
/// The last item is the default.
List<String> liveMedia(BackendType backend) =>
    backend == BackendType.firebase ? const ['Google Meet'] : const ['Google Meet', 'Zoom', 'In-App Live'];

/// Today, unless the default 16:30 start has already passed (then tomorrow).
String _defaultDate() {
  final n = DateTime.now();
  return n.hour * 60 + n.minute >= 16 * 60 + 30 ? plusDays(1) : plusDays(0);
}
