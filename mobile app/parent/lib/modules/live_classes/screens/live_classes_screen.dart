import 'package:flutter/material.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../family/screens/widgets/child_switcher.dart';
import '../bloc/live_classes_bloc.dart';
import '../models/live_class_models.dart';
import 'widgets/live_class_card.dart';

class LiveClassesScreen extends StatelessWidget {
  const LiveClassesScreen({super.key});

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Live classes',
    subtitle: 'Join on Google Meet',
    fallbackRoute: RoutePaths.more,
    body: Column(
      children: [
        const ChildSwitcher(),
        Expanded(
          child: ChildDataView<LiveClassesBloc, List<LiveClass>>(
            create: () => getIt<LiveClassesBloc>(),
            isEmpty: (d) => d.isEmpty,
            emptyTitle: 'No live classes',
            emptyHint: 'Online classes scheduled by teachers will appear here.',
            emptyIcon: Icons.videocam_off_outlined,
            builder: (context, data, child) {
              final now = DateTime.now();
              final upcoming =
                  data
                      .where((c) => c.statusAt(now) != LiveStatus.ended)
                      .toList()
                    ..sort((a, b) => a.start.compareTo(b.start));
              final ended =
                  data
                      .where((c) => c.statusAt(now) == LiveStatus.ended)
                      .toList()
                    ..sort((a, b) => b.start.compareTo(a.start));
              Widget card(LiveClass c) => Padding(
                padding: EdgeInsets.only(bottom: 12.h),
                child: LiveClassCard(
                  item: c,
                  onJoin: () => joinLiveClass(context, c),
                ),
              );
              return ListView(
                padding: EdgeInsets.fromLTRB(S.page, 4.h, S.page, 24.h),
                children: [
                  if (upcoming.isNotEmpty)
                    SectionHeader('Upcoming and live', caps: true),
                  for (final c in upcoming) card(c),
                  if (ended.isNotEmpty) SectionHeader('Earlier', caps: true),
                  for (final c in ended) card(c),
                  Text(
                    'Join opens 10 minutes before the start and closes when the class ends.',
                    style: T.small,
                    textAlign: TextAlign.center,
                  ),
                ],
              );
            },
          ),
        ),
      ],
    ),
  );
}
