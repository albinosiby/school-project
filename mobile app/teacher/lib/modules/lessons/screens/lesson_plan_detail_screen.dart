import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../engage/screens/widgets/engage_widgets.dart' show openFileRef;
import '../../school/bloc/school_bloc.dart';
import '../bloc/lesson_plans_bloc.dart';
import '../bloc/lesson_plans_events.dart';
import '../bloc/lesson_plans_states.dart';
import '../models/lesson_plan_models.dart';
import '../models/teaching_options.dart';
import 'widgets/lesson_plan_widgets.dart';
import 'widgets/lessons_common.dart';

/// One plan: what it covers, its sessions (mark taught / skip, notes), attachments, review, copy and delete.
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

  Future<void> _copy(BuildContext context, LessonPlan p) async {
    final bloc = context.read<LessonPlansBloc>();
    final school = context.read<SchoolBloc>().state;
    final targets = [
      for (final c in school.classes)
        if (c.label != p.cls && teachingSubjects(school.teacher, school.classes, c.label).contains(p.subject)) c,
    ];
    if (targets.isEmpty) {
      AppDialogs.showSnackBar(context, message: 'You teach ${p.subject} in no other section.');
      return;
    }
    final picked = await showAppSheet<String>(
      context,
      title: 'Copy to another section',
      subtitle: 'Sessions get dates from that class\'s timetable; the copy starts as a draft.',
      builder: (ctx) => Column(
        children: [
          for (final c in targets)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const IconTile(Icons.groups_2_outlined, size: 38),
              title: Text('Class ${c.label}', style: T.bodyStrong),
              subtitle: Text('${c.students} students', style: T.small),
              trailing: Icon(Icons.chevron_right_rounded, color: C.muted),
              onTap: () => Navigator.pop(ctx, c.id),
            ),
        ],
      ),
    );
    if (picked == null) return;
    final c = targets.firstWhere((x) => x.id == picked);
    bloc.add(LessonPlanCopied(p.id, cls: c.label, classId: c.id));
  }

  Future<void> _delete(BuildContext context, LessonPlan p) async {
    final bloc = context.read<LessonPlansBloc>();
    final ok = await AppDialogs.showConfirmDialog(
      context,
      title: 'Delete lesson plan?',
      message: '"${p.title}" and its sessions will be removed.',
      confirm: 'Delete',
      danger: true,
    );
    if (ok) bloc.add(LessonPlanDeleted(p.id));
  }

  @override
  Widget build(BuildContext context) {
    final st = context.watch<LessonPlansBloc>().state;
    if (st.status != LessonPlansStatus.loaded) {
      return const DetailScaffold(title: 'Lesson Plan', fallbackRoute: RoutePaths.lessonPlans, body: LessonsLoading());
    }
    final p = st.byId(id);
    if (p == null) {
      return const DetailScaffold(
        title: 'Lesson Plan',
        fallbackRoute: RoutePaths.lessonPlans,
        body: Center(child: AppEmptyState('Lesson plan not found', icon: Icons.menu_book_outlined)),
      );
    }
    final canSubmit = !p.draft && (p.review.state == ReviewState.none || p.review.state == ReviewState.changes);
    return DetailScaffold(
      title: 'Lesson Plan',
      subtitle: p.code.isEmpty ? null : p.code,
      fallbackRoute: RoutePaths.lessonPlans,
      actions: [
        PopupMenuButton<String>(
          tooltip: 'More',
          icon: Icon(Icons.more_vert_rounded, color: C.slate, size: 22.r),
          onSelected: (v) => switch (v) {
            'copy' => _copy(context, p),
            _ => _delete(context, p),
          },
          itemBuilder: (_) => [
            const PopupMenuItem(value: 'copy', child: Text('Copy to another section')),
            PopupMenuItem(
              value: 'delete',
              child: Text('Delete plan', style: TextStyle(color: C.danger)),
            ),
          ],
        ),
      ],
      bottom: Row(
        children: [
          Expanded(
            child: AppButton(
              'Edit',
              icon: Icons.edit_outlined,
              kind: canSubmit ? BtnKind.outline : BtnKind.primary,
              onPressed: () => context.push(RoutePaths.lessonPlanEdit(p.id)),
            ),
          ),
          if (canSubmit) ...[
            SizedBox(width: 10.w),
            Expanded(
              child: AppButton(
                p.review.state == ReviewState.changes ? 'Send again' : 'Send for review',
                icon: Icons.send_rounded,
                onPressed: () => context.read<LessonPlansBloc>().add(LessonPlanReviewRequested(p.id)),
              ),
            ),
          ],
        ],
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 32.h),
        children: [
          _Header(p),
          if (p.review.state == ReviewState.changes && p.review.note.isNotEmpty) ...[
            SizedBox(height: 12.h),
            _Banner(
              icon: Icons.edit_note_rounded,
              tone: Tone.danger,
              title: 'Changes asked${p.review.by.isEmpty ? '' : ' by ${p.review.by}'}',
              text: p.review.note,
            ),
          ],
          if (p.review.state == ReviewState.approved && p.review.note.isNotEmpty) ...[
            SizedBox(height: 12.h),
            _Banner(icon: Icons.verified_rounded, tone: Tone.success, title: 'Approved', text: p.review.note),
          ],
          if (p.outcomes.isNotEmpty) ...[
            const _Section('Learning outcomes'),
            AppCard(
              radius: R.lg,
              padding: EdgeInsets.all(14.r),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var i = 0; i < p.outcomes.length; i++)
                    Padding(
                      padding: EdgeInsets.only(bottom: i == p.outcomes.length - 1 ? 0 : 10.h),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 22.r,
                            height: 22.r,
                            alignment: Alignment.center,
                            decoration: const BoxDecoration(color: C.primarySoft, shape: BoxShape.circle),
                            child: Text(
                              '${i + 1}',
                              style: T.small.copyWith(color: C.primary, fontWeight: FontWeight.w800, fontSize: 11.sp),
                            ),
                          ),
                          SizedBox(width: 10.w),
                          Expanded(
                            child: Padding(
                              padding: EdgeInsets.only(top: 1.h),
                              child: Text(
                                p.outcomes[i],
                                style: T.body.copyWith(color: C.ink, fontSize: 13.5.sp, height: 1.4),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
          _Section('Sessions (${p.sessions.length})'),
          if (p.sessions.isEmpty) AppCard(child: Text('No sessions yet. Edit the plan to add them.', style: T.body)),
          for (var i = 0; i < p.sessions.length; i++)
            _SessionTile(plan: p, session: p.sessions[i], n: i + 1, last: i == p.sessions.length - 1),
          if (p.attachments.isNotEmpty) ...[
            _Section('Attachments (${p.attachments.length})'),
            for (final a in p.attachments)
              Padding(
                padding: EdgeInsets.only(bottom: 8.h),
                child: AppFileChip(
                  name: a.name,
                  size: a.size,
                  sub: 'Tap to open',
                  onTap: a.url.startsWith('http') ? () => openFileRef(context, a) : null,
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(2.w, 20.h, 2.w, 8.h),
    child: Text(text.toUpperCase(), style: T.capsMuted.copyWith(fontSize: 11.sp, letterSpacing: .6)),
  );
}

class _Banner extends StatelessWidget {
  const _Banner({required this.icon, required this.tone, required this.title, required this.text});
  final IconData icon;
  final Tone tone;
  final String title, text;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return Container(
      padding: EdgeInsets.all(12.r),
      decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(R.lg)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18.r, color: c.fg),
          SizedBox(width: 10.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: T.bodyStrong.copyWith(color: c.fg, fontSize: 13.sp),
                ),
                SizedBox(height: 2.h),
                Text(
                  text,
                  style: T.body.copyWith(color: C.ink, fontSize: 13.sp),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header(this.p);
  final LessonPlan p;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.all(16.r),
    decoration: BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [C.primary, C.primaryDark],
      ),
      borderRadius: BorderRadius.circular(R.xl),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                [p.cls, p.subject, if (p.chapter.isNotEmpty) p.chapter].join(' • '),
                style: T.small.copyWith(color: Colors.white.withValues(alpha: .85), fontWeight: FontWeight.w700),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (p.draft) const Pill('Draft', tone: Tone.neutral) else ReviewPill(p.review),
          ],
        ),
        SizedBox(height: 8.h),
        Text(p.title, style: T.h2.copyWith(color: Colors.white, height: 1.25)),
        if (p.summary.isNotEmpty) ...[
          SizedBox(height: 6.h),
          Text(
            p.summary,
            style: T.small.copyWith(color: Colors.white.withValues(alpha: .85), fontSize: 12.5.sp, height: 1.4),
          ),
        ],
        SizedBox(height: 14.h),
        ClipRRect(
          borderRadius: BorderRadius.circular(R.pill),
          child: LinearProgressIndicator(
            value: p.progress,
            minHeight: 6.h,
            backgroundColor: Colors.white.withValues(alpha: .25),
            color: Colors.white,
          ),
        ),
        SizedBox(height: 6.h),
        Text(
          p.completed ? 'All sessions taught' : '${p.taughtCount} of ${p.plannedCount} sessions taught',
          style: T.small.copyWith(color: Colors.white, fontWeight: FontWeight.w600),
        ),
      ],
    ),
  );
}

/// A session on the timeline: when, what (steps, homework), how it went; mark taught / skip / reopen.
class _SessionTile extends StatelessWidget {
  const _SessionTile({required this.plan, required this.session, required this.n, required this.last});
  final LessonPlan plan;
  final LessonSession session;
  final int n;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final s = session;
    final bloc = context.read<LessonPlansBloc>();
    final when = [sessionDay(s.date), if (s.slot.isNotEmpty) slotLabel(s.slot)].join(' • ');
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 30.r,
            child: Column(
              children: [
                SessionDot(s, n),
                if (!last)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: EdgeInsets.symmetric(vertical: 3.h),
                      color: C.border,
                    ),
                  ),
              ],
            ),
          ),
          SizedBox(width: 10.w),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: last ? 0 : 12.h),
              child: AppCard(
                radius: R.lg,
                padding: EdgeInsets.fromLTRB(12.w, 10.h, 4.w, 12.h),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'SESSION $n • ${when.toUpperCase()}',
                            style: T.capsMuted.copyWith(
                              fontSize: 10.5.sp,
                              color: s.date == todayIso() && s.open ? C.primary : null,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        PopupMenuButton<SessionStatus>(
                          tooltip: 'Session options',
                          icon: Icon(Icons.more_horiz_rounded, size: 20.r, color: C.slate),
                          onSelected: (v) => bloc.add(LessonSessionMarked(plan.id, s.id, v)),
                          itemBuilder: (_) => [
                            if (!s.open)
                              const PopupMenuItem(value: SessionStatus.planned, child: Text('Mark as not taught')),
                            if (s.status != SessionStatus.skipped)
                              const PopupMenuItem(value: SessionStatus.skipped, child: Text('Skip this session')),
                          ],
                        ),
                      ],
                    ),
                    Padding(
                      padding: EdgeInsets.only(right: 8.w),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            s.focus.isEmpty ? 'Session $n' : s.focus,
                            style: T.bodyStrong.copyWith(
                              fontSize: 14.5.sp,
                              decoration: s.status == SessionStatus.skipped ? TextDecoration.lineThrough : null,
                              color: s.status == SessionStatus.skipped ? C.muted : C.ink,
                            ),
                          ),
                          if (s.activities.isNotEmpty) ...[
                            SizedBox(height: 8.h),
                            Wrap(
                              spacing: 6.w,
                              runSpacing: 6.h,
                              children: [
                                for (final a in s.activities)
                                  Container(
                                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                                    decoration: BoxDecoration(
                                      color: C.surface,
                                      borderRadius: BorderRadius.circular(R.sm),
                                    ),
                                    child: Text(
                                      '${a.mins}′ ${a.title}',
                                      style: T.small.copyWith(fontSize: 11.5.sp, color: C.ink),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                          if (s.homework.isNotEmpty) ...[
                            SizedBox(height: 8.h),
                            Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(
                                    text: 'Homework  ',
                                    style: T.smallStrong.copyWith(fontSize: 12.sp, color: C.warningDark),
                                  ),
                                  TextSpan(
                                    text: s.homework,
                                    style: T.small.copyWith(fontSize: 12.sp, color: C.ink),
                                  ),
                                ],
                              ),
                            ),
                          ],
                          if (s.note.isNotEmpty) ...[
                            SizedBox(height: 8.h),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(Icons.sticky_note_2_outlined, size: 14.r, color: C.slate),
                                SizedBox(width: 6.w),
                                Expanded(
                                  child: Text(
                                    s.note,
                                    style: T.small.copyWith(fontSize: 12.sp, fontStyle: FontStyle.italic),
                                  ),
                                ),
                              ],
                            ),
                          ],
                          if (s.open && !plan.draft) ...[
                            SizedBox(height: 10.h),
                            AppButton(
                              'Mark as taught',
                              icon: Icons.check_rounded,
                              small: true,
                              expand: false,
                              kind: s.date == todayIso() ? BtnKind.primary : BtnKind.soft,
                              onPressed: () async {
                                final note = await askTaughtNote(context, s);
                                if (note != null) {
                                  bloc.add(LessonSessionMarked(plan.id, s.id, SessionStatus.taught, note: note));
                                }
                              },
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
