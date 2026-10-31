import 'package:flutter/material.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/notices_bloc.dart';
import '../models/notice_models.dart';

/// Figma 1.14.1 Transport Notice Detail.
class NoticeDetailScreen extends StatelessWidget {
  const NoticeDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Notice',
    fallbackRoute: RoutePaths.notices,
    body: DataView<NoticesBloc, List<Notice>>(
      create: () => getIt<NoticesBloc>(),
      refreshable: false,
      builder: (context, notices) {
        final n = notices.where((n) => n.id == id).firstOrNull;
        if (n == null) return const AppEmptyState('Notice not found', icon: Icons.campaign_outlined);
        return ListView(
          padding: EdgeInsets.all(16.w),
          children: [
            Row(children: [
              Pill(n.category.isEmpty ? 'Notice' : n.category, tone: n.urgent ? Tone.danger : Tone.brand),
              if (n.urgent) ...[SizedBox(width: 8.w), const Pill('Urgent', tone: Tone.danger, icon: Icons.priority_high_rounded)],
            ]),
            SizedBox(height: 12.h),
            Text(n.title, style: T.h1),
            SizedBox(height: 6.h),
            Text('${n.author.isEmpty ? 'Transport office' : n.author} · ${n.sentAt == null ? '' : fmtDate(n.sentAt!, year: true)} · ${n.audience}', style: T.small),
            SizedBox(height: 16.h),
            AppSurfaceCard(child: Text(n.body.isEmpty ? 'No further details.' : n.body, style: T.body.copyWith(color: C.ink, height: 1.6))),
          ],
        );
      },
    ),
  );
}
