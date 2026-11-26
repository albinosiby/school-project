import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../design_system/design_system.dart';
import '../../../../di/injection.dart';
import '../../../engage/repositories/message_repository_interface.dart';
import '../../../school/models/school_models.dart';
import '../../models/attendance_models.dart';
import 'att_widgets.dart';

/// What the sheet returns: the notice to store (the server delivers it to the parent app with a push) and whether to
/// also post the message in the guardian's chat.
typedef NotifyResult = ({ParentNotice notice, bool chat});

/// Notify Parent / Guardian: pick a preset, edit the message, optionally copy it into the parent chat, send.
/// "Call" opens the phone dialer and is logged as a call (nothing is sent to the app).
Future<NotifyResult?> showNotifySheet(BuildContext context, Student st, {SchoolClass? cls, int absentCount = 0, int mondays = 0}) =>
    showAppSheet<NotifyResult>(
      context,
      title: 'Notify Parent / Guardian',
      subtitle: '${st.name} • Roll #${st.roll}${cls == null ? '' : ' • Class ${cls.label}'}',
      builder: (ctx) => _NotifyForm(st: st, cls: cls, absent: absentCount, mondays: mondays),
    );

class _NotifyForm extends StatefulWidget {
  const _NotifyForm({required this.st, required this.cls, required this.absent, required this.mondays});
  final Student st;
  final SchoolClass? cls;
  final int absent, mondays;
  @override
  State<_NotifyForm> createState() => _NotifyFormState();
}

class _NotifyFormState extends State<_NotifyForm> {
  static const templates = ['Low attendance', 'Monday absences', 'Welfare check'];
  static const maxLen = 500;
  late String tpl = widget.mondays >= 2 ? templates[1] : templates.first;
  late final TextEditingController msg = TextEditingController(text: _text(tpl));
  bool chat = false;

  /// Why the chat copy is not possible ('' = it is), from the guardian's parent-app login.
  String chatBlocked = '';
  String? error;

  @override
  void initState() {
    super.initState();
    _checkChat();
  }

  Future<void> _checkChat() async {
    if (!getIt.isRegistered<IMessageRepository>()) return;
    final r = await getIt<IMessageRepository>().resolveRecipient('g_${widget.st.id}');
    if (!mounted) return;
    setState(() => chatBlocked = r == null ? 'Guardian not found' : r.blocked);
  }

  String _text(String t) {
    final n = widget.st.name, g = widget.st.guardian.isEmpty ? 'Parent' : widget.st.guardian, cn = widget.cls?.label ?? '';
    final who = '$n (Roll #${widget.st.roll}${cn.isEmpty ? '' : ', Class $cn'})';
    return switch (t) {
      'Monday absences' =>
        'Dear $g, $who has missed ${widget.mondays == 0 ? 'several' : widget.mondays} Monday classes recently. Regular attendance matters for progress — please let us know if anything is affecting Mondays.',
      'Welfare check' => 'Dear $g, $who has been absent for the last few school days. Please let us know if everything is fine.',
      _ =>
        'Dear $g, $who has attendance below the required $attendanceThresholdLabel%${widget.absent > 0 ? ' with ${widget.absent} absences' : ''}. Regular attendance is important for progress — please make sure they attend every day.',
    };
  }

  @override
  void dispose() {
    msg.dispose();
    super.dispose();
  }

  ParentNotice _notice(List<String> ch, String text) => ParentNotice(
    studentId: widget.st.id,
    classId: widget.st.classId,
    channels: ch,
    message: text,
    template: ch.contains('Call') ? null : tpl,
    at: DateTime.now().toIso8601String(),
  );

  void _send() {
    final text = msg.text.trim();
    if (text.isEmpty) return setState(() => error = 'Write a message');
    if (text.length > maxLen) return setState(() => error = 'Keep it under $maxLen characters');
    final withChat = chat && chatBlocked.isEmpty;
    toast(context, withChat ? 'Sent to the parent app and chat' : 'Sent to the parent app');
    Navigator.pop(context, (notice: _notice(['App', if (withChat) 'Chat'], text), chat: withChat));
  }

