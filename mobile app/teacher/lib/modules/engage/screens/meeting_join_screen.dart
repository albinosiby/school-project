import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/meeting_room_bloc.dart';
import '../bloc/meeting_room_events.dart';
import '../bloc/meeting_room_states.dart';
import 'widgets/engage_widgets.dart';
import 'widgets/stage_widgets.dart';

/// Pre-join lobby of a parent meeting (Figma 1153:6284).
class MeetingJoinScreen extends StatelessWidget {
  const MeetingJoinScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MeetingRoomBloc>()..add(MeetingRoomLoadRequested(id)),
        child: NoticeListener<MeetingRoomBloc, MeetingRoomState>(child: _JoinView(id: id)),
      );
}

String _startsIn(String date, String time) {
  final start = DateTime.tryParse('$date $time:00');
  final diff = start?.difference(DateTime.now()).inMinutes ?? 0;
  if (diff <= 0) return 'Ready to start';
  return 'Starts in ${diff >= 1440 ? '${diff ~/ 1440} days' : diff >= 60 ? '${diff ~/ 60}h ${diff % 60}m' : '$diff mins'}';
}

class _JoinView extends StatelessWidget {
  const _JoinView({required this.id});
  final String id;
  @override
  Widget build(BuildContext context) {
    final s = context.watch<MeetingRoomBloc>().state;
    final e = s.meeting;
    if (e == null) {
      return DetailScaffold(title: 'Start / Join Meet', body: EngageStatusBody(status: s.status, error: s.error, notFound: 'Meeting not found'));
    }
    final me = context.select<SchoolBloc, String>((b) => b.state.teacher?.name ?? '');
    final waiting = s.waiting;
    return Lobby(
      title: 'Start / Join Meet',
      chip: e.audience.split(' • ').first,
      code: 'edu-ptm-${e.classId.split('_').last}',
      heading: e.title,
      startsIn: _startsIn(e.date, e.time),
      waiting: '${waiting.length} parents waiting',
      hostName: me, hostRole: 'Meeting Host • Academic Coordinator', hostBadge: 'Host Role',
      joinLabel: 'Join Now as Host',
      extra: AppCard(
        padding: EdgeInsets.all(12.w),
        child: Row(children: [
          Icon(Icons.groups_2_outlined, color: C.primary, size: 22.r), SizedBox(width: 10.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${waiting.length} Parents in Lobby', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
              Text(
                waiting.isEmpty ? 'No one waiting' : '${waiting.first.name.split(' ').first} & ${waiting.length - 1} others waiting',
                style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis,
              ),
            ]),
          ),
          AppButton('Admit All', kind: BtnKind.soft, small: true, expand: false,
              onPressed: waiting.isEmpty ? null : () => context.read<MeetingRoomBloc>().add(const AllGuestsAdmitted())),
        ]),
      ),
      onJoin: () {
        context.read<MeetingRoomBloc>().add(const MeetingJoined());
        context.pushReplacement(RoutePaths.meetingRoom(id));
      },
    );
  }
}
