import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/live_classes_bloc.dart';
import '../bloc/live_classes_events.dart';
import '../bloc/live_classes_states.dart';
import '../models/live_class_models.dart';
import '../models/live_class_rules.dart';
import 'widgets/meet_actions.dart';
import 'widgets/engage_colors.dart';
import 'widgets/engage_widgets.dart';
import 'widgets/stage_widgets.dart';

/// Join a live class (Figma 1153:4921): pre-join lobby, then a simulated in-class screen.
class LiveClassJoinScreen extends StatelessWidget {
  const LiveClassJoinScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<LiveClassesBloc>()..add(const LiveClassesLoadRequested()),
        child: NoticeListener<LiveClassesBloc, LiveClassesState>(child: _JoinView(id: id)),
      );
}

class _JoinView extends StatefulWidget {
  const _JoinView({required this.id});
  final String id;
  @override
  State<_JoinView> createState() => _JoinViewState();
}

class _JoinViewState extends State<_JoinView> {
  bool inClass = false;

  @override
  Widget build(BuildContext context) {
    final st = context.watch<LiveClassesBloc>().state;
    final e = st.byId(widget.id);
    if (e == null) {
      return DetailScaffold(title: 'Join Live Class', body: EngageStatusBody(status: st.status, error: st.error, notFound: 'Session not found'));
    }
    if (inClass) return _InClass(e: e);
    final teacher = context.select((SchoolBloc b) => b.state.teacher);
    final start = DateTime.tryParse('${e.date} ${e.time}:00');
    final diff = start == null ? 0 : start.difference(DateTime.now()).inMinutes;
    final meet = isMeet(e);
    final startsIn = meet ? e.statusLabel(DateTime.now()) : diff > 0 ? 'Starts in ${diff >= 60 ? '${diff ~/ 60}h ${diff % 60}m' : '$diff mins'}' : 'Ready to start';
    return Lobby(
      title: 'Join Live Class',
      chip: e.audience.split(' (').first,
      code: 'edu-${e.id}',
      heading: e.title,
      startsIn: startsIn,
      waiting: meet ? '${e.joined} joined' : '${e.joined} students waiting',
      hostName: teacher?.name ?? '',
      hostRole: 'Meeting Host • ${teacher?.subjects ?? ''}',
      joinLabel: meet ? 'Join Google Meet' : 'Join Now',
      onJoin: () {
        if (meet) {
          if (e.canJoin(DateTime.now())) {
            joinMeet(context, e);
          } else {
            showNotice(context, e.phase(DateTime.now()) == LivePhase.ended ? 'This class has ended' : 'Join opens $joinLeadMinutes minutes before the start');
          }
          return;
        }
        context.read<LiveClassesBloc>().add(LiveSessionStarted(e.id));
        setState(() => inClass = true);
      },
    );
  }
}

class _InClass extends StatefulWidget {
  const _InClass({required this.e});
  final LiveSession e;
  @override
  State<_InClass> createState() => _InClassState();
}

class _InClassState extends State<_InClass> {
  bool mic = true, cam = true, share = false, hand = false;
  int secs = 0;
  Timer? timer;

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

  Future<void> _end() async {
    final ok = await confirmAction(context, title: 'End class for everyone?', message: 'The session will move to Past Recordings.', confirm: 'End class', danger: true);
    if (!ok || !mounted) return;
    timer?.cancel();
    context.read<LiveClassesBloc>().add(LiveSessionEnded(widget.e.id));
  }

  @override
  Widget build(BuildContext context) {
    final e = widget.e;
    final me = context.select((SchoolBloc b) => b.state.teacher?.name ?? '');
    const names = ['Aarav Sharma', 'Diya Mehta', 'Kabir Nair', 'Isha Patel'];
    return Scaffold(
      backgroundColor: EC.stage,
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(S.page),
          child: Column(children: [
            Row(children: [
              Expanded(child: Text(e.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.h3.copyWith(color: Colors.white))),
              SizedBox(width: 8.w),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                decoration: BoxDecoration(color: EC.stageBar, borderRadius: BorderRadius.circular(R.pill)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.fiber_manual_record, color: Colors.red, size: 10.r), SizedBox(width: 4.w),
                  Text(clockText, style: T.small.copyWith(color: Colors.white)),
                ]),
              ),
            ]),
            SizedBox(height: 4.h),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(share ? 'You are sharing your screen' : '${e.joined} students in class', style: T.small.copyWith(color: EC.stageMuted)),
            ),
            SizedBox(height: 12.h),
            Expanded(
              child: GridView.count(
                crossAxisCount: 2, mainAxisSpacing: 10.h, crossAxisSpacing: 10.w, childAspectRatio: .9,
                children: [
                  StageTile(name: me, you: true, muted: !mic, hand: hand),
                  for (var i = 0; i < names.length; i++) StageTile(name: names[i], muted: i != 0, speaking: i == 0),
                ],
              ),
            ),
            SizedBox(height: 12.h),
            Container(
              padding: EdgeInsets.symmetric(vertical: 10.h, horizontal: 8.w),
              decoration: BoxDecoration(color: EC.stageBar, borderRadius: BorderRadius.circular(R.xxl)),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
                RoundBtn(icon: mic ? Icons.mic_rounded : Icons.mic_off_rounded, label: mic ? 'Mute' : 'Unmute', on: mic, onTap: () => setState(() => mic = !mic)),
                RoundBtn(icon: cam ? Icons.videocam_rounded : Icons.videocam_off_rounded, label: cam ? 'Camera off' : 'Camera on', on: cam, onTap: () => setState(() => cam = !cam)),
                RoundBtn(icon: Icons.present_to_all_rounded, label: share ? 'Stop sharing' : 'Share screen', on: share, onTap: () => setState(() => share = !share)),
                RoundBtn(icon: Icons.back_hand_outlined, label: 'Raise hand', on: hand, onTap: () => setState(() => hand = !hand)),
                RoundBtn(icon: Icons.call_end_rounded, label: 'End class', danger: true, onTap: _end),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
