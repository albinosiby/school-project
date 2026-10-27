import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../academics/screens/widgets/academic_section_title.dart';
import '../bloc/marks_bloc.dart';
import '../models/marks_models.dart';

Tone gradeTone(double percent) => percent >= 80
    ? Tone.success
    : (percent >= 60
          ? Tone.brand
          : (percent >= 40 ? Tone.warning : Tone.danger));

/// Short axis label for a subject ("Mathematics" -> "Math").
String subjectShort(String s) => s.length <= 5 ? s : s.substring(0, 4);

/// Marks section of the Academics tab: latest result, subject snapshot and the exam list.
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
      final published = sorted.where((e) => e.published).toList();
      final latest = published.isEmpty ? null : published.first;
      return ListView(
      key: const Key('section-list'),
        padding: academicListPadding(),
        children: [
          if (latest != null)
            _LatestCard(exam: latest, count: published.length)
          else
            AppSurfaceCard(
              hero: true,
              child: AppEmptyState(
                'Results awaited',
                hint: 'No exam results have been published yet.',
                icon: Icons.hourglass_top_rounded,
              ),
            ),
          if (latest != null) ...[
            AcademicSectionTitle(
              'Subject snapshot',
              icon: Icons.insights_rounded,
              caption: latest.name,
            ),
            AppSurfaceCard(
              padding: EdgeInsets.fromLTRB(12.w, 16.h, 12.w, 12.h),
              child: AppBarChart(
                values: [for (final s in latest.subjects) s.percent],
                labels: [
                  for (final s in latest.subjects) subjectShort(s.subject),
                ],
                target: 75,
                lowIndex: _extreme(latest.subjects, low: true),
                highIndex: _extreme(latest.subjects, low: false),
                height: 160,
              ),
            ),
          ],
          AcademicSectionTitle(
            'Exams & report cards',
            icon: Icons.workspace_premium_outlined,
            caption: '${sorted.length} exams',
          ),
          for (final e in sorted)
            AppEntryCard(
              key: Key('exam-${e.id}'),
              icon: e.published
                  ? Icons.grading_rounded
                  : Icons.hourglass_top_rounded,
              tone: e.published ? gradeTone(e.percent) : Tone.neutral,
              title: e.name,
              badge: e.published
                  ? Pill('Grade ${e.grade}', tone: gradeTone(e.percent))
                  : const Pill('Results awaited', tone: Tone.neutral),
              meta: e.published
                  ? '${fmtDate(e.date, year: true)}${e.rank != null ? ' • Rank ${e.rank}/${e.classSize}' : ''}'
                  : 'Scheduled ${fmtDate(e.date, year: true)}',
              trailing: e.published
                  ? AppStatRing(
                      value: e.percent / 100,
                      label: '${e.percent.toStringAsFixed(0)}%',
                      size: 48,
                      stroke: 4,
                      color: toneColors(gradeTone(e.percent)).fg,
                    )
                  : null,
              footer: e.published
                  ? [
                      AppMetaChip(
                        '${e.obtained.toStringAsFixed(0)} / ${e.max.toStringAsFixed(0)} marks',
                        icon: Icons.functions_rounded,
                      ),
                      const AppMetaChip(
                        'View report card',
                        icon: Icons.arrow_forward_rounded,
                        color: C.primary,
                      ),
                    ]
                  : const [],
              onTap: e.published
                  ? () => context.push(RoutePaths.marks(e.id))
                  : () => AppDialogs.showSnackBar(
                      context,
                      message:
                          '${e.name} results will be published after ${fmtDate(e.date)}.',
                    ),
            ),
          academicListEnd(),
        ],
      );
    },
  );

  static int? _extreme(List<SubjectMark> s, {required bool low}) {
    if (s.length < 2) return null;
    var idx = 0;
    for (var i = 1; i < s.length; i++) {
      if (low ? s[i].percent < s[idx].percent : s[i].percent > s[idx].percent)
        idx = i;
    }
    return idx;
  }
}

class _LatestCard extends StatelessWidget {
  const _LatestCard({required this.exam, required this.count});
  final ExamResult exam;
  final int count;

  @override
  Widget build(BuildContext context) {
    final tone = gradeTone(exam.percent);
    return AppSurfaceCard(
      hero: true,
      onTap: () => context.push(RoutePaths.marks(exam.id)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const AppEyebrow('Latest result'),
                    SizedBox(height: 8.h),
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8.w,
                      children: [
                        Text(
                          '${exam.percent.toStringAsFixed(1)}%',
                          key: const Key('latest-percent'),
                          style: T.title.copyWith(
                            fontSize: 28.sp,
                            color: C.onSurface,
                          ),
                        ),
                        Text(
                          'Grade ${exam.grade}',
                          style: T.h3.copyWith(
                            color: C.primary,
                            fontSize: 16.sp,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '${exam.name} • ${fmtDate(exam.date, year: true)}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.small.copyWith(color: C.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              Container(
                width: 48.r,
                height: 48.r,
                decoration: BoxDecoration(
                  color: C.primary,
                  borderRadius: BorderRadius.circular(R.md),
                ),
                child: Icon(
                  Icons.emoji_events_outlined,
                  color: Colors.white,
                  size: 24.r,
                ),
              ),
            ],
          ),
          SizedBox(height: 14.h),
          Row(
            children: [
              Expanded(
                child: AppMetricBox(
                  icon: Icons.leaderboard_outlined,
                  value: exam.rank == null ? '—' : '#${exam.rank}',
                  label: exam.classSize == null
                      ? 'Class rank'
                      : 'of ${exam.classSize} students',
                  badge: exam.rank != null && exam.rank! <= 5 ? 'Top 5' : null,
                ),
              ),
              SizedBox(width: 8.w),
              Expanded(
                child: AppMetricBox(
                  icon: Icons.functions_rounded,
                  value: exam.obtained.toStringAsFixed(0),
                  label: 'of ${exam.max.toStringAsFixed(0)} marks',
                  tone: tone,
                ),
              ),
              SizedBox(width: 8.w),
              Expanded(
                child: AppMetricBox(
                  icon: Icons.fact_check_outlined,
                  value: '$count',
                  label: 'Exams published',
                  tone: Tone.purple,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
