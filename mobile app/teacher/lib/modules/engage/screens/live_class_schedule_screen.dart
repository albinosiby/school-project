import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/app_config.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/engage_notice.dart';
import '../bloc/live_classes_bloc.dart';
import '../bloc/live_classes_events.dart';
import '../bloc/live_classes_states.dart';
import '../models/attachment_models.dart';
import '../models/live_class_models.dart';
import '../models/live_class_rules.dart';
import 'widgets/engage_widgets.dart';

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
  String classId = 'cls_10B', subject = 'Mathematics', category = 'Doubt Clearing', date = _defaultDate(), time = '16:30', medium = 'In-App Live';
  int mins = 45;
  bool record = true, mute = true, share = false, notify = true, filled = false, calendarSync = true;

  /// Meet room created in the app for this form, and the calendar event of the session being edited.
  String meetSpace = '', calendarEventId = '', calendarLink = '';
  FileRef? material;
  String? dateErr;

  @override
  void dispose() {
    _title.dispose();
    _link.dispose();
    super.dispose();
  }

  /// Google Meet: the link the teacher pasted (validated). Other media keep a generated placeholder.
  String get link => medium == 'Google Meet' ? (normalizeMeetLink(_link.text) ?? _link.text.trim()) : 'https://zoom.us/j/edu-cls-${classId.split('_').last}';

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
    material = e.material;
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
    if (c == null) return;
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
          material: material,
          total: c.students,
          meetSpace: medium == 'Google Meet' ? meetSpace : '',
          calendarEventId: calendarEventId,
          calendarLink: calendarLink,
          calendarSync: AppConfig.googleMeetIntegration && medium == 'Google Meet' && calendarSync,
        ),
        draft: draft,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final st = context.watch<LiveClassesBloc>().state;
    if (!filled && widget.editId != null && st.status == EngageStatus.loaded) _fill(st.byId(widget.editId!));
    final school = context.watch<SchoolBloc>().state;
    final classes = school.classes;
    final cls = school.classById(classId);
    final students = cls?.students ?? 0;
    return BlocListener<LiveClassesBloc, LiveClassesState>(
      listenWhen: (a, b) => b.meeting != null && a.meeting != b.meeting,
      listener: (_, s) => setState(() {
        _link.text = s.meeting!.uri;
        meetSpace = s.meeting!.space;
      }),
      child: DetailScaffold(
        title: widget.editId == null ? 'Schedule Live Class' : 'Edit Live Class',
        actions: [
          TextButton(
            style: TextButton.styleFrom(minimumSize: Size(44.w, 44.h)),
            onPressed: () => _save(true),
            child: const Text('Save Draft'),
          ),
        ],
        bottom: AppButton(notify ? 'Schedule & Send' : 'Schedule', icon: Icons.send_rounded, onPressed: () => _save(false)),
        body: Form(
          key: _key,
          child: ListView(
            padding: EdgeInsets.all(S.page),
            children: [
              Row(
                children: [
                  const IconTile(Icons.cast_for_education_outlined, size: 34),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'VIRTUAL CLASSROOM HUB',
                          style: T.capsMuted.copyWith(fontSize: 10.sp),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(widget.editId == null ? 'Schedule Live Class' : 'Edit Live Class', style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
                  const Pill('Term 2 Active', tone: Tone.neutral, dot: true),
                ],
              ),
              SizedBox(height: 14.h),
              FormCard(
                title: 'Target Class & Section',
                icon: Icons.groups_2_outlined,
                children: [
                  if (classes.isNotEmpty && cls != null)
                    AppDropdown<String>(
                      key: ValueKey('class_$classId'),
                      label: 'Class',
                      value: classId,
                      items: [for (final c in classes) c.id],
                      labelOf: (v) => school.classById(v) == null ? v : classLabel(school.classById(v)!),
                      onChanged: (v) => setState(() => classId = v),
                    ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Pill('$students Students & Parents', tone: Tone.brand),
                  ),
                  SizedBox(height: 10.h),
                  OrganizerRow(teacher: school.teacher),
                ],
              ),
              FormCard(
                title: 'Class Details',
                icon: Icons.menu_book_outlined,
                children: [
                  const FieldLabel('Subject'),
                  AppChoiceChips(items: const ['Mathematics', 'Physics', 'Science Remedial'], value: subject, solid: true, onChanged: (v) => setState(() => subject = v)),
                  SizedBox(height: 12.h),
                  AppTextField(
                    label: 'Class / Session Title',
                    controller: _title,
                    maxLines: 2,
                    hint: 'e.g. Quadratic Equations Doubt Clearing',
                    validator: (v) => (v ?? '').trim().length < 5 ? 'Enter a session title (min 5 characters)' : null,
                  ),
                  const FieldLabel('Session Category'),
                  AppChoiceChips(items: const ['Doubt Clearing', 'Masterclass', 'Revision & Quiz', 'Exam Prep'], value: category, onChanged: (v) => setState(() => category = v)),
                ],
              ),
              FormCard(
                title: 'Schedule Time & Duration',
                icon: Icons.schedule_rounded,
                children: [
                  DateTimeFields(date: date, time: time, onDate: (v) => setState(() => date = v), onTime: (v) => setState(() => time = v)),
                  if (dateErr != null)
                    Padding(
                      padding: EdgeInsets.only(top: 8.h),
                      child: Text(dateErr!, style: T.small.copyWith(color: C.danger)),
                    ),
                  SizedBox(height: 12.h),
                  const FieldLabel('Allocated Duration'),
                  AppSegmented(items: const ['30m', '45m', '60m', '90m'], value: '${mins}m', onChanged: (v) => setState(() => mins = int.parse(v.replaceAll('m', '')))),
                ],
              ),
              FormCard(
                title: 'Class Delivery Medium',
                icon: Icons.videocam_outlined,
                children: [
                  AppChoiceChips(items: const ['Google Meet', 'Zoom', 'In-App Live'], value: medium, onChanged: (v) => setState(() => medium = v)),
                  SizedBox(height: 10.h),
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
                        subtitle: calendarEventId.isEmpty ? 'With a 10-minute reminder' : 'Already on your calendar; changes are updated',
                        value: calendarSync,
                        onChanged: (v) => setState(() => calendarSync = v),
                      ),
                    ] else
                      Text('Create the meeting in Google Meet and paste its link here.', style: T.small),
                  ] else
                    Container(
                      width: double.infinity,
                      padding: EdgeInsets.all(12.w),
                      decoration: BoxDecoration(
                        color: C.surface,
                        borderRadius: BorderRadius.circular(R.md),
                        border: Border.all(color: C.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Virtual Classroom Stream • Auto-Generated', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                          Text(
                            medium == 'In-App Live' ? 'In-app room (no link needed)' : link,
                            style: T.bodyStrong.copyWith(fontSize: 12.5.sp, color: C.primary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  SizedBox(height: 10.h),
                  AppToggleRow(
                    title: 'Auto-record session',
                    subtitle: 'Directly archive to Past Recordings library',
                    value: record,
                    margin: EdgeInsets.only(bottom: 8.h),
                    onChanged: (v) => setState(() => record = v),
                  ),
                  AppToggleRow(
                    title: 'Mute participants upon entry',
                    subtitle: 'Maintain classroom decorum at start',
                    value: mute,
                    margin: EdgeInsets.only(bottom: 8.h),
                    onChanged: (v) => setState(() => mute = v),
                  ),
                  AppToggleRow(title: 'Allow student screen sharing', subtitle: 'Only educator can present by default', value: share, onChanged: (v) => setState(() => share = v)),
                ],
              ),
              FormCard(
                title: 'Attached Classroom Material',
                icon: Icons.attach_file_rounded,
                children: [
                  if (material != null)
                    AppFileChip(
                      name: material!.name,
                      size: material!.size,
                      sub: subject,
                      trailing: IconButton(
                        tooltip: 'Remove file',
                        onPressed: () => setState(() => material = null),
                        icon: Icon(Icons.close_rounded, size: 18.r),
                      ),
                    )
                  else
                    Text('No files attached', style: T.body),
                  SizedBox(height: 10.h),
                  AppButton(
                    'Attach Additional Worksheet / Notes',
                    icon: Icons.upload_file_outlined,
                    kind: BtnKind.outline,
                    onPressed: () {
                      setState(() => material = FileRef(name: '${subject.replaceAll(' ', '_')}_Worksheet.pdf', size: '1.8 MB'));
                      showNotice(context, 'Worksheet attached (simulated)');
                    },
                  ),
                ],
              ),
              AppToggleRow(
                title: 'Notify $students Students & Parents',
                subtitle: 'Instant WhatsApp & In-App push blast',
                value: notify,
                tinted: true,
                onChanged: (v) => setState(() => notify = v),
              ),
              SizedBox(height: 8.h),
            ],
          ),
        ),
      ),
    );
  }
}

/// Today, unless the default 16:30 start has already passed (then tomorrow).
String _defaultDate() {
  final n = DateTime.now();
  return n.hour * 60 + n.minute >= 16 * 60 + 30 ? plusDays(1) : plusDays(0);
}
