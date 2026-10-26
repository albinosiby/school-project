import 'package:flutter/material.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../family/models/family_models.dart';
import '../bloc/marks_bloc.dart';
import '../models/marks_models.dart';
import 'marks_list.dart';

/// Report-card style result of one exam.
class MarksDetailScreen extends StatelessWidget {
  const MarksDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Report card',
    fallbackRoute: RoutePaths.learn,
    body: ChildDataView<MarksBloc, List<ExamResult>>(
      create: () => getIt<MarksBloc>(),
      builder: (context, data, child) {
        final matches = data.where((e) => e.id == id);
        if (matches.isEmpty)
          return Center(
            child: AppEmptyState(
              'Result not found',
              hint: 'It may belong to your other child.',
              icon: Icons.search_off_rounded,
            ),
          );
        return _ReportCard(exam: matches.first, child: child);
      },
    ),
  );
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({required this.exam, required this.child});
  final ExamResult exam;
  final Child child;

  @override
  Widget build(BuildContext context) {
    if (!exam.published)
      return Center(
        child: AppEmptyState(
          'Results awaited',
          hint: '${exam.name} is on ${fmtDate(exam.date, year: true)}.',
          icon: Icons.hourglass_top_rounded,
        ),
      );
    final tone = gradeTone(exam.percent);
    return ListView(
      padding: EdgeInsets.all(S.page),
      children: [
        PanelCard(
          padding: EdgeInsets.all(16.w),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(exam.name.toUpperCase(), style: T.caps),
              SizedBox(height: 4.h),
              Text(child.name, style: T.h1),
              Text(
                'Grade ${child.className} - Roll no. ${child.rollNo} - ${child.admissionNo}',
                style: T.small,
              ),
              SizedBox(height: 14.h),
              Row(
                children: [
                  AppStatRing(
                    value: exam.percent / 100,
                    label: '${exam.percent.toStringAsFixed(0)}%',
                    size: 72,
                    stroke: 7,
                    color: toneColors(tone).fg,
                  ),
                  SizedBox(width: 16.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${exam.obtained.toStringAsFixed(0)} / ${exam.max.toStringAsFixed(0)}',
                          key: const Key('exam-total'),
                          style: T.stat,
                        ),
                        SizedBox(height: 4.h),
                        Wrap(
                          spacing: 8.w,
                          children: [
                            Pill('Grade ${exam.grade}', tone: tone),
                            if (exam.rank != null)
                              Pill(
                                'Rank ${exam.rank}/${exam.classSize}',
                                tone: Tone.purple,
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SectionHeader('Subject-wise marks'),
        AppCard(
          padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 6.h),
          child: Column(
            children: [
              for (var i = 0; i < exam.subjects.length; i++) ...[
                if (i > 0) const Divider(),
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 10.h),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              exam.subjects[i].subject,
                              style: T.bodyStrong,
                            ),
                          ),
                          Text(
                            '${exam.subjects[i].obtained.toStringAsFixed(0)} / ${exam.subjects[i].max.toStringAsFixed(0)}',
                            style: T.bodyStrong,
                          ),
                          SizedBox(width: 10.w),
                          SizedBox(
                            width: 54.w,
                            child: Align(
                              alignment: Alignment.centerRight,
                              child: Pill(
                                exam.subjects[i].grade,
                                tone: gradeTone(exam.subjects[i].percent),
                              ),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 8.h),
                      AppProgress(
                        exam.subjects[i].percent / 100,
                        tone: gradeTone(exam.subjects[i].percent),
                        height: 6,
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        if (exam.remarks != null) ...[
          const SectionHeader('Class teacher remarks'),
          AppCard(
            child: Text(exam.remarks!, style: T.body.copyWith(color: C.ink)),
          ),
          SizedBox(height: 4.h),
          Text('- ${child.classTeacher}', style: T.small),
        ],
      ],
    );
  }
}
