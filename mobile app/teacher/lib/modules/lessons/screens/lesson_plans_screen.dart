import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/lesson_plans_bloc.dart';
import '../bloc/lesson_plans_events.dart';
import '../bloc/lesson_plans_states.dart';
import '../models/lesson_plan_models.dart';
import 'widgets/lesson_plan_widgets.dart';
import 'widgets/lessons_common.dart';

/// Lesson plans: today's sessions first, then the plans (a chapter taught over sessions) by state.
class LessonPlansScreen extends StatelessWidget {
  const LessonPlansScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<LessonPlansBloc>()..add(const LessonPlansLoadRequested()),
    child: const _LessonPlansView(),
  );
}

class _LessonPlansView extends StatefulWidget {
  const _LessonPlansView();
  @override
  State<_LessonPlansView> createState() => _LessonPlansViewState();
}

class _LessonPlansViewState extends State<_LessonPlansView> {
  String _q = '', _tab = 'Active';
  static const _tabs = ['Active', 'Drafts', 'In review', 'Completed'];

  bool _inTab(LessonPlan p, String t) => switch (t) {
    'Drafts' => p.draft,
    'In review' => p.review.state == ReviewState.submitted || p.review.state == ReviewState.changes,
    'Completed' => p.completed,
    _ => p.isActive,
  };

  @override
  Widget build(BuildContext context) {
    final st = context.watch<LessonPlansBloc>().state;
    final q = _q.toLowerCase();
    final found = st.plans
        .where((p) => '${p.title} ${p.chapter} ${p.cls} ${p.subject} ${p.code}'.toLowerCase().contains(q))
        .toList();
    final shown = found.where((p) => _inTab(p, _tab)).toList()
      ..sort((a, b) {
        final today = todayIso();
        return (a.nextSession(today)?.date ?? '9').compareTo(b.nextSession(today)?.date ?? '9');
      });
    final today = st.today;

    return BlocListener<LessonPlansBloc, LessonPlansState>(
      listenWhen: (a, b) => a.notice != b.notice && b.notice != null,
      listener: (context, s) => handleNotice(context, s.notice!),
      child: DetailScaffold(
        title: 'Lesson Plans',
        subtitle: '${st.activeCount} active • ${st.draftCount} draft',
        fallbackRoute: RoutePaths.more,
        fab: FloatingActionButton.extended(
          heroTag: 'lesson-plan-new',
          tooltip: 'New lesson plan',
          backgroundColor: C.primary,
          foregroundColor: Colors.white,
          onPressed: () => context.push(RoutePaths.lessonPlanEdit('new')),
          icon: Icon(Icons.add_rounded, size: 22.r),
          label: Text('New plan', style: T.button),
        ),
        body: st.status != LessonPlansStatus.loaded
            ? const LessonsLoading()
            : ListView(
                padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 100.h),
                children: [
                  if (today.isNotEmpty) ...[
                    _Label("Today's lessons"),
                    for (final t in today) _TodayCard(plan: t.plan, session: t.session),
                    SizedBox(height: 6.h),
                  ],
                  AppSearchField(
                    hint: 'Search chapters, classes or subjects…',
                    onChanged: (v) => setState(() => _q = v),
                  ),
                  SizedBox(height: 10.h),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        for (final t in _tabs)
                          _Chip(
                            label: t,
                            count: found.where((p) => _inTab(p, t)).length,
                            on: _tab == t,
                            onTap: () => setState(() => _tab = t),
                          ),
                      ],
                    ),
                  ),
                  SizedBox(height: 6.h),
                  if (shown.isEmpty)
                    Padding(
                      padding: EdgeInsets.only(top: 32.h),
                      child: AppEmptyState(
                        st.plans.isEmpty ? 'No lesson plans yet' : 'Nothing here',
                        hint: st.plans.isEmpty
                            ? 'Plan a chapter as a set of sessions — dates come from your timetable.'
                            : 'Try another tab or search.',
                        icon: Icons.menu_book_outlined,
                      ),
                    ),
                  for (final p in shown) _PlanCard(p),
                ],
              ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(2.w, 4.h, 2.w, 8.h),
    child: Text(text.toUpperCase(), style: T.capsMuted.copyWith(fontSize: 11.sp, letterSpacing: .6)),
  );
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.on, required this.onTap, required this.count});
  final String label;
  final bool on;
  final int count;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(right: 6.w),
    child: Semantics(
      button: true,
      selected: on,
      child: InkWell(
        borderRadius: BorderRadius.circular(R.pill),
        onTap: onTap,
        child: Container(
          height: 34.h,
          padding: EdgeInsets.symmetric(horizontal: 12.w),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? C.primary : C.bg,
            borderRadius: BorderRadius.circular(R.pill),
            border: Border.all(color: on ? C.primary : C.border),
          ),
          child: Text(
            '$label  $count',
            style: T.smallStrong.copyWith(fontSize: 12.5.sp, color: on ? Colors.white : C.ink),
          ),
        ),
      ),
    ),
  );
}

