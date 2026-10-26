import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../home/screens/widgets/teacher_tab_header.dart';
import '../bloc/tasks_bloc.dart';
import '../bloc/tasks_events.dart';
import '../bloc/tasks_states.dart';
import '../models/task_models.dart';
import 'widgets/task_card.dart';

const _sections = [
  ('Academic & Grading', Icons.school_outlined),
  ('Lesson Prep', Icons.menu_book_outlined),
  ('Admin & Compliance', Icons.business_center_outlined),
  ('Student Follow-up', Icons.support_agent_outlined),
  (kReminderCategory, Icons.alarm_rounded),
];

/// Tasks tab (Figma 1153:819): weekly workload, stats, filters, urgent card and tasks grouped by category.
class TasksScreen extends StatelessWidget {
  const TasksScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(create: (_) => getIt<TasksBloc>()..add(const TasksLoadRequested()), child: const _TasksView());
}

class _TasksView extends StatefulWidget {
  const _TasksView();
  @override
  State<_TasksView> createState() => _TasksViewState();
}

class _TasksViewState extends State<_TasksView> {
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final s = context.watch<TasksBloc>().state;
    final header = TeacherTabHeader(title: 'Tasks', subtitle: s.teacher?.name, icon: Icons.assignment_outlined);
    if (s.status != TasksStatus.loaded) {
      return Column(children: [
        header,
        Expanded(
          child: s.status == TasksStatus.failure
              ? AppErrorWidget(message: s.error ?? 'Could not load tasks', onRetry: () => context.read<TasksBloc>().add(const TasksLoadRequested()))
              : const Center(child: CircularProgressIndicator()),
        ),
      ]);
    }

    final open = s.open;
    final dueToday = s.dueToday;
    final grading = s.openIn('Academic & Grading'), admin = s.openIn('Admin & Compliance'), follow = s.openIn('Student Follow-up');
    final done = s.done;
    final (toGrade, gradeClass) = s.toGrade;

    final labels = {
      'all': 'All Tasks (${open.length})', 'today': 'Due Today (${dueToday.length})', 'grading': 'Grading (${grading.length})',
      'admin': 'Admin (${admin.length})', 'follow': 'Follow-ups (${follow.length})', 'done': 'Done (${done.length})',
    };
    final keys = labels.keys.toList();
    final shown = switch (_filter) { 'today' => dueToday, 'grading' => grading, 'admin' => admin, 'follow' => follow, 'done' => done, _ => open };

    TaskItem? urgent;
    if (_filter != 'done') {
      final cands = [for (final t in shown) if (t.priority == 'urgent') t]..sort((a, b) => (b.total != null ? 1 : 0).compareTo(a.total != null ? 1 : 0));
      urgent = cands.firstOrNull;
    }
    final rest = [for (final t in shown) if (t != urgent) t];

    final children = <Widget>[
      _Workload(done: s.weekDone, total: s.weekTasks.length, pct: s.weekPct, term: s.teacher?.term ?? ''),
      SizedBox(height: 12.h),
      Row(children: [
        Expanded(child: StatTile(label: 'Due Today', value: '${dueToday.length}', icon: Icons.alarm_rounded, onTap: () => setState(() => _filter = 'today'))),
        SizedBox(width: 10.w),
        Expanded(child: StatTile(label: 'To Grade', value: '$toGrade', icon: Icons.rate_review_outlined, badge: gradeClass, onTap: () => setState(() => _filter = 'grading'))),
        SizedBox(width: 10.w),
        Expanded(child: StatTile(label: 'Efficiency', value: '${s.weekPct}%', icon: Icons.task_alt_rounded)),
      ]),
      SizedBox(height: 16.h),
      FilterChips(items: labels.values.toList(), value: labels[_filter]!, onChanged: (v) => setState(() => _filter = keys[labels.values.toList().indexOf(v)])),
    ];
    final list = <Widget>[
      SizedBox(height: 16.h),
      if (urgent != null) UrgentTaskCard(urgent, key: ValueKey('urgent_${urgent.id}')),
    ];

    var firstHeader = true;
    for (final sec in _sections) {
      final items = [for (final t in rest) if (t.category == sec.$1) t];
      if (items.isEmpty) continue;
      final name = switch (sec.$1) { 'Student Follow-up' => 'Student Follow-ups', kReminderCategory => 'Reminders', _ => sec.$1 };
      list.add(_SectionRow(title: name, icon: sec.$2, count: '${items.length} ${sec.$1 == 'Student Follow-up' ? 'Pending' : 'Tasks'}', showAdd: firstHeader));
      firstHeader = false;
      for (final t in items) {
        list.add(TaskCard(t, key: ValueKey(t.id)));
      }
    }
    // Tasks whose category is not one of the sections (legacy data) still show up.
    final others = [for (final t in rest) if (!_sections.any((x) => x.$1 == t.category)) t];
    for (final t in others) {
      list.add(TaskCard(t, key: ValueKey(t.id)));
    }
    if (rest.isEmpty && urgent == null) {
      list.add(const Align(alignment: Alignment.centerRight, child: _AddButton()));
      list.add(AppEmptyState(_filter == 'done' ? 'Nothing completed yet' : 'You are all caught up', hint: 'Tap Add Task / Reminder to create one.', icon: Icons.task_alt_rounded));
    } else if (firstHeader) {
      list.add(const Align(alignment: Alignment.centerRight, child: _AddButton()));
    }

    return Column(children: [
      header,
      Expanded(child: AppTabBody(side: list, children: children)),
    ]);
  }
}

class _Workload extends StatelessWidget {
  const _Workload({required this.done, required this.total, required this.pct, required this.term});
  final int done, total, pct;
  final String term;
  @override
  Widget build(BuildContext context) => PanelCard(
        padding: EdgeInsets.all(16.w),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const IconTile(Icons.fact_check_outlined, size: 34),
            SizedBox(width: 10.w),
            Expanded(child: Text('Weekly Workload', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
            Flexible(child: Pill(term.isEmpty ? 'This Week' : '$term • This Week', tone: Tone.brand)),
          ]),
          SizedBox(height: 14.h),
          AppProgress(total == 0 ? 0 : done / total),
          SizedBox(height: 10.h),
          Row(children: [
            Expanded(child: Text('$done of $total tasks finished', style: T.body, maxLines: 1, overflow: TextOverflow.ellipsis)),
            SizedBox(width: 8.w),
            Text('$pct% Completed', style: T.bodyStrong.copyWith(color: C.primary)),
          ]),
        ]),
      );
}

class _AddButton extends StatelessWidget {
  const _AddButton();
  @override
  Widget build(BuildContext context) => AppButton('Add Task / Reminder', icon: Icons.add_task_rounded, kind: BtnKind.outline, small: true, expand: false,
      onPressed: () => context.push(RoutePaths.taskAdd));
}

class _SectionRow extends StatelessWidget {
  const _SectionRow({required this.title, required this.icon, required this.count, required this.showAdd});
  final String title, count;
  final IconData icon;
  final bool showAdd;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(2.w, 12.h, 2.w, 12.h),
        child: Row(children: [
          IconTile(icon, size: 34),
          SizedBox(width: 10.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
              Text(count, style: T.small),
            ]),
          ),
          if (showAdd) const Flexible(child: _AddButton()),
        ]),
      );
}
