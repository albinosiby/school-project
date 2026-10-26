import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/engage_notice.dart';
import '../bloc/meetings_bloc.dart';
import '../bloc/meetings_events.dart';
import '../bloc/meetings_states.dart';
import '../models/meeting_models.dart';
import 'widgets/add_topic_sheet.dart';
import 'widgets/engage_widgets.dart';

/// Schedule / edit a parent meeting (Figma 1153:5813).
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
  final _key = GlobalKey<FormState>();
  final _title = TextEditingController();
  String classId = 'cls_10B', category = 'Academic Townhall', format = 'In-Person', date = plusDays(5), time = '10:00';
  int mins = 90;
  bool invite = true, whatsapp = false, _prefilled = false;
  List<AgendaTopic> agenda = [];
  String? agendaErr, dateErr;

  static const _formats = ['In-Person', 'Online', 'Virtual Stream'];

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  void _prefill(Meeting? e) {
    _prefilled = true;
    if (e == null) return;
    _title.text = e.title;
    classId = e.classId;
    category = e.category;
    format = e.format.replaceAll(' Meeting', '').replaceAll('Hybrid', 'Online');
    if (!_formats.contains(format)) format = 'Online';
    date = e.date;
    time = e.time;
    mins = e.mins;
    invite = e.invite;
    whatsapp = e.whatsapp;
    agenda = [...e.agenda];
  }

  String get _link => 'https://meet.google.com/edu-ptm-${classId.split('_').last}';

  void _save(bool draft) {
    final school = context.read<SchoolBloc>().state;
    final isPast = !draft && '$date $time:00'.compareTo(DateTime.now().toIso8601String().substring(0, 19).replaceFirst('T', ' ')) < 0;
    setState(() {
      dateErr = isPast ? 'Choose a future date and time' : null;
      agendaErr = !draft && agenda.isEmpty ? 'Add at least one agenda topic' : null;
    });
    final valid = _key.currentState?.validate() ?? false;
    if (!valid || dateErr != null || agendaErr != null) return;
    final c = school.classById(classId);
    if (c == null) return;
    context.read<MeetingsBloc>().add(MeetingSaved(
          Meeting(
            id: widget.editId ?? '', title: _title.text.trim(), classId: classId, audience: '${classLabel(c).replaceFirst('–', '-')} • All Parents', category: category,
            format: format == 'In-Person' ? 'In-Person Meeting' : 'Online Meeting', date: date, time: time, mins: mins,
            venue: format == 'In-Person' ? c.room : 'Google Meet Live', link: format == 'In-Person' ? '' : _link, agenda: agenda, total: c.students,
            invite: invite, whatsapp: whatsapp,
          ),
          draft: draft,
        ));
  }

  @override
  Widget build(BuildContext context) {
    final ms = context.watch<MeetingsBloc>().state;
    final school = context.watch<SchoolBloc>().state;
    if (!_prefilled && ms.status == EngageStatus.loaded) _prefill(widget.editId == null ? null : ms.byId(widget.editId!));
    final classes = school.classes;
    final cls = school.classById(classId);
    final used = agenda.fold<int>(0, (a, e) => a + e.mins);
    return DetailScaffold(
      title: widget.editId == null ? 'Schedule Parent Meeting' : 'Edit Parent Meeting',
      bottom: Row(children: [
        Expanded(child: AppButton('Save Draft', kind: BtnKind.outline, onPressed: () => _save(true))),
        SizedBox(width: 10.w),
        Expanded(flex: 2, child: AppButton('Send Invites & Schedule', icon: Icons.send_rounded, onPressed: () => _save(false))),
      ]),
      body: Form(
        key: _key,
        child: ListView(padding: EdgeInsets.all(S.page), children: [
          FormCard(title: 'Target Class / Section', icon: Icons.school_outlined, children: [
            if (classes.isNotEmpty)
              AppDropdown<String>(
                label: 'Class', value: classes.any((c) => c.id == classId) ? classId : classes.first.id, items: [for (final c in classes) c.id],
                labelOf: (v) => classLabel(school.classById(v)!), onChanged: (v) => setState(() => classId = v),
              ),
            if (cls != null) Align(alignment: Alignment.centerLeft, child: Pill('${cls.students} Students & Parents', tone: Tone.brand)),
            SizedBox(height: 10.h),
            OrganizerRow(teacher: school.teacher),
          ]),
          FormCard(title: 'Meeting Details', icon: Icons.edit_note_rounded, children: [
            AppTextField(
              label: 'Meeting Title', controller: _title, maxLines: 2, hint: 'e.g. Term 2 Academic Review',
              validator: (v) => (v ?? '').trim().length < 5 ? 'Enter a meeting title (min 5 characters)' : null,
            ),
            const FieldLabel('Category'),
            AppChoiceChips(
              items: const ['Academic Townhall', 'PTM General', 'Orientation', 'Exam Briefing'], value: category, solid: true,
              onChanged: (v) => setState(() => category = v.isEmpty ? category : v),
            ),
            SizedBox(height: 12.h),
            const FieldLabel('Meeting Delivery Format'),
            AppChoiceChips(
              items: _formats, value: format,
              icons: const {'In-Person': Icons.apartment_rounded, 'Online': Icons.videocam_outlined, 'Virtual Stream': Icons.live_tv_outlined},
              onChanged: (v) => setState(() => format = v.isEmpty ? format : v),
            ),
            if (format != 'In-Person')
              Padding(
                padding: EdgeInsets.only(top: 12.h),
                child: AppInfoTile(
                  icon: Icons.video_call_outlined, label: 'Meet Link', value: _link, iconColor: C.primary,
                  onCopy: () async {
                    await Clipboard.setData(ClipboardData(text: _link));
                    if (context.mounted) showNotice(context, 'Meet link copied');
                  },
                ),
              ),
          ]),
          FormCard(title: 'Date & Duration', icon: Icons.schedule_rounded, children: [
            DateTimeFields(date: date, time: time, year: true, onDate: (v) => setState(() => date = v), onTime: (v) => setState(() => time = v)),
            if (dateErr != null) Padding(padding: EdgeInsets.only(top: 8.h), child: Text(dateErr!, style: T.small.copyWith(color: C.danger))),
            SizedBox(height: 10.h),
            const FieldLabel('Duration'),
            AppSegmented(items: const ['45m', '60m', '90m', '120m'], value: '${mins}m', onChanged: (v) => setState(() => mins = int.parse(v.replaceAll('m', '')))),
            SizedBox(height: 10.h),
            Text('Calculated slot: ${fmtTime(time)} – ${fmtTime(addMins(time, mins))} ($mins mins total)', style: T.small.copyWith(color: C.primary)),
          ]),
          FormCard(
            title: 'Agenda & Discussion', icon: Icons.checklist_rounded,
            trailing: AppButton('Add Topic', icon: Icons.add_rounded, kind: BtnKind.soft, small: true, expand: false, onPressed: () async {
              final t = await showAddTopicSheet(context);
              if (t != null) {
                setState(() {
                  agenda = [...agenda, t];
                  agendaErr = null;
                });
              }
            }),
            children: [
              if (agenda.isEmpty) Padding(padding: EdgeInsets.symmetric(vertical: 6.h), child: Text('No topics yet. Add the points you want to discuss.', style: T.body)),
              for (var i = 0; i < agenda.length; i++)
                Container(
                  margin: EdgeInsets.only(top: 8.h), padding: EdgeInsets.fromLTRB(12.w, 8.h, 4.w, 8.h),
                  decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${i + 1}. ${agenda[i].title}', style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
                        Text('Allocated: ${agenda[i].mins} mins', style: T.small),
                      ]),
                    ),
                    IconButton(
                      tooltip: 'Remove topic', icon: Icon(Icons.close_rounded, size: 18.r),
                      onPressed: () => setState(() => agenda = [...agenda]..removeAt(i)),
                    ),
                  ]),
                ),
              if (agenda.isNotEmpty)
                Padding(padding: EdgeInsets.only(top: 8.h), child: Text('$used of $mins mins allocated', style: T.small.copyWith(color: used > mins ? C.danger : C.slate))),
              if (agendaErr != null) Padding(padding: EdgeInsets.only(top: 8.h), child: Text(agendaErr!, style: T.small.copyWith(color: C.danger))),
            ],
          ),
          FormCard(title: 'Communication & RSVP', icon: Icons.campaign_outlined, children: [
            AppToggleRow(
              title: 'Auto-send calendar invitations', subtitle: 'Push notifications & email invites to all ${cls?.students ?? 0} registered parents', value: invite,
              margin: EdgeInsets.only(bottom: 10.h), onChanged: (v) => setState(() => invite = v),
            ),
            AppToggleRow(
              title: 'Class WhatsApp Broadcast', subtitle: 'Send official summary reminder on parent class group', value: whatsapp,
              onChanged: (v) => setState(() => whatsapp = v),
            ),
          ]),
        ]),
      ),
    );
  }
}
