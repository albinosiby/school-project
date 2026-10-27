import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../academics/screens/widgets/academic_section_title.dart';
import '../bloc/homework_bloc.dart';
import '../models/homework_models.dart';
import 'homework_list.dart';

/// One homework assignment: status, dates, instructions, attachments and teacher feedback.
class HomeworkDetailScreen extends StatelessWidget {
  const HomeworkDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Homework',
    subtitle: 'Assignment details',
    fallbackRoute: RoutePaths.academicsSection('homework'),
    body: ColoredBox(
      color: C.surface,
      child: ChildDataView<HomeworkBloc, List<Homework>>(
        create: () => getIt<HomeworkBloc>(),
        builder: (context, data, child) {
          final matches = data.where((h) => h.id == id);
          if (matches.isEmpty)
            return Center(
              child: AppEmptyState(
                'Homework not found',
                hint:
                    'It may belong to your other child. Switch child on the Academics tab.',
                icon: Icons.search_off_rounded,
              ),
            );
          return _HomeworkDetail(h: matches.first);
        },
      ),
    ),
  );
}

class _HomeworkDetail extends StatelessWidget {
  const _HomeworkDetail({required this.h});
  final Homework h;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final status = h.statusAt(now);
    final daysLeft = dateOnly(h.due).difference(dateOnly(now)).inDays;
    final countdown = switch (status) {
      HomeworkStatus.reviewed => 'Reviewed by teacher',
      HomeworkStatus.submitted => 'Submitted, awaiting review',
      HomeworkStatus.overdue =>
        'Overdue by ${-daysLeft} day${daysLeft == -1 ? '' : 's'}',
      HomeworkStatus.pending =>
        daysLeft == 0
            ? 'Due today'
            : 'Due in $daysLeft day${daysLeft == 1 ? '' : 's'}',
    };
    return ListView(
      key: const Key('section-list'),
      padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 24.h),
      children: [
        AppSurfaceCard(
          hero: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: AppTagChip(
                      h.subject,
                      icon: Icons.auto_stories_outlined,
                    ),
                  ),
                  SizedBox(width: 8.w),
                  Pill(status.label, tone: homeworkTone(status), dot: true),
                ],
              ),
              SizedBox(height: 12.h),
              Text(h.title, style: T.h1.copyWith(color: C.onSurface)),
              SizedBox(height: 6.h),
              Text(
                'Set by ${h.teacher}',
                style: T.small.copyWith(color: C.onSurfaceVariant),
              ),
              SizedBox(height: 14.h),
              Row(
                children: [
                  Expanded(
                    child: AppMetricBox(
                      icon: Icons.event_outlined,
                      value: fmtDate(h.assignedOn),
                      label: 'Assigned',
                    ),
                  ),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: AppMetricBox(
                      icon: Icons.alarm_rounded,
                      value: fmtDate(h.due),
                      label: countdown,
                      tone: homeworkTone(status),
                      valueColor: status == HomeworkStatus.overdue
                          ? C.danger
                          : null,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const AcademicSectionTitle(
          'Instructions',
          icon: Icons.description_outlined,
        ),
        AppSurfaceCard(
          child: Container(
            padding: EdgeInsets.only(left: 12.w),
            decoration: const BoxDecoration(
              border: Border(left: BorderSide(color: C.indigoSoft, width: 2)),
            ),
            child: Text(
              h.description,
              style: T.body.copyWith(color: C.onSurfaceVariant),
            ),
          ),
        ),
        if (h.attachments.isNotEmpty) ...[
          AcademicSectionTitle(
            'Attachments',
            icon: Icons.attach_file_rounded,
            caption:
                '${h.attachments.length} file${h.attachments.length == 1 ? '' : 's'}',
          ),
          for (final f in h.attachments)
            Padding(
              padding: EdgeInsets.only(bottom: 8.h),
              child: AppFileChip(
                name: f,
                sub: 'Shared by teacher',
                onTap: () => AppDialogs.showSnackBar(
                  context,
                  message: '$f downloaded to this device',
                ),
                trailing: Icon(
                  Icons.download_rounded,
                  size: 20.r,
                  color: C.primary,
                  semanticLabel: 'Download $f',
                ),
              ),
            ),
        ],
        if (h.reviewed) ...[
          const AcademicSectionTitle(
            'Teacher feedback',
            icon: Icons.rate_review_outlined,
          ),
          AppEntryCard(
            icon: Icons.verified_rounded,
            tone: Tone.success,
            title: h.score == null ? 'Reviewed' : 'Score ${h.score}',
            meta: h.teacher,
            body: h.remark,
          ),
        ],
        SizedBox(height: 10.h),
        Row(
          children: [
            Expanded(
              child: AppButton(
                'Message teacher',
                icon: Icons.chat_bubble_outline_rounded,
                kind: BtnKind.outline,
                onPressed: () => context.go(RoutePaths.messages),
              ),
            ),
            if (status == HomeworkStatus.pending) ...[
              SizedBox(width: 10.w),
              Expanded(
                child: AppButton(
                  'Remind me',
                  icon: Icons.notifications_active_outlined,
                  onPressed: () => AppDialogs.showSnackBar(
                    context,
                    message:
                        'Reminder set for ${fmtDay(h.due, now: now)} morning',
                  ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}
