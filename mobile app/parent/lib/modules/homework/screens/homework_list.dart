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

Tone homeworkTone(HomeworkStatus s) => switch (s) {
  HomeworkStatus.pending => Tone.warning,
  HomeworkStatus.submitted => Tone.brand,
  HomeworkStatus.reviewed => Tone.success,
  HomeworkStatus.overdue => Tone.danger,
};

IconData homeworkIcon(HomeworkStatus s) => switch (s) {
  HomeworkStatus.pending => Icons.assignment_outlined,
  HomeworkStatus.submitted => Icons.assignment_turned_in_outlined,
  HomeworkStatus.reviewed => Icons.task_alt_rounded,
  HomeworkStatus.overdue => Icons.assignment_late_outlined,
};

/// Homework section of the Academics tab: counts, status filter and the assignment feed.
class HomeworkList extends StatelessWidget {
  const HomeworkList({super.key});

  @override
  Widget build(BuildContext context) =>
      ChildDataView<HomeworkBloc, List<Homework>>(
        create: () => getIt<HomeworkBloc>(),
        isEmpty: (d) => d.isEmpty,
        emptyTitle: 'No homework',
        emptyHint: 'Homework set by teachers will appear here.',
        emptyIcon: Icons.assignment_outlined,
        builder: (context, data, child) =>
            _HomeworkBody(key: ValueKey(child.id), items: data),
      );
}

class _HomeworkBody extends StatefulWidget {
  const _HomeworkBody({super.key, required this.items});
  final List<Homework> items;

  @override
  State<_HomeworkBody> createState() => _HomeworkBodyState();
}

class _HomeworkBodyState extends State<_HomeworkBody> {
  static const _filters = [
    'All',
    'Pending',
    'Overdue',
    'Submitted',
    'Reviewed',
  ];
  String _filter = 'All';

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final sorted = [...widget.items]..sort((a, b) => b.due.compareTo(a.due));
    int count(String f) => f == 'All'
        ? sorted.length
        : sorted.where((h) => h.statusAt(now).label == f).length;
    final shown = _filter == 'All'
        ? sorted
        : sorted.where((h) => h.statusAt(now).label == _filter).toList();
    final dueSoon = sorted
        .where(
          (h) =>
              h.statusAt(now) == HomeworkStatus.pending &&
              !dateOnly(h.due).isAfter(plusDays(2, from: dateOnly(now))),
        )
        .length;
    final done = count('Submitted') + count('Reviewed');
    return ListView(
      key: const Key('section-list'),
      padding: academicListPadding(),
      children: [
        AppSurfaceCard(
          hero: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const AppEyebrow('Homework tracker'),
              SizedBox(height: 8.h),
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8.w,
                children: [
                  Text(
                    '$done/${sorted.length}',
                    key: const Key('homework-done'),
                    style: T.title.copyWith(
                      fontSize: 28.sp,
                      color: C.onSurface,
                    ),
                  ),
                  Text(
                    'Completed',
                    style: T.h3.copyWith(color: C.primary, fontSize: 16.sp),
                  ),
                ],
              ),
              Text(
                dueSoon == 0
                    ? 'Nothing due in the next two days'
                    : '$dueSoon due in the next two days',
                style: T.small.copyWith(color: C.onSurfaceVariant),
              ),
              SizedBox(height: 14.h),
              Row(
                children: [
                  Expanded(
                    child: AppMetricBox(
                      icon: Icons.pending_actions_rounded,
                      value: '${count('Pending')}',
                      label: 'Pending',
                      tone: Tone.warning,
                    ),
                  ),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: AppMetricBox(
                      icon: Icons.assignment_late_outlined,
                      value: '${count('Overdue')}',
                      label: 'Overdue',
                      tone: Tone.danger,
                      badge: count('Overdue') > 0 ? 'Act now' : null,
                    ),
                  ),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: AppMetricBox(
                      icon: Icons.task_alt_rounded,
                      value: '${count('Reviewed')}',
                      label: 'Reviewed',
                      tone: Tone.success,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        SizedBox(height: 12.h),
        AppSolidChips(
          items: _filters,
          value: _filter,
          labelOf: (f) => '$f (${count(f)})',
          onChanged: (v) => setState(() => _filter = v),
        ),
        AcademicSectionTitle(
          'Assignment feed',
          icon: Icons.menu_book_rounded,
          caption: '${shown.length} shown',
        ),
        if (shown.isEmpty)
          AppSurfaceCard(
            child: Center(
              child: AppEmptyState(
                'No $_filter homework',
                hint: 'Try another filter.',
                icon: Icons.filter_alt_off_outlined,
              ),
            ),
          )
        else
          for (final h in shown)
            Builder(
              builder: (context) {
                final s = h.statusAt(now);
                return AppEntryCard(
                  key: Key('homework-${h.id}'),
                  icon: homeworkIcon(s),
                  tone: homeworkTone(s),
                  title: h.title,
                  badge: AppTagChip(
                    h.subject,
                    icon: Icons.auto_stories_outlined,
                  ),
                  meta: '${h.teacher} • due ${fmtDay(h.due, now: now)}',
                  trailing: Pill(s.label, tone: homeworkTone(s)),
                  footer: [
                    AppMetaChip(
                      'Assigned ${fmtShort(h.assignedOn)}',
                      icon: Icons.event_outlined,
                    ),
                    if (h.attachments.isNotEmpty)
                      AppMetaChip(
                        '${h.attachments.length} attachment${h.attachments.length == 1 ? '' : 's'}',
                        icon: Icons.attach_file_rounded,
                      ),
                    if (h.score != null)
                      AppMetaChip(
                        'Score ${h.score}',
                        icon: Icons.star_outline_rounded,
                        color: C.primary,
                      ),
                  ],
                  onTap: () => context.push(RoutePaths.homework(h.id)),
                );
              },
            ),
        academicListEnd(),
      ],
    );
  }
}
