import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/online_tests_bloc.dart';
import '../bloc/online_tests_events.dart';
import '../bloc/online_tests_states.dart';
import '../models/online_test_models.dart';
import 'widgets/lessons_common.dart';

/// "Tomorrow, 09:30 AM" / "Friday, Oct 18 • 11:00 AM".
String testWhen(OnlineTest t) {
  final d = DateTime.tryParse(t.date);
  if (d == null) return fmtTime(t.time);
  if (t.date == plusDays(1)) return 'Tomorrow, ${fmtTime(t.time)}';
  return '${fmtIso(t.date, 'EEE, MMM d')} • ${fmtTime(t.time)}';
}

/// Shows the question paper in a bottom sheet.
void previewPaper(BuildContext context, OnlineTest t) {
  final qs = t.questions;
  showAppSheet(context, title: t.title, subtitle: '${t.nq} questions • ${t.totalMarks} marks • ${t.duration} mins', builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (qs.isEmpty) AppEmptyState('No questions yet', icon: Icons.quiz_outlined),
        for (var i = 0; i < qs.length; i++)
          Padding(
            padding: EdgeInsets.only(bottom: 12.h),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Q${i + 1}. ${qs[i].prompt}  [${qs[i].marks}]', style: T.bodyStrong),
              for (var o = 0; o < qs[i].options.length; o++)
                Padding(
                  padding: EdgeInsets.only(left: 12.w, top: 2.h),
                  child: Text('${String.fromCharCode(65 + o)}. ${qs[i].options[o]}', style: T.body.copyWith(color: qs[i].correct == o ? C.successDark : C.slate)),
                ),
            ]),
          ),
      ]));
}

/// Figma 1153:3512 "5.2 Online Tests".
class OnlineTestsScreen extends StatelessWidget {
  const OnlineTestsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<OnlineTestsBloc>()..add(const OnlineTestsLoadRequested()),
        child: BlocListener<OnlineTestsBloc, OnlineTestsState>(
          listenWhen: (a, b) => a.notice != b.notice && b.notice != null,
          listener: (context, s) => handleNotice(context, s.notice!),
          child: const _TestsView(),
        ),
      );
}

class _TestsView extends StatefulWidget {
  const _TestsView();
  @override
  State<_TestsView> createState() => _TestsViewState();
}

class _TestsViewState extends State<_TestsView> {
  String _q = '', _tab = 'All Tests';
  static const _tabs = {'All Tests': null, 'Active / Live': 'live', 'Upcoming': 'upcoming', 'Completed': 'completed'};

  @override
  Widget build(BuildContext context) {
    final st = context.watch<OnlineTestsBloc>().state;
    final q = _q.toLowerCase();
    final scoped = st.tests.where((t) => '${t.title} ${t.cls} ${t.subject}'.toLowerCase().contains(q)).toList();
    int cnt(String k) => st.countOf(_tabs[k]);
    final shown = scoped.where((t) => _tabs[_tab] == null || t.status == _tabs[_tab]).toList();
    return DetailScaffold(
      title: 'Online Tests',
      subtitle: '${cnt('Upcoming')} upcoming • ${cnt('Active / Live')} live',
      fallbackRoute: RoutePaths.more,
      bottom: AppButton('Create Test', icon: Icons.add_rounded, onPressed: () => context.push(RoutePaths.testNew)),
      body: st.status != OnlineTestsStatus.loaded
          ? const LessonsLoading()
          : ListView(padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 24.h), children: [
              AppSearchField(hint: 'Search tests, subjects, classes...', onChanged: (v) => setState(() => _q = v)),
              SizedBox(height: 12.h),
              FilterChips(items: [for (final k in _tabs.keys) '$k (${cnt(k)})'], value: '$_tab (${cnt(_tab)})', onChanged: (v) => setState(() => _tab = v.split(' (').first)),
              const SectionHeader('Active & Scheduled Assessments'),
              if (shown.isEmpty) AppEmptyState('No tests found', hint: 'Create a test to get started.', icon: Icons.quiz_outlined),
              for (final t in shown) _TestCard(t),
            ]),
    );
  }
}

