import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/syllabus_bloc.dart';
import '../bloc/syllabus_events.dart';
import '../bloc/syllabus_states.dart';
import '../models/syllabus_models.dart';
import '../models/tasks_format.dart';

/// Syllabus Progress Log (Figma 1153:19209): overall progress, per-division topics (tap to log a period), submit to VP.
class ProgressLogScreen extends StatelessWidget {
  const ProgressLogScreen({super.key, this.homeworkId});
  /// Homework the log was opened from (kept for the route; the log is teacher-wide).
  final String? homeworkId;
  @override
  Widget build(BuildContext context) => BlocProvider(create: (_) => getIt<SyllabusBloc>()..add(const SyllabusLoadRequested()), child: const _ProgressView());
}

class _ProgressView extends StatelessWidget {
  const _ProgressView();

  @override
  Widget build(BuildContext context) {
    final s = context.watch<SyllabusBloc>().state;
    if (s.status != SyllabusStatus.loaded) {
      return DetailScaffold(
        title: 'Syllabus Progress Log', fallbackRoute: RoutePaths.tasks,
        body: s.status == SyllabusStatus.failure
            ? AppErrorWidget(message: s.error ?? 'Could not load the log', onRetry: () => context.read<SyllabusBloc>().add(const SyllabusLoadRequested()))
            : const Center(child: CircularProgressIndicator()),
      );
    }
    final submitted = s.meta.submitted;
    final due = parseDt(s.meta.due);
    final diff = s.diff;

    return DetailScaffold(
      title: 'Syllabus Progress Log',
      fallbackRoute: RoutePaths.tasks,
      bottom: AppButton(
        submitted ? 'Withdraw Submission' : 'Submit to VP for Approval', icon: submitted ? Icons.undo_rounded : Icons.send_rounded,
        kind: submitted ? BtnKind.outline : BtnKind.primary,
        onPressed: () {
          context.read<SyllabusBloc>().add(const SyllabusSubmissionToggled());
          AppDialogs.showSnackBar(context, message: submitted ? 'Submission withdrawn' : 'Progress log submitted to VP');
        },
      ),
      body: ListView(padding: EdgeInsets.fromLTRB(S.page, S.page, S.page, 32.h), children: [
        AppCard(
          radius: R.xl,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${s.pct}%', style: T.title.copyWith(fontSize: 34.sp)), SizedBox(width: 10.w),
              Expanded(child: Padding(padding: EdgeInsets.only(top: 12.h), child: Text('Overall Progress', style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis))),
              Flexible(
                child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Pill('${diff >= 0 ? '+' : ''}$diff% vs Target (${s.meta.target}%)', tone: diff >= 0 ? Tone.success : Tone.danger,
                      icon: diff >= 0 ? Icons.trending_up_rounded : Icons.trending_down_rounded),
                  if (due != null) Padding(padding: EdgeInsets.only(top: 6.h), child: Pill('Due ${fmtShort(due)}', tone: Tone.neutral, icon: Icons.event_outlined)),
                ]),
              ),
            ]),
            SizedBox(height: 4.h),
            Text('${s.hours}h Logged • ${s.labs} Lab & Practical Sessions', style: T.small),
            SizedBox(height: 12.h),
            AppProgress(s.pct / 100, height: 10),
            SizedBox(height: 8.h),
            Row(children: [
              Expanded(child: Text('Term 2 Syllabus Completion', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
              Icon(submitted ? Icons.verified_outlined : Icons.edit_note_rounded, size: 14.r, color: C.primary), SizedBox(width: 4.w),
              Text(submitted ? 'Pending VP Approval' : 'Draft • not submitted', style: T.smallStrong.copyWith(color: C.primary)),
            ]),
          ]),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(2.w, 20.h, 2.w, 12.h),
          child: Row(children: [
            Text('Division Logs', style: T.h2), SizedBox(width: 8.w), Pill('${s.divisions.length} Cohorts', tone: Tone.brand),
            const Spacer(), Text('Updated Today', style: T.small),
          ]),
        ),
        if (s.divisions.isEmpty) const AppEmptyState('No division logs yet', icon: Icons.menu_book_outlined),
        for (final d in s.divisions) _DivisionCard(d, key: ValueKey(d.id)),
      ]),
    );
  }
}

