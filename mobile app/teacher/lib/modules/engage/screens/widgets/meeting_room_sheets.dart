import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../../school/bloc/school_bloc.dart';
import '../../bloc/meeting_room_bloc.dart';
import '../../bloc/meeting_room_events.dart';
import '../../bloc/meeting_room_states.dart';
import '../../models/meeting_models.dart';
import 'add_topic_sheet.dart';

/// Sheet content that rebuilds from the room BLoC.
Widget _live(MeetingRoomBloc bloc, Widget Function(BuildContext, MeetingRoomState) builder) =>
    BlocProvider.value(value: bloc, child: BlocBuilder<MeetingRoomBloc, MeetingRoomState>(builder: builder));

String _teacherName(BuildContext context) => context.read<SchoolBloc>().state.teacher?.name ?? '';

/// Screenshare popup (Figma 1153:6411). Calls [onStart] when the host starts sharing.
Future<void> showScreenShareSheet(BuildContext context, {required int participants, required VoidCallback onStart}) {
  var audio = false, hide = true;
  Widget toggle(String title, String sub, IconData icon, bool v, ValueChanged<bool> f) => Row(children: [
        Icon(icon, size: 20.r, color: C.primary), SizedBox(width: 10.w),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: T.bodyStrong.copyWith(fontSize: 13.5.sp)),
            Text(sub, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
          ]),
        ),
        Semantics(label: title, toggled: v, child: Switch(value: v, onChanged: f)),
      ]);
  return showAppSheet<void>(context, title: 'Share Your Screen', subtitle: 'Choose what you want to present to all $participants participants.', builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AppCard(
            color: C.primarySoft, border: C.panelBorder, padding: EdgeInsets.all(12.w), radius: R.lg,
            child: Row(children: [
              IconTile(Icons.screen_share_outlined, size: 40), SizedBox(width: 10.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Entire Screen', style: T.bodyStrong),
                  Text('Notifications & apps will be shared', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
                ]),
              ),
              Icon(Icons.check_circle_rounded, color: C.primary, size: 24.r),
            ]),
          ),
          SizedBox(height: 12.h),
          Container(
            padding: EdgeInsets.fromLTRB(12.w, 4.h, 4.w, 4.h),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
            child: Column(children: [
              toggle('Share Device Audio', 'Include system sounds & video clips', Icons.volume_up_outlined, audio, (v) => set(() => audio = v)),
              Divider(height: 1, color: C.border),
              toggle('Hide Notifications', 'Do not disturb mode during presentation', Icons.do_not_disturb_on_outlined, hide, (v) => set(() => hide = v)),
            ]),
          ),
          SizedBox(height: 16.h),
          AppButton('Start Sharing Now', icon: Icons.cast_rounded, onPressed: () {
            Navigator.pop(ctx);
            onStart();
          }),
          SizedBox(height: 8.h),
          AppButton('Cancel', kind: BtnKind.ghost, onPressed: () => Navigator.pop(ctx)),
        ]),
      ));
}

Widget _guestRow(MeetingRoomBloc bloc, WaitingGuest w, {bool detail = false}) => Padding(
      padding: EdgeInsets.only(bottom: 8.h),
      child: AppCard(
        color: C.surface, radius: R.lg, padding: EdgeInsets.fromLTRB(12.w, 8.h, 8.w, 8.h),
        child: Row(children: [
          Avatar(w.name, size: 40), SizedBox(width: 10.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(w.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
              Text(detail ? '${w.sub} • ${w.cls}' : w.sub, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              if (detail)
                Row(children: [
                  Icon(Icons.schedule_rounded, size: 13.r, color: C.slate), SizedBox(width: 4.w),
                  Text('Waiting ${w.waitingMins}m', style: T.small.copyWith(fontSize: 11.sp)),
                ]),
            ]),
          ),
          IconButton(tooltip: 'Deny ${w.name}', icon: Icon(Icons.close_rounded, color: detail ? C.danger : C.slate, size: 20.r), onPressed: () => bloc.add(GuestDenied(w.id))),
          AppButton('Admit', small: true, expand: false, onPressed: () => bloc.add(GuestAdmitted(w.id))),
        ]),
      ),
    );

