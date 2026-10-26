import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/marks_bloc.dart';
import '../models/marks_models.dart';

Tone gradeTone(double percent) => percent >= 80
    ? Tone.success
    : (percent >= 60
          ? Tone.brand
          : (percent >= 40 ? Tone.warning : Tone.danger));

class MarksList extends StatelessWidget {
  const MarksList({super.key});

  @override
  Widget build(
    BuildContext context,
  ) => ChildDataView<MarksBloc, List<ExamResult>>(
    create: () => getIt<MarksBloc>(),
    isEmpty: (d) => d.isEmpty,
    emptyTitle: 'No exams yet',
    emptyHint: 'Exam results will appear here once published.',
    emptyIcon: Icons.grading_outlined,
    builder: (context, data, child) {
      final sorted = [...data]..sort((a, b) => b.date.compareTo(a.date));
      return AppTabBody(
        children: [
          for (final e in sorted)
            Padding(
              padding: EdgeInsets.only(bottom: 10.h),
              child: AppCard(
                padding: EdgeInsets.all(14.w),
                onTap: e.published
                    ? () => context.push(RoutePaths.marks(e.id))
                    : null,
                child: Row(
                  children: [
                    if (e.published)
                      AppStatRing(
                        value: e.percent / 100,
                        size: 52,
                        stroke: 5,
                        color: toneColors(gradeTone(e.percent)).fg,
                      )
                    else
                      const IconTile(
                        Icons.hourglass_top_rounded,
                        tone: Tone.neutral,
                        size: 48,
                      ),
                    SizedBox(width: 14.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(e.name, style: T.h3),
                          SizedBox(height: 2.h),
                          Text(
                            e.published
                                ? '${fmtDate(e.date, year: true)}${e.rank != null ? ' - Rank ${e.rank}/${e.classSize}' : ''}'
                                : 'Scheduled ${fmtDate(e.date, year: true)}',
                            style: T.small,
                          ),
                        ],
                      ),
                    ),
                    if (e.published)
                      Pill('Grade ${e.grade}', tone: gradeTone(e.percent))
                    else
                      const Pill('Upcoming', tone: Tone.neutral),
                  ],
                ),
              ),
            ),
        ],
      );
    },
  );
}
