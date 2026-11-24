import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../models/live_class_rules.dart';
import 'engage_widgets.dart';

/// What the teacher filled in to schedule (or reschedule) a meeting from a chat.
class MeetingDraft {
  const MeetingDraft({required this.date, required this.time, required this.link, this.note = ''});
  /// ISO date (yyyy-MM-dd) and 24h time (HH:mm) in the school's local time.
  final String date, time, link, note;
  DateTime? get startsAt => DateTime.tryParse('${date}T$time:00');
}

/// Bottom sheet to pick a date, a start time, paste the Google Meet link and add a note.
/// Pass [existing] to reschedule: fields are prefilled and the button reads "Update meeting".
Future<MeetingDraft?> showScheduleMeetingSheet(BuildContext context, {required String withName, MeetingDraft? existing}) =>
    showAppSheet<MeetingDraft>(
      context,
      title: existing == null ? 'Schedule a meeting' : 'Reschedule meeting',
      subtitle: 'with $withName • both of you get reminders',
      builder: (ctx) => _MeetingForm(existing: existing),
    );

class _MeetingForm extends StatefulWidget {
  const _MeetingForm({this.existing});
  final MeetingDraft? existing;
  @override
  State<_MeetingForm> createState() => _MeetingFormState();
}

class _MeetingFormState extends State<_MeetingForm> {
  final _form = GlobalKey<FormState>();
  late String _date = widget.existing?.date ?? isoOf(DateTime.now().add(const Duration(days: 1)));
  late String _time = widget.existing?.time ?? '16:00';
  late final _link = TextEditingController(text: widget.existing?.link ?? '');
  late final _note = TextEditingController(text: widget.existing?.note ?? '');
  String? _timeError;

  @override
  void dispose() {
    _link.dispose();
    _note.dispose();
    super.dispose();
  }

  void _submit() {
    final ok = _form.currentState?.validate() ?? false;
    final start = DateTime.tryParse('${_date}T$_time:00');
    setState(() => _timeError = start == null || !start.isAfter(DateTime.now().add(const Duration(minutes: 5))) ? 'Pick a time at least 5 minutes from now' : null);
    if (!ok || _timeError != null) return;
    Navigator.pop(context, MeetingDraft(date: _date, time: _time, link: normalizeMeetLink(_link.text) ?? _link.text.trim(), note: _note.text.trim()));
  }

  @override
  Widget build(BuildContext context) => Form(
        key: _form,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          DateTimeFields(date: _date, time: _time, year: true, onDate: (v) => setState(() => _date = v), onTime: (v) => setState(() => _time = v)),
          if (_timeError != null) Padding(padding: EdgeInsets.only(top: 6.h, left: 4.w), child: Text(_timeError!, style: T.small.copyWith(color: C.danger))),
          SizedBox(height: 12.h),
          AppTextField(
            label: 'Google Meet link',
            hint: 'https://meet.google.com/abc-defg-hij',
            controller: _link,
            keyboard: TextInputType.url,
            validator: validateMeetLink,
            suffix: IconButton(
              tooltip: 'How to get a link',
              icon: Icon(Icons.help_outline_rounded, size: 20.r, color: C.slate),
              onPressed: () => AppDialogs.showInfoDialog(context,
                  title: 'Getting a Meet link',
                  message: 'Open meet.google.com or the Google Meet app, tap "New meeting" > "Create a meeting for later", then copy the link and paste it here.'),
            ),
          ),
          SizedBox(height: 12.h),
          AppTextField(label: 'Note (optional)', hint: 'What the meeting is about', controller: _note, maxLines: 2, maxLength: 160),
          SizedBox(height: 10.h),
          Container(
            padding: EdgeInsets.all(12.r),
            decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.md)),
            child: Row(children: [
              Icon(Icons.notifications_active_outlined, size: 18.r, color: C.primary),
              SizedBox(width: 8.w),
              Expanded(child: Text('Reminders go to both of you on the morning of the meeting, 1 hour before and 10 minutes before.', style: T.small.copyWith(color: C.primaryDark))),
            ]),
          ),
          SizedBox(height: 14.h),
          AppButton(widget.existing == null ? 'Schedule meeting' : 'Update meeting', icon: Icons.video_call_outlined, onPressed: _submit),
        ]),
      );
}
