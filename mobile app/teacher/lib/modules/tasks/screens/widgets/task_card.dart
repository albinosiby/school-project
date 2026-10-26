import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../bloc/tasks_bloc.dart';
import '../../bloc/tasks_events.dart';
import '../../bloc/tasks_states.dart';
import '../../models/task_models.dart';
import '../../models/tasks_format.dart';

/// "Due 04:00 PM" / "Due Tomorrow" / "Overdue • Oct 20" / "Done" plus a tone.
({String text, Tone tone}) dueInfo(TaskItem t) {
  final d = t.dueAt;
  if (t.isDone) return (text: 'Done', tone: Tone.success);
  if (d == null) return (text: 'No due date', tone: Tone.neutral);
  final n = daysFromToday(d);
  if (n < 0 || (n == 0 && d.isBefore(DateTime.now()))) return (text: 'Overdue • ${relDay(d)}', tone: Tone.danger);
  if (n == 0) return (text: 'Due ${fmtClock(d)}', tone: Tone.danger);
  if (n == 1) return (text: 'Due Tomorrow', tone: Tone.warning);
  return (text: 'Due ${fmtShort(d)}', tone: Tone.neutral);
}

String taskEditLocation(String id) => Uri(path: RoutePaths.taskAdd, queryParameters: {'id': id}).toString();

void toggleTaskDone(BuildContext context, TaskItem t) {
  context.read<TasksBloc>().add(TaskDoneToggled(t.id));
  AppDialogs.showSnackBar(context, message: t.isDone ? 'Task reopened' : 'Marked as done');
}

/// Opens the linked homework, or the task editor.
void openTask(BuildContext context, TaskItem t) =>
    context.push(t.homeworkId.isNotEmpty ? RoutePaths.homework(t.homeworkId) : taskEditLocation(t.id));

Future<void> deleteTask(BuildContext context, TaskItem t) async {
  final bloc = context.read<TasksBloc>();
  final ok = await AppDialogs.showConfirmDialog(context,
      title: 'Delete ${t.isReminder ? 'reminder' : 'task'}?', message: '"${t.title}" will be removed permanently.', confirm: 'Delete', danger: true);
  if (!ok || !context.mounted) return;
  bloc.add(TaskDeleted(t.id));
  AppDialogs.showSnackBar(context, message: 'Deleted');
}

/// Subtitle line: homework submissions, the stored subtitle, or the class.
String taskSubtitle(TasksState s, TaskItem t) {
  if (t.homeworkId.isNotEmpty) {
    final h = s.homeworkById(t.homeworkId);
    if (h != null) return '${s.classLabel(h.classId)} • ${h.turnedIn} Submissions received';
  }
  if (t.subtitle.isEmpty && t.classId.isNotEmpty) return s.classLabel(t.classId);
  return t.subtitle;
}

Tone _labelTone(String l) => switch (l) { 'Pending' || 'Action Req.' => Tone.warning, 'In Progress' => Tone.brand, _ => Tone.neutral };

/// One task/reminder row on the Tasks tab (check toggle, pills, overflow menu, follow-up actions).
class TaskCard extends StatelessWidget {
  const TaskCard(this.t, {super.key});
  final TaskItem t;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<TasksBloc>().state;
    final done = t.isDone;
    final due = dueInfo(t);
    final sub = taskSubtitle(s, t);
    final follow = t.category == 'Student Follow-up';
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        radius: R.lg, padding: EdgeInsets.fromLTRB(6.w, 10.h, 4.w, 12.h), onTap: () => openTask(context, t),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            IconButton(
              tooltip: done ? 'Reopen task' : 'Mark done', constraints: BoxConstraints(minWidth: 44.r, minHeight: 44.r),
              onPressed: () => toggleTaskDone(context, t),
              icon: Icon(done ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, size: 24.r, color: done ? C.success : C.muted),
            ),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(top: 10.h),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    if (t.isReminder) Padding(padding: EdgeInsets.only(right: 6.w), child: Icon(Icons.alarm_rounded, size: 16.r, color: C.primary)),
                    Expanded(
                      child: Text(t.title, maxLines: 2, overflow: TextOverflow.ellipsis,
                          style: T.h3.copyWith(decoration: done ? TextDecoration.lineThrough : null, color: done ? C.slate : C.ink)),
                    ),
                  ]),
                  if (sub.isNotEmpty) Padding(padding: EdgeInsets.only(top: 3.h), child: Text(sub, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis)),
                  SizedBox(height: 8.h),
                  Wrap(spacing: 8.w, runSpacing: 6.h, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    if (t.label.isNotEmpty && !done) Pill(t.label, tone: _labelTone(t.label)),
                    Pill(due.text, tone: due.tone, icon: done ? Icons.check_rounded : Icons.schedule_rounded),
                    if (t.tag.isNotEmpty) Pill(t.tag, tone: Tone.neutral, icon: t.tag.contains('File') ? Icons.attach_file_rounded : Icons.sync_rounded),
                  ]),
                ]),
              ),
            ),
            PopupMenuButton<String>(
              tooltip: 'More actions', icon: Icon(Icons.more_vert_rounded, color: C.slate, size: 22.r),
              onSelected: (v) {
                if (v == 'done') toggleTaskDone(context, t);
                if (v == 'edit') context.push(taskEditLocation(t.id));
                if (v == 'delete') deleteTask(context, t);
              },
              itemBuilder: (_) => [
                PopupMenuItem(value: 'done', child: Text(done ? 'Mark as pending' : 'Mark as done')),
                const PopupMenuItem(value: 'edit', child: Text('Edit')),
                const PopupMenuItem(value: 'delete', child: Text('Delete')),
              ],
            ),
          ]),
          if (follow && !done)
            Padding(
              padding: EdgeInsets.fromLTRB(12.w, 12.h, 8.w, 0),
              child: Row(children: [
                Expanded(child: AppButton('Call Parent', icon: Icons.call_rounded, small: true, onPressed: () => _contact(context, 'call', 'Calling parent… (simulated)'))),
                SizedBox(width: 8.w),
                Expanded(
                  child: AppButton('Message', icon: Icons.chat_bubble_outline_rounded, kind: BtnKind.outline, small: true,
                      onPressed: () => _contact(context, 'message', 'Message sent to parent (simulated)')),
                ),
              ]),
            ),
        ]),
      ),
    );
  }

  void _contact(BuildContext context, String kind, String msg) {
    context.read<TasksBloc>().add(TaskContactRecorded(t.id, kind));
    AppDialogs.showSnackBar(context, message: msg);
  }
}

