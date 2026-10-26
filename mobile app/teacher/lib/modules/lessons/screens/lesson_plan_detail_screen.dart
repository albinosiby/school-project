import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/lesson_plans_bloc.dart';
import '../bloc/lesson_plans_events.dart';
import '../bloc/lesson_plans_states.dart';
import '../models/lesson_plan_models.dart';
import 'widgets/lessons_common.dart';

/// Figma 1153:4428 "5.1.1 View Lesson Plan".
class LessonPlanDetailScreen extends StatelessWidget {
  const LessonPlanDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<LessonPlansBloc>()..add(const LessonPlansLoadRequested()),
        child: BlocListener<LessonPlansBloc, LessonPlansState>(
          listenWhen: (a, b) => a.notice != b.notice && b.notice != null,
          listener: (context, s) => handleNotice(context, s.notice!),
          child: _DetailView(id: id),
        ),
      );
}

class _DetailView extends StatelessWidget {
  const _DetailView({required this.id});
  final String id;

  @override
  Widget build(BuildContext context) {
    final st = context.watch<LessonPlansBloc>().state;
    if (st.status != LessonPlansStatus.loaded) return DetailScaffold(title: 'Lesson Plan', fallbackRoute: RoutePaths.lessonPlans, body: const LessonsLoading());
    final p = st.byId(id);
    if (p == null) {
      return DetailScaffold(title: 'Lesson Plan', fallbackRoute: RoutePaths.lessonPlans, body: Center(child: AppEmptyState('Lesson plan not found', icon: Icons.menu_book_outlined)));
    }
    final bloc = context.read<LessonPlansBloc>();
    final ms = p.milestones;
    final pct = (p.progress * 100).round();
    return DetailScaffold(
      title: 'Lesson Plan',
      subtitle: p.code,
      fallbackRoute: RoutePaths.lessonPlans,
      actions: [
        IconButton(
          tooltip: 'Delete plan',
          icon: Icon(Icons.delete_outline_rounded, color: C.danger, size: 24.r),
          onPressed: () async {
            final ok = await AppDialogs.showConfirmDialog(context, title: 'Delete lesson plan?', message: 'This cannot be undone.', confirm: 'Delete', danger: true);
            if (ok) bloc.add(LessonPlanDeleted(id));
          },
        ),
      ],
      bottom: Row(children: [
        Expanded(child: AppButton('Share Plan', icon: Icons.share_outlined, kind: BtnKind.outline, onPressed: () => bloc.add(LessonPlanShared(id)))),
        SizedBox(width: 10.w),
        Expanded(child: AppButton('Edit Lesson Plan', icon: Icons.edit_outlined, onPressed: () => context.push(RoutePaths.lessonPlanEdit(id)))),
      ]),
      body: ListView(padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 24.h), children: [
        _Hero(p),
        LessonHeading('ACADEMIC CADENCE', trailing: '$pct% Completed'),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${p.sched.isEmpty ? 'Unscheduled' : p.sched} • Day ${p.day} of ${p.days}', style: T.bodyStrong),
            SizedBox(height: 8.h),
            AppProgress(pct / 100),
            SizedBox(height: 14.h),
            if (ms.isEmpty) Text('No milestones yet.', style: T.body),
            for (var i = 0; i < ms.length; i++) _CadenceRow(index: i, m: ms[i]),
          ]),
        ),
        LessonHeading('Target Competencies & Outcomes', icon: Icons.psychology_outlined),
        if (p.objectives.isEmpty) AppCard(child: Text(p.outcome.isEmpty ? 'No objectives added yet.' : p.outcome, style: T.body)),
        for (final o in p.objectives)
          Padding(
            padding: EdgeInsets.only(bottom: 10.h),
            child: AppCard(
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                IconTile(Icons.check_rounded, tone: Tone.success, size: 32),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(o.title, style: T.bodyStrong),
                    SizedBox(height: 2.h),
                    Text(o.desc, style: T.body),
                  ]),
                ),
              ]),
            ),
          ),
        LessonHeading('Lesson Breakdown', trailing: '${p.totalMins} mins total'),
        if (p.activities.isEmpty) AppCard(child: Text('No activities added yet.', style: T.body)),
        for (final a in p.activities)
          Padding(
            padding: EdgeInsets.only(bottom: 10.h),
            child: AppCard(
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  width: 52.r, padding: EdgeInsets.symmetric(vertical: 8.h),
                  decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.md)),
                  child: Column(children: [
                    Text('${a.mins}'.padLeft(2, '0'), style: T.h2.copyWith(color: C.primary)),
                    Text('MIN', style: T.caps.copyWith(fontSize: 9.sp)),
                  ]),
                ),
                SizedBox(width: 12.w),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(a.title, style: T.bodyStrong), Text(a.desc, style: T.body)])),
              ]),
            ),
          ),
        LessonHeading('Attached Materials', trailing: '${p.resources.length} items'),
        if (p.resources.isEmpty) AppCard(child: Text('No materials attached.', style: T.body)),
        for (final r in p.resources)
          Padding(
            padding: EdgeInsets.only(bottom: 10.h),
            child: AppCard(
              child: Row(children: [
                IconTile(Icons.description_outlined, tone: Tone.danger),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(r.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                    Text(r.meta, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ]),
                ),
                IconButton(
                  tooltip: 'Download',
                  onPressed: () => AppDialogs.showSnackBar(context, message: 'Downloading ${r.name}…'),
                  icon: Icon(Icons.download_rounded, color: C.primary, size: 24.r),
                ),
              ]),
            ),
          ),
      ]),
    );
  }
}