/// A session planned for today: period, class, what to teach, and a one-tap "Taught".
class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.plan, required this.session});
  final LessonPlan plan;
  final LessonSession session;
  @override
  Widget build(BuildContext context) {
    final n = plan.indexOf(session) + 1;
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: Material(
        color: session.taught ? C.successSoft.withValues(alpha: .5) : C.primarySoft.withValues(alpha: .6),
        borderRadius: BorderRadius.circular(R.lg),
        child: InkWell(
          borderRadius: BorderRadius.circular(R.lg),
          onTap: () => context.push(RoutePaths.lessonPlan(plan.id)),
          child: Padding(
            padding: EdgeInsets.all(12.r),
            child: Row(
              children: [
                SessionDot(session, n),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        [
                          if (session.slot.isNotEmpty) slotLabel(session.slot),
                          '${plan.cls} ${plan.subject}',
                        ].join(' • '),
                        style: T.small.copyWith(fontSize: 11.5.sp, color: C.primary, fontWeight: FontWeight.w700),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      SizedBox(height: 2.h),
                      Text(
                        session.focus.isEmpty ? plan.title : session.focus,
                        style: T.bodyStrong.copyWith(fontSize: 14.sp),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        '${plan.title} • Session $n of ${plan.sessions.length}',
                        style: T.small,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                SizedBox(width: 8.w),
                if (session.taught)
                  Icon(Icons.check_circle_rounded, color: C.successDark, size: 22.r)
                else
                  AppButton(
                    'Taught',
                    small: true,
                    expand: false,
                    icon: Icons.check_rounded,
                    onPressed: () async {
                      final bloc = context.read<LessonPlansBloc>();
                      final note = await askTaughtNote(context, session);
                      if (note != null) {
                        bloc.add(LessonSessionMarked(plan.id, session.id, SessionStatus.taught, note: note));
                      }
                    },
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A plan: title, chapter / class / subject, review state, progress and the next session.
class _PlanCard extends StatelessWidget {
  const _PlanCard(this.p);
  final LessonPlan p;
  @override
  Widget build(BuildContext context) {
    final next = p.nextSession(todayIso());
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppCard(
        radius: R.lg,
        padding: EdgeInsets.all(14.r),
        onTap: () => context.push(RoutePaths.lessonPlan(p.id)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    [p.cls, p.subject, if (p.chapter.isNotEmpty) p.chapter].join(' • '),
                    style: T.small.copyWith(fontSize: 11.5.sp, color: C.primary, fontWeight: FontWeight.w700),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (p.draft) const Pill('Draft', tone: Tone.neutral) else ReviewPill(p.review),
              ],
            ),
            SizedBox(height: 6.h),
            Text(
              p.title,
              style: T.h3.copyWith(fontSize: 16.sp),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            SizedBox(height: 10.h),
            PlanProgress(p),
            if (next != null && !p.completed) ...[
              SizedBox(height: 10.h),
              Row(
                children: [
                  Icon(Icons.event_outlined, size: 14.r, color: C.slate),
                  SizedBox(width: 6.w),
                  Expanded(
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text:
                                'Next: ${sessionDay(next.date)}${next.slot.isEmpty ? '' : ' • ${slotLabel(next.slot)}'}',
                            style: T.small.copyWith(fontSize: 12.sp, fontWeight: FontWeight.w700, color: C.ink),
                          ),
                          if (next.focus.isNotEmpty)
                            TextSpan(
                              text: '  ${next.focus}',
                              style: T.small.copyWith(fontSize: 12.sp),
                            ),
                        ],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