/// Highlighted urgent task with evaluation progress (Figma "Urgent Priority" card).
class UrgentTaskCard extends StatelessWidget {
  const UrgentTaskCard(this.t, {super.key});
  final TaskItem t;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<TasksBloc>().state;
    final due = dueInfo(t);
    final total = t.total ?? 0, reviewed = t.reviewed ?? 0;
    return Padding(
      padding: EdgeInsets.only(bottom: 16.h),
      child: PanelCard(
        padding: EdgeInsets.all(16.w),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Wrap(spacing: 8.w, runSpacing: 6.h, crossAxisAlignment: WrapCrossAlignment.center, children: [
            const Pill('Urgent Priority', tone: Tone.danger, dot: true),
            if (t.classId.isNotEmpty) Pill(s.classLabel(t.classId), tone: Tone.brand),
            Pill(due.text, tone: due.tone, icon: Icons.schedule_rounded),
          ]),
          SizedBox(height: 12.h),
          Text(t.title, style: T.h1.copyWith(fontSize: 19.sp), maxLines: 3, overflow: TextOverflow.ellipsis),
          if (t.notes.isNotEmpty) Padding(padding: EdgeInsets.only(top: 6.h), child: Text(t.notes, style: T.body)),
          SizedBox(height: 14.h),
          if (t.hasProgress) ...[
            AppCard(
              radius: R.md, padding: EdgeInsets.all(12.w),
              child: Column(children: [
                Row(children: [
                  Expanded(child: Text('Evaluation Progress', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  SizedBox(width: 8.w),
                  Text('$reviewed / $total Reviewed', style: T.bodyStrong.copyWith(color: C.primary)),
                ]),
                SizedBox(height: 10.h),
                AppProgress(reviewed / total, height: 6),
              ]),
            ),
            SizedBox(height: 14.h),
            AppButton('Continue Review', icon: Icons.rate_review_outlined, onPressed: () => showReviewSheet(context, t)),
          ] else
            Row(children: [
              Expanded(child: AppButton('Mark Done', icon: Icons.check_rounded, onPressed: () => toggleTaskDone(context, t))),
              SizedBox(width: 10.w),
              Expanded(child: AppButton('Open', kind: BtnKind.outline, onPressed: () => openTask(context, t))),
            ]),
        ]),
      ),
    );
  }
}

/// Lets the teacher update how many papers of a grading task have been reviewed.
Future<void> showReviewSheet(BuildContext context, TaskItem t) {
  final bloc = context.read<TasksBloc>();
  final total = t.total ?? 0;
  final ctrl = TextEditingController(text: '${t.reviewed ?? 0}');
  return showAppSheet<void>(context, title: 'Evaluation Progress', subtitle: t.title, builder: (ctx) => StatefulBuilder(builder: (ctx, set) {
        final reviewed = (int.tryParse(ctrl.text) ?? 0).clamp(0, total);
        final complete = reviewed >= total;
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: Text('$reviewed / $total papers', style: T.title)),
          SizedBox(height: 12.h),
          Center(child: AppNumberStepper(controller: ctrl, max: total, label: 'reviewed papers', onChanged: (_) => set(() {}))),
          SizedBox(height: 14.h),
          AppProgress(total == 0 ? 0 : reviewed / total),
          SizedBox(height: 18.h),
          AppButton(complete ? 'Save & Complete Task' : 'Save Progress', onPressed: () {
            bloc.add(TaskReviewSaved(t.id, reviewed));
            Navigator.pop(ctx);
            AppDialogs.showSnackBar(context, message: complete ? 'All papers reviewed. Task completed' : 'Progress saved: $reviewed of $total reviewed');
          }),
        ]);
      })).whenComplete(ctrl.dispose);
}
