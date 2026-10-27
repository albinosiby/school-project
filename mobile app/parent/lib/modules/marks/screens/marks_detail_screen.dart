import 'package:flutter/material.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../academics/screens/widgets/academic_section_title.dart';
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
    subtitle: 'Exam result',
    fallbackRoute: RoutePaths.academicsSection('marks'),
    body: ColoredBox(
      color: C.surface,
      child: ChildDataView<MarksBloc, List<ExamResult>>(
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
    ),
  );
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({required this.exam, required this.child});
  final ExamResult exam;
  final Child child;

  void _download(BuildContext context) => AppDialogs.showSnackBar(
    context,
    message:
        'Report card saved: ${child.firstName}_${exam.name.replaceAll(' ', '_')}.pdf',
  );

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
    final best = [...exam.subjects]
      ..sort((a, b) => b.percent.compareTo(a.percent));
    return ListView(
      key: const Key('section-list'),
      padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 24.h),
      children: [
        AppSurfaceCard(
          hero: true,
          child: Column(
            children: [
              Row(
                children: [
                  Avatar(child.name, size: 52),
                  SizedBox(width: 12.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AppEyebrow(exam.name),
                        SizedBox(height: 4.h),
                        Text(
                          child.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T.h1.copyWith(color: C.onSurface),
                        ),
                        Text(
                          'Class ${child.className} • Roll #${child.rollNo} • ${child.admissionNo}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T.small.copyWith(color: C.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              SizedBox(height: 16.h),
              Row(
                children: [
                  AppStatRing(
                    value: exam.percent / 100,
                    label: '${exam.percent.toStringAsFixed(0)}%',
                    size: 76,
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
                          style: T.title.copyWith(color: C.onSurface),
                        ),
                        SizedBox(height: 6.h),
                        Wrap(
                          spacing: 8.w,
                          runSpacing: 6.h,
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
              if (best.length >= 2) ...[
                SizedBox(height: 14.h),
                Row(
                  children: [
                    Expanded(
                      child: AppMetricBox(
                        icon: Icons.trending_up_rounded,
                        value: best.first.subject,
                        label: 'Strongest subject',
                        tone: Tone.success,
                      ),
                    ),
                    SizedBox(width: 8.w),
                    Expanded(
                      child: AppMetricBox(
                        icon: Icons.flag_outlined,
                        value: best.last.subject,
                        label: 'Needs practice',
                        tone: Tone.warning,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
        AcademicSectionTitle(
          'Subject-wise marks',
          icon: Icons.menu_book_rounded,
          caption: '${exam.subjects.length} subjects',
        ),
        AppSurfaceCard(
          padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 6.h),
          child: Column(
            children: [
              for (var i = 0; i < exam.subjects.length; i++) ...[
                if (i > 0) const Divider(height: 1, color: C.outline),
                _SubjectRow(mark: exam.subjects[i]),
              ],
            ],
          ),
        ),
        if (exam.remarks != null) ...[
          const AcademicSectionTitle(
            'Class teacher remarks',
            icon: Icons.rate_review_outlined,
          ),
          AppEntryCard(
            icon: Icons.person_outline_rounded,
            title: child.classTeacher,
            meta: 'Class teacher • ${child.className}',
            body: exam.remarks,
          ),
        ],
        SizedBox(height: 8.h),
        AppButton(
          'Download report card (PDF)',
          icon: Icons.download_rounded,
          onPressed: () => _download(context),
        ),
      ],
    );
  }
}

class _SubjectRow extends StatelessWidget {
  const _SubjectRow({required this.mark});
  final SubjectMark mark;

  @override
  Widget build(BuildContext context) {
    final tone = gradeTone(mark.percent);
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 12.h),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  mark.subject,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.bodyStrong.copyWith(color: C.onSurface),
                ),
              ),
              Text(
                '${mark.obtained.toStringAsFixed(0)} / ${mark.max.toStringAsFixed(0)}',
                style: T.bodyStrong.copyWith(color: C.onSurface),
              ),
              SizedBox(width: 10.w),
              SizedBox(
                width: 48.w,
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Pill(mark.grade, tone: tone),
                ),
              ),
            ],
          ),
          SizedBox(height: 8.h),
          AppProgress(mark.percent / 100, tone: tone, height: 6),
        ],
      ),
    );
  }
}
