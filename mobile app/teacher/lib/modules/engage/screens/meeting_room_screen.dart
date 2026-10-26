import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/meeting_room_bloc.dart';
import '../bloc/meeting_room_events.dart';
import '../bloc/meeting_room_states.dart';
import 'widgets/engage_colors.dart';
import 'widgets/engage_widgets.dart';
import 'widgets/meeting_room_sheets.dart';
import 'widgets/stage_widgets.dart';

/// Simulated meeting window (Figma 1153:7081): speaker, participant grid, waiting banner, controls and sheets.
class MeetingRoomScreen extends StatelessWidget {
  const MeetingRoomScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MeetingRoomBloc>()..add(MeetingRoomLoadRequested(id)),
        child: const NoticeListener<MeetingRoomBloc, MeetingRoomState>(child: _RoomView()),
      );
}

class _RoomView extends StatefulWidget {
  const _RoomView();
  @override
  State<_RoomView> createState() => _RoomViewState();
}

class _RoomViewState extends State<_RoomView> {
  bool mic = true, cam = true, share = false, hand = false;
  int secs = 0, page = 0;
  Timer? timer;

  MeetingRoomBloc get _bloc => context.read<MeetingRoomBloc>();

  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() => secs++));
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  String get clockText => '${(secs ~/ 60).toString().padLeft(2, '0')}:${(secs % 60).toString().padLeft(2, '0')}';

  Future<void> _leave() async {
    final r = await showAppSheet<String>(context, title: 'Leave meeting?', builder: (ctx) => Column(children: [
          AppButton('Leave meeting', kind: BtnKind.outline, icon: Icons.logout_rounded, onPressed: () => Navigator.pop(ctx, 'leave')),
          SizedBox(height: 10.h),
          AppButton('End meeting for all', kind: BtnKind.danger, icon: Icons.call_end_rounded, onPressed: () => Navigator.pop(ctx, 'end')),
          SizedBox(height: 10.h),
          AppButton('Stay in meeting', kind: BtnKind.ghost, onPressed: () => Navigator.pop(ctx)),
        ]));
    if (r == null || !mounted) return;
    _bloc.add(MeetingLeft(endForAll: r == 'end', seconds: secs));
  }

  Widget _waitingBanner(int n) => Container(
        margin: EdgeInsets.fromLTRB(12.w, 0, 12.w, 8.h), padding: EdgeInsets.fromLTRB(14.w, 4.h, 6.w, 4.h),
        decoration: BoxDecoration(color: EC.stageBar, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: EC.stageTile)),
        child: Row(children: [
          Icon(Icons.circle, size: 8.r, color: Colors.white70), SizedBox(width: 8.w),
          Expanded(child: Text('$n parent${n == 1 ? '' : 's'} in waiting room', style: T.small.copyWith(color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis)),
          TextButton(
            style: TextButton.styleFrom(minimumSize: Size(44.w, 44.h)),
            onPressed: () => showWaitingSheet(context, _bloc),
            child: Text('View', style: T.small.copyWith(color: Colors.white)),
          ),
          AppButton('Admit', small: true, expand: false, onPressed: () => _bloc.add(const AllGuestsAdmitted())),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final s = context.watch<MeetingRoomBloc>().state;
    final m = s.meeting;
    if (m == null) {
      return Scaffold(backgroundColor: EC.stage, body: SafeArea(child: EngageStatusBody(status: s.status, error: s.error, notFound: 'Meeting not found')));
    }
    final meName = context.select<SchoolBloc, String>((b) => b.state.teacher?.name ?? '');
    final speaker = s.speaker;
    final others = s.participants.where((p) => p != speaker).toList();
    final tiles = <Widget>[
      StageTile(name: meName.split(' ').take(2).join(' '), you: true, muted: !mic, hand: hand, avatarSize: 48),
      for (final p in others) StageTile(name: p.name, muted: p.muted, hand: p.hand, avatarSize: 48),
    ];
    const per = 4;
    final pages = (tiles.length / per).ceil().clamp(1, 99);
    final pg = page.clamp(0, pages - 1);
    final slice = tiles.skip(pg * per).take(per).toList();
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave();
      },
      child: Scaffold(
        backgroundColor: EC.stage,
        body: SafeArea(
          child: Column(children: [
            Padding(
              padding: EdgeInsets.fromLTRB(12.w, 8.h, 12.w, 8.h),
              child: Row(children: [
                RoundBtn(icon: Icons.keyboard_arrow_down_rounded, label: 'Leave meeting', size: 44, onTap: _leave),
                SizedBox(width: 10.w),
                Expanded(
                  child: Semantics(
                    button: true, label: 'Meeting agenda',
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => showAgendaSheet(context, _bloc),
                      child: SizedBox(
                        height: 44.h,
                        child: Row(children: [
                          Flexible(
                            child: Text(m.category == 'PTM General' ? 'Parent Meeting' : 'Parent Townhall',
                                style: T.h3.copyWith(color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
                          ),
                          SizedBox(width: 8.w),
                          Container(
                            padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                            decoration: BoxDecoration(color: EC.stageBar, borderRadius: BorderRadius.circular(R.pill)),
                            child: Row(mainAxisSize: MainAxisSize.min, children: [
                              Icon(Icons.fiber_manual_record, color: Colors.red, size: 9.r), SizedBox(width: 4.w),
                              Text(clockText, style: T.small.copyWith(color: Colors.white)),
                            ]),
                          ),
                        ]),
                      ),
                    ),
                  ),
                ),
                RoundBtn(icon: Icons.flip_camera_android_outlined, label: 'Flip camera', size: 44, onTap: () => showNotice(context, 'Camera switched')),
                SizedBox(width: 8.w),
                RoundBtn(
                  icon: Icons.chat_bubble_outline_rounded, label: 'Live chat', size: 44, badge: s.chat.isNotEmpty ? '${s.chat.length}' : null,
                  onTap: () => showLiveChatSheet(context, _bloc),
                ),
              ]),
            ),
            if (s.waiting.isNotEmpty) _waitingBanner(s.waiting.length),
            Expanded(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 12.w),
                child: Column(children: [
                  Expanded(
                    flex: 5,
                    child: share
                        ? Container(
                            width: double.infinity,
                            decoration: BoxDecoration(color: EC.stageTile, borderRadius: BorderRadius.circular(R.xl)),
                            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                              Icon(Icons.present_to_all_rounded, color: Colors.white, size: 44.r), SizedBox(height: 8.h),
                              Text('You are sharing your screen', style: T.bodyStrong.copyWith(color: Colors.white)),
                              TextButton(onPressed: () => setState(() => share = false), child: const Text('Stop sharing')),
                            ]),
                          )
                        : StageTile(
                            name: speaker?.name ?? 'Waiting for parents', sub: speaker == null ? null : 'Parent', speaking: speaker != null,
                            muted: speaker?.muted ?? false, avatarSize: 96,
                          ),
                  ),
                  SizedBox(height: 10.h),
                  Expanded(
                    flex: 4,
                    child: LayoutBuilder(builder: (_, c) {
                      final gap = 10.w;
                      final w = (c.maxWidth - gap) / 2, h = (c.maxHeight - gap) / 2;
                      return GridView.count(
                        physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: gap, crossAxisSpacing: gap,
                        childAspectRatio: h <= 0 ? 1 : w / h,
                        children: slice,
                      );
                    }),
                  ),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    for (var i = 0; i < pages; i++)
                      Semantics(
                        button: true, label: 'Page ${i + 1}', selected: i == pg,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => setState(() => page = i),
                          child: Padding(
                            padding: EdgeInsets.all(8.r),
                            child: Container(width: 8.r, height: 8.r, decoration: BoxDecoration(shape: BoxShape.circle, color: i == pg ? Colors.white : EC.stageMuted)),
                          ),
                        ),
                      ),
                  ]),
                ]),
              ),
            ),
            Container(
              margin: EdgeInsets.fromLTRB(12.w, 4.h, 12.w, 12.h), padding: EdgeInsets.symmetric(vertical: 10.h),
              decoration: BoxDecoration(color: EC.stageBar, borderRadius: BorderRadius.circular(R.xxl)),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
                RoundBtn(icon: mic ? Icons.mic_rounded : Icons.mic_off_rounded, label: mic ? 'Mute' : 'Unmute', on: mic, size: 46, onTap: () => setState(() => mic = !mic)),
                RoundBtn(icon: cam ? Icons.videocam_rounded : Icons.videocam_off_rounded, label: cam ? 'Camera off' : 'Camera on', size: 46, onTap: () => setState(() => cam = !cam)),
                RoundBtn(
                  icon: Icons.present_to_all_rounded, label: 'Share screen', on: share, size: 46,
                  onTap: () => share
                      ? setState(() => share = false)
                      : showScreenShareSheet(context, participants: s.headcount, onStart: () {
                          setState(() => share = true);
                          showNotice(context, 'Sharing your screen (simulated)');
                        }),
                ),
                RoundBtn(icon: Icons.people_alt_outlined, label: 'Participants', badge: '${s.headcount}', size: 46, onTap: () => showParticipantsSheet(context, _bloc)),
                RoundBtn(icon: Icons.back_hand_outlined, label: 'Raise hand', on: hand, size: 46, onTap: () => setState(() => hand = !hand)),
                RoundBtn(icon: Icons.call_end_rounded, label: 'Leave', danger: true, size: 46, onTap: _leave),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
