import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/substitution_bloc.dart';
import '../bloc/substitution_events.dart';
import '../bloc/substitution_states.dart';
import '../models/timetable_models.dart';
import 'widgets/teacher_tab_header.dart';

/// Substitution brief & lesson notes (Figma 1153:10356), route RoutePaths.substitutionDetail.
class SubstitutionScreen extends StatelessWidget {
  const SubstitutionScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<SubstitutionBloc>()..add(SubstitutionLoadRequested(id)),
        child: const _SubstitutionView(),
      );
}

class _SubstitutionView extends StatelessWidget {
  const _SubstitutionView();

  void _set(BuildContext context, SubStatus s, String msg) {
    context.read<SubstitutionBloc>().add(SubstitutionStatusChanged(s));
    AppDialogs.showSnackBar(context, message: msg);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<SubstitutionBloc>().state;
    final sub = state.sub;
    if (sub == null) {
      return DetailScaffold(
        title: 'Lesson Notes', fallbackRoute: RoutePaths.timetable,
        body: state.status == SubstitutionLoadStatus.notFound
            ? const Center(child: AppEmptyState('Substitution not found', icon: Icons.swap_horiz_rounded))
            : const Center(child: CircularProgressIndicator()),
      );
    }
    final slot = slotOf(sub.slot);
    final (statusLabel, statusTone) = switch (sub.status) {
      SubStatus.accepted => ('Approved', Tone.success),
      SubStatus.declined => ('Declined', Tone.danger),
      SubStatus.pending => ('Awaiting response', Tone.warning),
    };
    final facultyParts = sub.faculty.split(' ');
    return DetailScaffold(
      title: 'Lesson Notes',
      fallbackRoute: RoutePaths.timetable,
      actions: const [TeacherHeaderActions()],
      bottom: switch (sub.status) {
        SubStatus.pending => Row(children: [
            Expanded(
              child: AppButton('Decline', kind: BtnKind.outline, onPressed: () async {
                final ok = await AppDialogs.showConfirmDialog(context,
                    title: 'Decline substitution?', message: 'The admin desk will be told you cannot cover this period.', confirm: 'Decline', danger: true);
                if (ok && context.mounted) _set(context, SubStatus.declined, 'Substitution declined');
              }),
            ),
            SizedBox(width: 12.w),
            Expanded(child: AppButton('Accept', icon: Icons.check_rounded, onPressed: () => _set(context, SubStatus.accepted, 'Substitution accepted'))),
          ]),
        SubStatus.declined => AppButton('Undo decline', kind: BtnKind.soft, onPressed: () => _set(context, SubStatus.pending, 'Substitution restored')),
        SubStatus.accepted => null,
      },
      body: ListView(padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 32.h), children: [
        AppCard(
          radius: R.xl,
          child: Column(children: [
            Row(children: [
              Avatar(sub.faculty, size: 56, tone: Tone.purple), SizedBox(width: 12.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('COVERING FACULTY', style: T.capsMuted.copyWith(fontSize: 10.sp)),
                  Text(sub.faculty, style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text.rich(
                    TextSpan(children: [TextSpan(text: sub.dept, style: T.small.copyWith(color: C.primary)), TextSpan(text: ' • ${sub.role}', style: T.small)]),
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                  ),
                ]),
              ),
              SizedBox(width: 6.w),
              Flexible(child: Pill(statusLabel, tone: statusTone, dot: true)),
            ]),
            Divider(height: 24.h),
            Row(children: [
              Expanded(child: AppInfoTile(icon: Icons.schedule_rounded, iconColor: C.primary, compact: true, label: 'TIME SLOT', value: '${t12(slot.start, suffix: false)} – ${t12(slot.end)} (${slot.length}m)')),
              SizedBox(width: 10.w),
              Expanded(child: AppInfoTile(icon: Icons.science_outlined, iconColor: C.primary, compact: true, label: 'CLASSROOM', value: sub.room)),
            ]),
          ]),
        ),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.xl,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.menu_book_outlined, color: C.primary, size: 20.r), SizedBox(width: 8.w),
              Expanded(child: Text('Lesson Objective', style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis)),
              Flexible(child: Pill(sub.tag, tone: Tone.brand)),
            ]),
            SizedBox(height: 12.h),
            Container(
              width: double.infinity, padding: EdgeInsets.all(14.r),
              decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(sub.chapter, style: T.smallStrong.copyWith(color: C.primary)),
                SizedBox(height: 6.h),
                Text(sub.objective, style: T.bodyStrong),
              ]),
            ),
            SizedBox(height: 12.h),
            Container(
              width: double.infinity, padding: EdgeInsets.all(14.r),
              decoration: const BoxDecoration(color: C.surface, border: Border(left: BorderSide(color: C.primary, width: 3))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Directive from ${facultyParts.first} ${facultyParts.last}', style: T.smallStrong.copyWith(color: C.primary)),
                SizedBox(height: 6.h),
                Text('“${sub.directive}”', style: T.body.copyWith(color: C.ink)),
              ]),
            ),
          ]),
        ),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.xl,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.checklist_rtl_rounded, color: C.primary, size: 20.r), SizedBox(width: 8.w),
              Expanded(child: Text('Duty Tasks', style: T.h2)),
              Pill('${sub.doneCount} of ${sub.tasks.length} Completed', tone: Tone.brand),
            ]),
            SizedBox(height: 12.h),
            for (var i = 0; i < sub.tasks.length; i++) _TaskRow(task: sub.tasks[i], onTap: () => context.read<SubstitutionBloc>().add(SubstitutionTaskToggled(i))),
          ]),
        ),
        if (sub.files.isNotEmpty) ...[
          SectionHeader('Attached Resources', action: '${sub.files.length} Files'),
          for (final f in sub.files)
            Padding(
              padding: EdgeInsets.only(bottom: 8.h),
              child: AppCard(
                radius: R.lg, padding: EdgeInsets.all(12.r), onTap: () => AppDialogs.showSnackBar(context, message: 'Opening ${f.name} (simulated)'),
                child: Row(children: [
                  const IconTile(Icons.picture_as_pdf_outlined, tone: Tone.danger), SizedBox(width: 12.w),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(f.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis), Text(f.meta, style: T.small),
                    ]),
                  ),
                  Icon(Icons.download_rounded, color: C.primary, size: 22.r),
                ]),
              ),
            ),
        ],
        if (sub.contacts.isNotEmpty) ...[
          const SectionHeader('Classroom Support', action: 'Quick Dial'),
          for (final c in sub.contacts)
            Padding(
              padding: EdgeInsets.only(bottom: 8.h),
              child: AppCard(
                radius: R.lg, padding: EdgeInsets.all(12.r), onTap: () => AppDialogs.showSnackBar(context, message: 'Calling ${c.name} (simulated)'),
                child: Row(children: [
                  Avatar(c.name, size: 40), SizedBox(width: 12.w),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(c.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis), Text(c.role, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ]),
                  ),
                  Icon(Icons.call_outlined, color: C.success, size: 22.r),
                ]),
              ),
            ),
        ],
      ]),
    );
  }
}

class _TaskRow extends StatelessWidget {
  const _TaskRow({required this.task, required this.onTap});
  final SubTask task;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 8.h),
        child: Semantics(
          button: true, checked: task.done, label: task.title,
          child: InkWell(
            borderRadius: BorderRadius.circular(R.md),
            onTap: onTap,
            child: Container(
              padding: EdgeInsets.all(12.r),
              decoration: BoxDecoration(color: task.done ? C.surface : C.bg, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
              child: Row(children: [
                Icon(task.done ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, color: task.done ? C.primary : C.muted, size: 24.r),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(task.title,
                        style: T.bodyStrong.copyWith(decoration: task.done ? TextDecoration.lineThrough : null, color: task.done ? C.slate : C.ink),
                        maxLines: 2, overflow: TextOverflow.ellipsis),
                    Text(task.sub, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ]),
                ),
                if (task.done) const Pill('Done', tone: Tone.success),
              ]),
            ),
          ),
        ),
      );
}
