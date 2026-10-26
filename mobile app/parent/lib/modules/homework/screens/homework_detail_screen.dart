import 'package:flutter/material.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/homework_bloc.dart';
import '../models/homework_models.dart';
import 'homework_list.dart';

class HomeworkDetailScreen extends StatelessWidget {
  const HomeworkDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Homework',
    fallbackRoute: RoutePaths.learn,
    body: ChildDataView<HomeworkBloc, List<Homework>>(
      create: () => getIt<HomeworkBloc>(),
      builder: (context, data, child) {
        final matches = data.where((h) => h.id == id);
        if (matches.isEmpty)
          return Center(
            child: AppEmptyState(
              'Homework not found',
              hint:
                  'It may belong to your other child. Switch child on the Learn tab.',
              icon: Icons.search_off_rounded,
            ),
          );
        final h = matches.first;
        final now = DateTime.now();
        final status = h.statusAt(now);
        return ListView(
          padding: EdgeInsets.all(S.page),
          children: [
            Row(
              children: [
                Pill(h.subject, tone: Tone.purple),
                SizedBox(width: 8.w),
                Pill(status.label, tone: homeworkTone(status), dot: true),
              ],
            ),
            SizedBox(height: 12.h),
            Text(h.title, style: T.title),
            SizedBox(height: 14.h),
            Row(
              children: [
                Expanded(
                  child: AppInfoTile(
                    icon: Icons.event_outlined,
                    label: 'ASSIGNED',
                    value: fmtDate(h.assignedOn),
                    compact: true,
                  ),
                ),
                SizedBox(width: 10.w),
                Expanded(
                  child: AppInfoTile(
                    icon: Icons.alarm_rounded,
                    label: 'DUE',
                    value: fmtDate(h.due),
                    compact: true,
                    iconColor: status == HomeworkStatus.overdue
                        ? C.danger
                        : C.slate,
                  ),
                ),
              ],
            ),
            SizedBox(height: 10.h),
            AppInfoTile(
              icon: Icons.person_outline_rounded,
              label: 'SET BY',
              value: h.teacher,
            ),
            const SectionHeader('Instructions'),
            AppCard(
              child: Text(h.description, style: T.body.copyWith(color: C.ink)),
            ),
            if (h.attachments.isNotEmpty) ...[
              const SectionHeader('Attachments'),
              for (final f in h.attachments)
                Padding(
                  padding: EdgeInsets.only(bottom: 8.h),
                  child: AppFileChip(name: f, sub: 'Shared by teacher'),
                ),
            ],
            if (h.reviewed) ...[
              const SectionHeader('Teacher feedback'),
              PanelCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (h.score != null) Text('Score: ${h.score}', style: T.h2),
                    if (h.remark != null) ...[
                      SizedBox(height: 4.h),
                      Text(h.remark!, style: T.body.copyWith(color: C.ink)),
                    ],
                  ],
                ),
              ),
            ],
          ],
        );
      },
    ),
  );
}
