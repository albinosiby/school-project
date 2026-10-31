import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/notices_bloc.dart';
import '../models/notice_models.dart';

/// Figma 1.14 Transport Notices.
class NoticesScreen extends StatelessWidget {
  const NoticesScreen({super.key});

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Transport notices',
    fallbackRoute: RoutePaths.home,
    body: DataView<NoticesBloc, List<Notice>>(
      create: () => getIt<NoticesBloc>(),
      isEmpty: (n) => n.isEmpty,
      emptyTitle: 'No notices',
      emptyHint: 'Published notices for the transport crew appear here.',
      emptyIcon: Icons.campaign_outlined,
      builder: (context, notices) => ListView(
        padding: EdgeInsets.all(16.w),
        children: [
          for (final n in notices)
            AppEntryCard(
              icon: n.urgent ? Icons.priority_high_rounded : Icons.campaign_rounded,
              tone: n.urgent ? Tone.danger : Tone.brand,
              title: n.title,
              meta: '${n.category.isEmpty ? n.audience : n.category} · ${n.sentAt == null ? '' : relTime(n.sentAt!)}',
              body: n.body,
              badge: n.pinned ? const Pill('Pinned', tone: Tone.warning, icon: Icons.push_pin_rounded) : null,
              onTap: () => context.push(RoutePaths.notice(n.id)),
            ),
        ],
      ),
    ),
  );
}
