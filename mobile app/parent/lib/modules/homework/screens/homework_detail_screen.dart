import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../academics/screens/widgets/academic_section_title.dart';
import '../bloc/homework_bloc.dart';
import '../models/homework_models.dart';
import 'handin_sheet.dart';
import 'homework_list.dart';

/// One homework assignment: status, dates, instructions, attachments, the hand-in and teacher feedback.
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
          return _HomeworkDetail(h: matches.first, childId: child.id);
        },
      ),
    ),
  );
}

class _HomeworkDetail extends StatelessWidget {
  const _HomeworkDetail({required this.h, required this.childId});
  final Homework h;
  final String childId;

  Future<void> _handIn(BuildContext context) async {
    final done = await showHandinSheet(context, h, childId: childId);
    if (done == true && context.mounted) {
      AppDialogs.showSnackBar(context, message: h.submitted ? 'Submission replaced' : 'Homework handed in');
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final status = h.statusAt(now);
    final daysLeft = dateOnly(h.due).difference(dateOnly(now)).inDays;
    final countdown = switch (status) {
      HomeworkStatus.reviewed => 'Reviewed by teacher',
      HomeworkStatus.submitted => h.late ? 'Handed in late, awaiting review' : 'Submitted, awaiting review',
      HomeworkStatus.overdue =>
        'Overdue by ${-daysLeft} day${daysLeft == -1 ? '' : 's'}',
      HomeworkStatus.pending =>
        daysLeft == 0
            ? 'Due today'
            : 'Due in $daysLeft day${daysLeft == 1 ? '' : 's'}',
    };
    return ListView(
      key: const Key('section-list'),
      // room at the end so the last buttons stay clear of snackbars
      padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 96.h),
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
          _GradeCard(h: h),
        ],
        const AcademicSectionTitle('Hand in', icon: Icons.upload_file_rounded),
        _HandinCard(h: h, onHandIn: () => _handIn(context)),
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

/// Marks (large) and the teacher's feedback once the homework is graded.
class _GradeCard extends StatelessWidget {
  const _GradeCard({required this.h});
  final Homework h;
  @override
  Widget build(BuildContext context) => AppSurfaceCard(
    key: const Key('homework-grade'),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 10.h),
          decoration: BoxDecoration(color: C.successSoft, borderRadius: BorderRadius.circular(R.md)),
          child: Column(
            children: [
              Text(h.score ?? '✓', style: T.h1.copyWith(color: C.success)),
              Text(h.score == null ? 'Reviewed' : 'Marks', style: T.small.copyWith(color: C.success)),
            ],
          ),
        ),
        SizedBox(width: 14.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(h.teacher, style: T.bodyStrong.copyWith(color: C.onSurface)),
              SizedBox(height: 4.h),
              Text(h.remark ?? 'No written feedback.', style: T.body.copyWith(color: C.onSurfaceVariant)),
            ],
          ),
        ),
      ],
    ),
  );
}

/// What was handed in (files, note, when, late) and the button to hand in or replace while allowed.
class _HandinCard extends StatelessWidget {
  const _HandinCard({required this.h, required this.onHandIn});
  final Homework h;
  final VoidCallback onHandIn;

  @override
  Widget build(BuildContext context) {
    final handed = h.files.isNotEmpty || h.submittedAt != null;
    return AppSurfaceCard(
      key: const Key('homework-handin'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (handed) ...[
            Row(
              children: [
                Icon(Icons.assignment_turned_in_outlined, size: 20.r, color: C.primary),
                SizedBox(width: 8.w),
                Expanded(
                  child: Text(
                    h.submittedAt == null
                        ? 'Handed in'
                        : 'Submitted on ${fmtDate(h.submittedAt!)}, ${fmtClock(h.submittedAt!)}',
                    style: T.bodyStrong.copyWith(color: C.onSurface),
                  ),
                ),
                if (h.late) const Pill('Late', tone: Tone.warning),
              ],
            ),
            SizedBox(height: 10.h),
            for (final f in h.files)
              Padding(
                padding: EdgeInsets.only(bottom: 6.h),
                child: AppFileChip(
                  name: f.name,
                  size: f.size > 0 ? f.sizeLabel : null,
                  tone: f.isImage ? Tone.brand : Tone.danger,
                  onTap: f.url.isEmpty ? null : () => launchUrl(Uri.parse(f.url), mode: LaunchMode.externalApplication),
                  trailing: f.url.isEmpty ? null : Icon(Icons.open_in_new_rounded, size: 18.r, color: C.primary, semanticLabel: 'Open ${f.name}'),
                ),
              ),
            if (h.note.isNotEmpty) ...[
              SizedBox(height: 4.h),
              Text('Note: ${h.note}', style: T.small.copyWith(color: C.onSurfaceVariant)),
            ],
          ] else if (h.submitted)
            Text('The teacher marked this as handed in.', style: T.body.copyWith(color: C.onSurfaceVariant))
          else if (h.open)
            Text(
              'Take photos of the finished work or add a PDF, and hand it in before ${fmtDate(h.due)}.',
              style: T.body.copyWith(color: C.onSurfaceVariant),
            )
          else
            Text('The teacher has closed this homework, so it can no longer be handed in.', style: T.body.copyWith(color: C.onSurfaceVariant)),
          if (h.canSubmit) ...[
            SizedBox(height: 12.h),
            AppButton(
              handed || h.submitted ? 'Replace submission' : 'Submit homework',
              key: const Key('homework-submit'),
              icon: handed || h.submitted ? Icons.sync_rounded : Icons.upload_rounded,
              kind: handed || h.submitted ? BtnKind.outline : BtnKind.primary,
              onPressed: onHandIn,
            ),
          ],
        ],
      ),
    );
  }
}