class _DivisionCard extends StatelessWidget {
  const _DivisionCard(this.d, {super.key});
  final SyllabusDivision d;

  void _log(BuildContext context, int i) {
    final t = d.topics[i];
    if (t.isComplete) {
      AppDialogs.showSnackBar(context, message: '${t.name} is already complete');
      return;
    }
    context.read<SyllabusBloc>().add(SyllabusPeriodLogged(d.id, i));
    AppDialogs.showSnackBar(context, message: 'Logged 1 period for ${t.name}');
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: 14.h),
        child: AppCard(
          radius: R.xl,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text.rich(TextSpan(children: [TextSpan(text: d.cls, style: T.h2), TextSpan(text: '  • ${d.subject}', style: T.body)]),
                    maxLines: 2, overflow: TextOverflow.ellipsis),
              ),
              SizedBox(width: 6.w),
              Flexible(
                child: Pill(d.lag == 0 ? 'On Schedule' : 'Minor Lag (-${d.lag} Periods)', tone: d.lag == 0 ? Tone.success : Tone.danger,
                    icon: d.lag == 0 ? Icons.check_circle_outline_rounded : Icons.warning_amber_rounded),
              ),
            ]),
            SizedBox(height: 4.h),
            Text(d.remedial ?? '${d.hours}h Taught • ${d.labs} Practical Labs', style: T.small),
            Divider(height: 24.h),
            for (var i = 0; i < d.topics.length; i++) _Topic(d.topics[i], () => _log(context, i)),
            if (d.note.isNotEmpty)
              Container(
                margin: EdgeInsets.only(top: 4.h), padding: EdgeInsets.all(12.w),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(Icons.info_outline_rounded, size: 16.r, color: C.primary), SizedBox(width: 8.w),
                  Expanded(child: Text(d.note, style: T.small.copyWith(color: C.ink))),
                ]),
              ),
          ]),
        ),
      );
}

class _Topic extends StatelessWidget {
  const _Topic(this.t, this.onLog);
  final SyllabusTopic t;
  final VoidCallback onLog;
  @override
  Widget build(BuildContext context) {
    final complete = t.isComplete;
    return Padding(
      padding: EdgeInsets.only(bottom: 8.h),
      child: Semantics(
        button: !complete, label: complete ? '${t.name} complete' : 'Log 1 period for ${t.name}',
        child: Material(
          color: complete ? C.surface : C.panel, borderRadius: BorderRadius.circular(R.md),
          child: InkWell(
            borderRadius: BorderRadius.circular(R.md), onTap: complete ? null : onLog,
            child: Padding(
              padding: EdgeInsets.all(12.w),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(complete ? Icons.check_circle_outline_rounded : t.done == 0 ? Icons.hourglass_empty_rounded : Icons.timelapse_rounded, size: 20.r, color: C.primary),
                  SizedBox(width: 10.w),
                  Expanded(child: Text(t.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  Text(complete ? '${t.done}/${t.total} (100%)' : '${t.pct}% (${t.done}/${t.total})', style: T.smallStrong.copyWith(color: C.primary)),
                ]),
                if (!complete) ...[
                  SizedBox(height: 8.h),
                  AppProgress(t.total == 0 ? 0 : t.done / t.total, height: 6),
                  SizedBox(height: 6.h),
                  Row(children: [
                    Expanded(child: Text('${t.done} Periods Done', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    SizedBox(width: 8.w),
                    Flexible(
                      flex: 2,
                      child: Text('${t.total - t.done} Remaining • tap to log 1', textAlign: TextAlign.end,
                          style: T.small.copyWith(color: C.primary, fontWeight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                  ]),
                ],
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
