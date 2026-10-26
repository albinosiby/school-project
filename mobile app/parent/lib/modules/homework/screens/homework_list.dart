import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/homework_bloc.dart';
import '../models/homework_models.dart';

Tone homeworkTone(HomeworkStatus s) => switch (s) {
  HomeworkStatus.pending => Tone.warning,
  HomeworkStatus.submitted => Tone.brand,
  HomeworkStatus.reviewed => Tone.success,
  HomeworkStatus.overdue => Tone.danger,
};

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
        builder: (context, data, child) => _HomeworkBody(items: data),
      );
}

class _HomeworkBody extends StatefulWidget {
  const _HomeworkBody({required this.items});
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
    final shown = _filter == 'All'
        ? sorted
        : sorted.where((h) => h.statusAt(now).label == _filter).toList();
    return AppTabBody(
      children: [
        FilterChips(
          items: _filters,
          value: _filter,
          onChanged: (v) => setState(() => _filter = v),
        ),
        SizedBox(height: 14.h),
        if (shown.isEmpty)
          AppEmptyState(
            'No $_filter homework',
            hint: 'Try another filter.',
            icon: Icons.filter_alt_off_outlined,
          )
        else
          for (final h in shown)
            Padding(
              padding: EdgeInsets.only(bottom: 10.h),
              child: AppCard(
                padding: EdgeInsets.all(12.w),
                onTap: () => context.push(RoutePaths.homework(h.id)),
                child: Row(
                  children: [
                    IconTile(
                      Icons.assignment_outlined,
                      tone: homeworkTone(h.statusAt(now)),
                      size: 40,
                    ),
                    SizedBox(width: 12.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            h.title,
                            style: T.bodyStrong,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          SizedBox(height: 2.h),
                          Text(
                            '${h.subject} - due ${fmtDay(h.due, now: now)}',
                            style: T.small,
                          ),
                        ],
                      ),
                    ),
                    SizedBox(width: 8.w),
                    Pill(
                      h.statusAt(now).label,
                      tone: homeworkTone(h.statusAt(now)),
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}