/// Blue gradient header card with status, title, summary and tags.
class _Hero extends StatelessWidget {
  const _Hero(this.p);
  final LessonPlan p;
  @override
  Widget build(BuildContext context) {
    final white70 = Colors.white.withValues(alpha: .8);
    Widget tag(IconData? icon, String text) => Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[Icon(icon, size: 15.r, color: white70), SizedBox(width: 5.w)],
          Flexible(child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small.copyWith(color: white70, fontWeight: FontWeight.w600))),
        ]);
    final status = p.draft ? 'DRAFT • CLASS ${p.cls}' : '${p.stage == 'ongoing' ? 'ACTIVE PERIOD' : p.stage.toUpperCase()} • CLASS ${p.cls}';
    return Container(
      padding: EdgeInsets.all(18.r),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(R.xxl),
        gradient: const LinearGradient(colors: [C.primary, C.primaryDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Flexible(
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: .16), borderRadius: BorderRadius.circular(R.pill)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 7.r, height: 7.r, decoration: BoxDecoration(color: p.draft ? C.warning : C.success, shape: BoxShape.circle)),
                SizedBox(width: 6.w),
                Flexible(child: Text(status, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small.copyWith(color: Colors.white, fontWeight: FontWeight.w700))),
              ]),
            ),
          ),
          SizedBox(width: 8.w),
          if (p.code.isNotEmpty)
            Container(
              padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
              decoration: BoxDecoration(border: Border.all(color: Colors.white.withValues(alpha: .4)), borderRadius: BorderRadius.circular(R.pill)),
              child: Text(p.code, style: T.small.copyWith(color: Colors.white, fontWeight: FontWeight.w600)),
            ),
        ]),
        SizedBox(height: 12.h),
        Text(p.title, style: T.h1.copyWith(fontSize: 22.sp, color: Colors.white)),
        SizedBox(height: 6.h),
        Text(p.summary, style: T.body.copyWith(color: white70)),
        Padding(padding: EdgeInsets.symmetric(vertical: 12.h), child: Divider(height: 1, color: Colors.white.withValues(alpha: .2))),
        Wrap(spacing: 14.w, runSpacing: 8.h, children: [
          if (p.ncert.isNotEmpty) tag(Icons.menu_book_outlined, p.ncert),
          tag(Icons.schedule_rounded, '${p.periods} Periods Allocated'),
          tag(null, '${p.subject} • ${p.term}'),
        ]),
      ]),
    );
  }
}

/// Day row of the academic cadence timeline.
class _CadenceRow extends StatelessWidget {
  const _CadenceRow({required this.index, required this.m});
  final int index;
  final Milestone m;
  @override
  Widget build(BuildContext context) {
    final today = m.today && !m.done;
    return Container(
      margin: EdgeInsets.only(bottom: 8.h),
      padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 6.h),
      decoration: BoxDecoration(color: today ? C.primarySoft : Colors.transparent, borderRadius: BorderRadius.circular(R.md)),
      child: Row(children: [
        Container(
          width: 28.r, height: 28.r, alignment: Alignment.center,
          decoration: BoxDecoration(shape: BoxShape.circle, color: m.done || today ? C.primary : C.surface, border: Border.all(color: m.done || today ? C.primary : C.border)),
          child: m.done
              ? Icon(Icons.check_rounded, size: 16.r, color: Colors.white)
              : Text('${index + 1}', style: T.smallStrong.copyWith(color: today ? Colors.white : C.slate)),
        ),
        SizedBox(width: 12.w),
        Expanded(
          child: Text('Day ${index + 1}: ${m.title}',
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: T.bodyStrong.copyWith(fontSize: 13.5.sp, color: today ? C.primary : (m.done ? C.ink : C.slate))),
        ),
        SizedBox(width: 6.w),
        today ? const Pill('Today') : Text(m.done ? 'Completed' : 'Upcoming', style: T.small.copyWith(fontSize: 11.sp)),
      ]),
    );
  }
}
