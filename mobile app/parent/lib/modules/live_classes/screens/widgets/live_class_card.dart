import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../design_system/design_system.dart';
import '../../../../di/injection.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../../../utils/services/link_launcher.dart';
import '../../bloc/live_classes_bloc.dart';
import '../../models/live_class_models.dart';

/// Records the join and opens the Meet link externally; if that fails, shows the link with a copy action
/// (DATA_CONTRACT section 6). Needs a [LiveClassesBloc] above [context].
Future<void> joinLiveClass(BuildContext context, LiveClass c) async {
  context.read<LiveClassesBloc>().add(JoinLiveClass(c.id));
  final opened = await getIt<LinkLauncher>().open(c.link);
  if (opened || !context.mounted) return;
  await showAppSheet<void>(
    context,
    title: 'Could not open Google Meet',
    subtitle: 'Copy the link and open it in your browser.',
    builder: (ctx) => Column(
      children: [
        AppInfoTile(
          icon: Icons.link_rounded,
          label: 'MEET LINK',
          value: c.link,
          onCopy: () {
            Clipboard.setData(ClipboardData(text: c.link));
            AppDialogs.showSnackBar(ctx, message: 'Link copied');
          },
        ),
      ],
    ),
  );
}

/// One live class with its status and a Join button that is enabled from 10 minutes before the start
/// until the class ends. Refreshes itself every 15 seconds.
class LiveClassCard extends StatefulWidget {
  const LiveClassCard({
    super.key,
    required this.item,
    required this.onJoin,
    this.clock,
  });
  final LiveClass item;
  final VoidCallback onJoin;

  /// Injectable clock for tests.
  final DateTime Function()? clock;

  @override
  State<LiveClassCard> createState() => _LiveClassCardState();
}

class _LiveClassCardState extends State<LiveClassCard> {
  late DateTime _now = _clock();
  Timer? _timer;

  DateTime _clock() => (widget.clock ?? DateTime.now)();

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) setState(() => _now = _clock());
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.item;
    final status = c.statusAt(_now);
    final canJoin = c.canJoinAt(_now);
    final (label, tone) = switch (status) {
      LiveStatus.live => ('Live now', Tone.success),
      LiveStatus.upcoming => (
        canJoin ? 'Starting soon' : 'Upcoming',
        Tone.brand,
      ),
      LiveStatus.ended => ('Ended', Tone.neutral),
    };
    return AppCard(
      padding: EdgeInsets.all(14.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconTile(Icons.videocam_rounded, tone: tone, size: 40),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c.title,
                      style: T.h3,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    SizedBox(height: 2.h),
                    Text('${c.subject} - ${c.teacher}', style: T.small),
                  ],
                ),
              ),
              SizedBox(width: 8.w),
              Pill(label, tone: tone, dot: status == LiveStatus.live),
            ],
          ),
          SizedBox(height: 12.h),
          AppInfoTile(
            icon: Icons.schedule_rounded,
            label: fmtDay(c.start, now: _now).toUpperCase(),
            value:
                '${fmtClock(c.start)} - ${fmtClock(c.endsAt)}  (${c.mins} min)',
            compact: true,
          ),
          if (status != LiveStatus.ended) ...[
            SizedBox(height: 12.h),
            AppButton(
              canJoin
                  ? 'Join on Google Meet'
                  : 'Join opens at ${fmtClock(c.opensAt)}',
              icon: canJoin
                  ? Icons.video_call_rounded
                  : Icons.lock_clock_outlined,
              onPressed: canJoin ? widget.onJoin : null,
            ),
          ],
        ],
      ),
    );
  }
}