class _TestCard extends StatelessWidget {
  const _TestCard(this.t);
  final OnlineTest t;

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<OnlineTestsBloc>();
    final status = t.status;
    final res = t.results;
    final (label, tone) = switch (status) {
      'live' => ('Live now', Tone.danger),
      'draft' => ('Draft', Tone.warning),
      'completed' => ('Completed', Tone.success),
      _ => (testWhen(t), t.date == plusDays(1) ? Tone.brand : Tone.neutral),
    };
    return Padding(
      padding: EdgeInsets.only(bottom: 14.h),
      child: AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Flexible(flex: 5, child: Pill(label, tone: tone, icon: Icons.calendar_today_outlined)),
            SizedBox(width: 8.w),
            Expanded(flex: 4, child: Text('Class ${t.cls} • ${t.subject}', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: TextAlign.end)),
          ]),
          SizedBox(height: 12.h),
          Text(t.title, style: T.h1.copyWith(fontSize: 18.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
          SizedBox(height: 6.h),
          Text('${t.nq} ${t.mcqOnly ? 'MCQs' : 'Questions'} • ${t.duration} Mins • ${t.proctor ? 'Timed Quiz' : 'Auto-Grading Enabled'}', style: T.body),
          SizedBox(height: 4.h),
          Row(children: [
            Icon(Icons.groups_2_outlined, size: 16.r, color: C.slate),
            SizedBox(width: 6.w),
            Expanded(child: Text('Class ${t.cls} (${t.students} Students Enrolled)', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
          ]),
          if (res != null) ...[
            SizedBox(height: 12.h),
            Container(
              padding: EdgeInsets.all(12.r),
              decoration: BoxDecoration(color: C.panel, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.panelBorder)),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                _Res('Submitted', '${res.submitted}/${t.students}'), _Res('Average', '${res.avg}%'), _Res('Highest', '${res.high}'), _Res('Lowest', '${res.low}'),
              ]),
            ),
          ],
          SizedBox(height: 14.h),
          Row(children: [
            Expanded(child: SoftActionButton(Icons.visibility_outlined, 'Preview Paper', () => previewPaper(context, t))),
            SizedBox(width: 10.w),
            Expanded(
              child: status == 'completed'
                  ? SoftActionButton(Icons.copy_rounded, 'Reuse Test', () => bloc.add(OnlineTestReused(t.id)))
                  : (status == 'upcoming' || status == 'draft')
                      ? SoftActionButton(Icons.edit_note_rounded, 'Edit Test', () => context.push(RoutePaths.testEdit(t.id)))
                      : SoftActionButton(Icons.share_outlined, 'Share Link', () => bloc.add(OnlineTestShared(t.id))),
            ),
          ]),
          if (status == 'upcoming')
            Padding(
              padding: EdgeInsets.only(top: 8.h),
              child: Row(children: [
                Expanded(child: SoftActionButton(Icons.share_outlined, 'Share Link', () => bloc.add(OnlineTestShared(t.id)))),
                SizedBox(width: 10.w),
                Expanded(child: SoftActionButton(Icons.play_arrow_rounded, 'Start Now', () => bloc.add(OnlineTestStarted(t.id)))),
              ]),
            ),
          if (status == 'live')
            Padding(
              padding: EdgeInsets.only(top: 8.h),
              child: SoftActionButton(Icons.stop_circle_outlined, 'End Test & Publish Results', () async {
                final ok = await AppDialogs.showConfirmDialog(context, title: 'End test?', message: 'Students will no longer be able to submit.', confirm: 'End Test');
                if (ok) bloc.add(OnlineTestEnded(t.id));
              }),
            ),
          if (status != 'live')
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                style: TextButton.styleFrom(minimumSize: Size(0, 44.h)),
                onPressed: () async {
                  final ok = await AppDialogs.showConfirmDialog(context, title: 'Delete test?', message: 'This removes the test and its results.', confirm: 'Delete', danger: true);
                  if (ok) bloc.add(OnlineTestDeleted(t.id));
                },
                icon: Icon(Icons.delete_outline_rounded, size: 16.r, color: C.danger),
                label: Text('Delete', style: T.small.copyWith(color: C.danger)),
              ),
            ),
        ]),
      ),
    );
  }
}

class _Res extends StatelessWidget {
  const _Res(this.l, this.v);
  final String l, v;
  @override
  Widget build(BuildContext context) => Column(children: [Text(v, style: T.h3), Text(l, style: T.small.copyWith(fontSize: 11.sp))]);
}
