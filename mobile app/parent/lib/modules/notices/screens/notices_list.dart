import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/notices_bloc.dart';
import '../models/notice_models.dart';

Tone noticeTone(NoticeCategory c) => switch (c) {
  NoticeCategory.general => Tone.neutral,
  NoticeCategory.event => Tone.purple,
  NoticeCategory.holiday => Tone.success,
  NoticeCategory.exam => Tone.warning,
  NoticeCategory.urgent => Tone.danger,
};

class NoticesList extends StatelessWidget {
  const NoticesList({super.key});

  @override
  Widget build(BuildContext context) =>
      ChildDataView<NoticesBloc, List<Notice>>(
        create: () => getIt<NoticesBloc>(),
        isEmpty: (d) => d.isEmpty,
        emptyTitle: 'No notices',
        emptyHint: 'School and class notices will appear here.',
        emptyIcon: Icons.campaign_outlined,
        builder: (context, data, child) {
          final sorted = [...data]
            ..sort((a, b) {
              if (a.needsAction != b.needsAction) return a.needsAction ? -1 : 1;
              return b.date.compareTo(a.date);
            });
          return AppTabBody(
            children: [
              for (final n in sorted)
                Padding(
                  padding: EdgeInsets.only(bottom: 10.h),
                  child: AppCard(
                    key: ValueKey('notice-${n.id}'),
                    padding: EdgeInsets.all(14.w),
                    onTap: () => _open(context, n),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Pill(
                              n.category.label,
                              tone: noticeTone(n.category),
                            ),
                            const Spacer(),
                            Text(fmtDay(n.date), style: T.small),
                          ],
                        ),
                        SizedBox(height: 8.h),
                        Text(n.title, style: T.h3),
                        SizedBox(height: 4.h),
                        Text(
                          n.body,
                          style: T.body,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        SizedBox(height: 8.h),
                        Row(
                          children: [
                            Expanded(child: Text(n.from, style: T.small)),
                            if (n.requiresAck && n.acknowledged)
                              const Pill(
                                'Acknowledged',
                                tone: Tone.success,
                                icon: Icons.check_rounded,
                              ),
                            if (n.needsAction)
                              AppButton(
                                'Acknowledge',
                                small: true,
                                expand: false,
                                icon: Icons.check_rounded,
                                onPressed: () => context
                                    .read<NoticesBloc>()
                                    .add(AcknowledgeNotice(n.id)),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      );

  void _open(BuildContext context, Notice n) {
    final bloc = context.read<NoticesBloc>();
    showAppSheet<void>(
      context,
      title: n.title,
      subtitle: '${n.from} - ${fmtDate(n.date, year: true)}',
      builder: (ctx) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(n.body, style: T.body.copyWith(color: C.ink)),
          if (n.needsAction) ...[
            SizedBox(height: 16.h),
            AppButton(
              'Acknowledge',
              icon: Icons.check_rounded,
              onPressed: () {
                bloc.add(AcknowledgeNotice(n.id));
                Navigator.of(ctx).pop();
              },
            ),
          ],
        ],
      ),
    );
  }
}