/// Participants sheet (Figma 1153:6520): waiting room, everyone in the meeting, mute controls.
Future<void> showParticipantsSheet(BuildContext context, MeetingRoomBloc bloc) {
  var q = '';
  return showAppSheet<void>(context, title: 'Participants', builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => _live(bloc, (ctx, s) {
          final me = _teacherName(ctx);
          final people = s.participants.where((p) => q.isEmpty || '${p.name} ${p.sub}'.toLowerCase().contains(q.toLowerCase())).toList();
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            AppSearchField(hint: 'Search participants or roll no...', onChanged: (v) => set(() => q = v.trim())),
            if (s.waiting.isNotEmpty) ...[
              SectionHeader('Waiting Room (${s.waiting.length})', action: 'Admit All', onAction: () => bloc.add(const AllGuestsAdmitted())),
              for (final w in s.waiting) _guestRow(bloc, w),
            ],
            SectionHeader('In Meeting (${s.headcount})', action: 'CONTROLS'),
            ListTile(
              contentPadding: EdgeInsets.zero, minTileHeight: 56.h,
              leading: Avatar(me, online: true),
              title: Text(me, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text('Host • Grade 10-B Class Teacher', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              trailing: const Pill('You', tone: Tone.brand),
            ),
            if (people.isEmpty) const AppEmptyState('No participants match'),
            for (final p in people)
              ListTile(
                contentPadding: EdgeInsets.zero, minTileHeight: 56.h,
                leading: Avatar(p.name, online: p.speaking, tone: p.coHost ? Tone.purple : Tone.brand),
                title: Row(children: [
                  Flexible(child: Text(p.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  if (p.coHost) ...[SizedBox(width: 6.w), const Pill('Co-Host', tone: Tone.neutral)],
                  if (p.hand) const Text(' ✋'),
                ]),
                subtitle: Text(p.speaking ? 'Speaking • ${p.sub}' : p.sub, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: IconButton(
                  tooltip: p.muted ? 'Unmute ${p.name}' : 'Mute ${p.name}',
                  icon: Icon(p.muted ? Icons.mic_off_rounded : Icons.mic_rounded, color: p.muted ? C.danger : C.primary, size: 22.r),
                  onPressed: () => bloc.add(ParticipantMuteToggled(p.id)),
                ),
              ),
            SizedBox(height: 8.h),
            AppButton('Mute All', icon: Icons.mic_off_rounded, kind: BtnKind.outline, onPressed: () => bloc.add(const AllParticipantsMuted())),
          ]);
        }),
      ));
}

/// Live chat sheet (Figma 1153:6761). Long-press one of your messages to pin / unpin it.
Future<void> showLiveChatSheet(BuildContext context, MeetingRoomBloc bloc) {
  final c = TextEditingController();
  void send() {
    if (c.text.trim().isEmpty) return;
    bloc.add(ChatMessageSent(c.text));
    c.clear();
  }

  return showAppSheet<void>(context, title: 'Live Chat', builder: (ctx) => _live(bloc, (ctx, s) {
        final maxW = MediaQuery.of(ctx).size.width * .72;
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Pill('LIVE • ${s.headcount} online', tone: Tone.success, dot: true),
            SizedBox(width: 8.w),
            Expanded(child: Text('Academic Term 2 Review', style: T.small, textAlign: TextAlign.end, maxLines: 1, overflow: TextOverflow.ellipsis)),
          ]),
          SizedBox(height: 10.h),
          for (final p in s.pinned)
            Container(
              width: double.infinity, margin: EdgeInsets.only(bottom: 8.h), padding: EdgeInsets.all(10.w),
              decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.panelBorder)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(Icons.push_pin_rounded, size: 14.r, color: C.primary), SizedBox(width: 4.w),
                  Text('PINNED BY HOST • ${clock(p.ts)}', style: T.small.copyWith(color: C.primary, fontWeight: FontWeight.w800, fontSize: 10.5.sp)),
                ]),
                Text(p.text, style: T.body.copyWith(color: C.ink, fontSize: 13.sp)),
              ]),
            ),
          if (s.chat.isEmpty) const AppEmptyState('No messages yet'),
          for (final m in s.chat)
            GestureDetector(
              onLongPress: m.mine ? () => bloc.add(ChatPinToggled(m.id)) : null,
              child: Align(
                alignment: m.mine ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  constraints: BoxConstraints(maxWidth: maxW), margin: EdgeInsets.symmetric(vertical: 4.h), padding: EdgeInsets.all(10.w),
                  decoration: BoxDecoration(color: m.mine ? C.primary : C.surface, borderRadius: BorderRadius.circular(R.md), border: m.mine ? null : Border.all(color: C.border)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(m.mine ? 'Host • You  ${clock(m.ts)}' : '${m.name}  ${clock(m.ts)}',
                        style: T.small.copyWith(color: m.mine ? Colors.white70 : C.slate, fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                    Text(m.text, style: T.body.copyWith(color: m.mine ? Colors.white : C.ink, fontSize: 13.5.sp)),
                  ]),
                ),
              ),
            ),
          SizedBox(height: 10.h),
          Row(children: [
            Expanded(
              child: TextField(
                controller: c, onSubmitted: (_) => send(), textInputAction: TextInputAction.send,
                decoration: const InputDecoration(hintText: 'Send a message to everyone...'),
              ),
            ),
            SizedBox(width: 8.w),
            IconButton.filled(tooltip: 'Send', onPressed: send, iconSize: 22.r, icon: const Icon(Icons.send_rounded)),
          ]),
        ]);
      }));
}