  Future<void> _call() async {
    final digits = widget.st.phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (digits.isEmpty) return setState(() => error = 'No phone number on file');
    final nav = Navigator.of(context);
    final ok = await launchUrl(Uri(scheme: 'tel', path: digits));
    if (!mounted) return;
    if (!ok) return setState(() => error = 'Could not open the dialer');
    nav.pop((notice: _notice(const ['Call'], 'Phone call placed to ${widget.st.guardian} ($digits)'), chat: false));
  }

  @override
  Widget build(BuildContext context) {
    final st = widget.st;
    final len = msg.text.trim().length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // who it goes to
        Container(
          padding: EdgeInsets.all(12.r),
          decoration: BoxDecoration(color: C.panel, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.panelBorder)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.absent > 0 || widget.mondays >= 2) ...[
                AttBanner(
                  icon: Icons.error_rounded,
                  tone: Tone.danger,
                  text: widget.mondays >= 2 ? '${widget.mondays} Monday absences recently' : '${widget.absent} absences in this period',
                ),
                SizedBox(height: 10.h),
              ],
              Row(
                children: [
                  Icon(Icons.person_outline_rounded, size: 16.r, color: C.slate),
                  SizedBox(width: 4.w),
                  Expanded(
                    child: Text(st.guardian.isEmpty ? 'Guardian' : st.guardian, style: T.bodyStrong.copyWith(fontSize: 13.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                  if (st.phone.isNotEmpty) Text(st.phone, style: T.small),
                ],
              ),
            ],
          ),
        ),
        SizedBox(height: 14.h),
        const CapsLabel('Message'),
        AppChoiceChips(
          items: templates,
          value: tpl,
          dense: true,
          onChanged: (v) => setState(() {
            tpl = v;
            msg.text = _text(v);
            error = null;
          }),
        ),
        SizedBox(height: 10.h),
        TextField(
          key: const ValueKey('notify-message'),
          controller: msg,
          minLines: 4,
          maxLines: 7,
          style: T.body.copyWith(color: C.ink),
          decoration: const InputDecoration(hintText: 'Write to the parent…'),
          onChanged: (_) => setState(() => error = null),
        ),
        SizedBox(height: 4.h),
        Align(
          alignment: Alignment.centerRight,
          child: Text('$len / $maxLen', style: T.small.copyWith(fontSize: 11.sp, color: len > maxLen ? C.danger : C.slate)),
        ),
        SizedBox(height: 4.h),
        // copy into the chat thread with this guardian
        Material(
          color: C.surface,
          borderRadius: BorderRadius.circular(R.lg),
          clipBehavior: Clip.antiAlias,
          child: SwitchListTile(
            key: const ValueKey('notify-chat'),
            contentPadding: EdgeInsets.symmetric(horizontal: 12.w),
            secondary: IconTile(Icons.chat_bubble_outline_rounded, size: 36, tone: chatBlocked.isEmpty ? Tone.brand : Tone.neutral),
            value: chat && chatBlocked.isEmpty,
            onChanged: chatBlocked.isEmpty ? (v) => setState(() => chat = v) : null,
            title: Text('Also send in chat', style: T.bodyStrong.copyWith(fontSize: 13.5.sp)),
            subtitle: Text(
              chatBlocked.isEmpty ? 'Posts the same message in your chat with ${st.guardian.isEmpty ? 'the guardian' : st.guardian}' : '$chatBlocked — chat not available',
              style: T.small.copyWith(fontSize: 11.5.sp),
            ),
          ),
        ),
        if (error != null)
          Padding(
            padding: EdgeInsets.only(top: 8.h),
            child: Text(error!, style: T.small.copyWith(color: C.danger)),
          ),
        SizedBox(height: 14.h),
        Row(
          children: [
            Expanded(
              child: AppButton('Call', icon: Icons.call_outlined, kind: BtnKind.outline, onPressed: st.phone.isEmpty ? null : _call),
            ),
            SizedBox(width: 10.w),
            Expanded(
              flex: 2,
              child: AppButton('Send Notification Now', icon: Icons.send_rounded, onPressed: _send),
            ),
          ],
        ),
      ],
    );
  }
}