/// Waiting room sheet (Figma 1153:6896).
Future<void> showWaitingSheet(BuildContext context, MeetingRoomBloc bloc) => showAppSheet<void>(context, title: 'Waiting Room', builder: (ctx) => _live(bloc, (ctx, s) {
      final title = s.meeting?.title ?? '';
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Pill('${s.waiting.length} Waiting', tone: Tone.brand, dot: true), SizedBox(width: 8.w),
          Expanded(child: Text('Guests waiting to be admitted${title.isEmpty ? '' : ' to $title'}', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis)),
        ]),
        SizedBox(height: 12.h),
        Text('IN QUEUE', style: T.capsMuted),
        SizedBox(height: 8.h),
        if (s.waiting.isEmpty) const AppEmptyState('Waiting room is empty', icon: Icons.meeting_room_outlined),
        for (final w in s.waiting) _guestRow(bloc, w, detail: true),
        SizedBox(height: 4.h),
        AppButton('Admit All (${s.waiting.length})', icon: Icons.done_all_rounded, onPressed: s.waiting.isEmpty ? null : () => bloc.add(const AllGuestsAdmitted())),
        SizedBox(height: 10.h),
        Container(
          padding: EdgeInsets.all(10.w),
          decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
          child: Row(children: [
            Icon(Icons.shield_outlined, size: 16.r, color: C.slate), SizedBox(width: 8.w),
            Expanded(child: Text('Participants can only enter once verified and approved by the academic host.', style: T.small.copyWith(fontSize: 11.sp))),
          ]),
        ),
        SizedBox(height: 12.h),
        AppButton('Return to Meeting', icon: Icons.videocam_outlined, kind: BtnKind.outline, onPressed: () => Navigator.pop(ctx)),
      ]);
    }));

/// Meeting agenda sheet with "Add Topic".
Future<void> showAgendaSheet(BuildContext context, MeetingRoomBloc bloc) => showAppSheet<void>(context, title: 'Meeting Agenda', builder: (ctx) => _live(bloc, (ctx, s) {
      final agenda = s.meeting?.agenda ?? const <AgendaTopic>[];
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(s.meeting?.title ?? '', style: T.body),
        SizedBox(height: 10.h),
        if (agenda.isEmpty) const AppEmptyState('No agenda topics'),
        for (var i = 0; i < agenda.length; i++)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(radius: 14.r, backgroundColor: C.primarySoft, child: Text('${i + 1}', style: T.small.copyWith(color: C.primary))),
            title: Text(agenda[i].title, style: T.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis),
            subtitle: Text('${agenda[i].mins} mins', style: T.small),
          ),
        SizedBox(height: 8.h),
        AppButton('Add Topic', icon: Icons.add_rounded, kind: BtnKind.soft, onPressed: () async {
          final t = await showAddTopicSheet(ctx);
          if (t != null) bloc.add(AgendaTopicAdded(t));
        }),
      ]);
    }));
