import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/models/school_models.dart';
import '../bloc/behaviour_bloc.dart';
import '../bloc/behaviour_events.dart';
import '../bloc/behaviour_states.dart';
import '../models/classes_models.dart';
import '../models/student_metrics.dart';
import 'widgets/classes_ui.dart';

/// Figma 1153:10945 "3.1 Behaviour". Optional [classId] / [studentId] scope the records.
class BehaviourScreen extends StatelessWidget {
  const BehaviourScreen({super.key, this.classId, this.studentId});
  final String? classId, studentId;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<BehaviourBloc>()..add(const BehaviourLoadRequested()),
        child: BlocListener<BehaviourBloc, BehaviourState>(
          listenWhen: (a, b) => a.noticeSeq != b.noticeSeq,
          listener: (ctx, s) => showNotice(ctx, s.notice),
          child: _BehaviourView(classId: classId, studentId: studentId),
        ),
      );
}

class _BehaviourView extends StatefulWidget {
  const _BehaviourView({this.classId, this.studentId});
  final String? classId, studentId;
  @override
  State<_BehaviourView> createState() => _BehaviourViewState();
}

class _BehaviourViewState extends State<_BehaviourView> {
  String _q = '';
  String _tab = 'all'; // all | praise | flag
  bool _newest = true;

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final st = context.watch<BehaviourBloc>().state;
    final cls = classOr(school.classes, widget.classId);
    final cid = cls?.id ?? '';
    final students = {for (final s in school.students) s.id: s};
    final all = [for (final l in st.logs) if (l.classId == cid && (widget.studentId == null || l.studentId == widget.studentId)) l];
    final praise = all.where((l) => l.kind == 'praise').length;
    final flags = all.where((l) => l.kind == 'flag').length;
    final weekAgo = DateTime.now().subtract(const Duration(days: 7));
    final praiseWeek = all.where((l) => l.kind == 'praise' && l.time.isAfter(weekAgo)).length;
    final flagsWeek = all.where((l) => l.kind == 'flag' && l.time.isAfter(weekAgo)).length;
    final sentiment = all.isEmpty ? 100 : ((all.length - flags) * 100 / all.length).round();
    final q = _q.trim().toLowerCase();
    final shown = [
      for (final l in all)
        if ((_tab == 'all' || l.kind == _tab) &&
            (q.isEmpty ||
                '${students[l.studentId]?.name} ${l.badge} ${l.context} ${l.note} ${students[l.studentId] == null ? '' : rollTag(students[l.studentId]!)}'.toLowerCase().contains(q)))
          l
    ]..sort((a, b) => _newest ? b.at.compareTo(a.at) : a.at.compareTo(b.at));
    final newLog = '${RoutePaths.behaviourNew}?classId=$cid${widget.studentId != null ? '&studentId=${widget.studentId}' : ''}';

    return DetailScaffold(
      title: 'STUDENT BEHAVIOUR', fallbackRoute: RoutePaths.classes,
      body: ListView(padding: EdgeInsets.fromLTRB(16.w, 14.h, 16.w, 40.h), children: [
        Row(children: [
          Flexible(
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 12.h),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: C.border)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 10.r, height: 10.r, decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle)),
                SizedBox(width: 8.w),
                Flexible(child: Text('${school.teacher?.term ?? 'Term 2'} Log', style: T.bodyStrong, overflow: TextOverflow.ellipsis)),
              ]),
            ),
          ),
          SizedBox(width: 8.w),
          const Spacer(),
          AppButton('New Log', icon: Icons.add_rounded, expand: false, onPressed: () => context.push(newLog)),
        ]),
        SizedBox(height: 14.h),
        AppSearchField(hint: 'Search student, roll no., or tag...', onChanged: (v) => setState(() => _q = v)),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.xxl, padding: EdgeInsets.all(14.w),
          child: Column(children: [
            Row(children: [
              const IconTile(Icons.show_chart_rounded, size: 40),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Weekly Conduct Pulse', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text('Class ${cls == null ? '' : clsLong(cls)} • ${school.studentsOf(cid).length} Students', style: T.small),
                ]),
              ),
              const Pill('Live Sync', dot: true),
            ]),
            SizedBox(height: 12.h),
            Row(children: [
              Expanded(child: _Pulse('Praise', '$praiseWeek', 'new', 'This week', Icons.star_rounded, C.warning, C.primary)),
              SizedBox(width: 8.w),
              Expanded(child: _Pulse('Alerts', '$flagsWeek', flagsWeek == 0 ? 'clean' : 'open', 'Active flags', Icons.verified_user_outlined, C.success, flagsWeek == 0 ? C.successDark : C.danger)),
              SizedBox(width: 8.w),
              Expanded(child: _Pulse('Sentiment', '$sentiment%', '', 'Positive index', Icons.sentiment_satisfied_alt_rounded, C.primary, C.primary)),
            ]),
          ]),
        ),
        SizedBox(height: 14.h),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            CountTab('All Records (${all.length})',icon: Icons.list_alt_rounded, on: _tab == 'all', onTap: () => setState(() => _tab = 'all')),
            SizedBox(width: 8.w),
            CountTab('Praise & Stars ($praise)', icon: Icons.star_rounded, on: _tab == 'praise', onTap: () => setState(() => _tab = 'praise')),
            SizedBox(width: 8.w),
            CountTab('Guidance Flags ($flags)', icon: Icons.flag_outlined, iconColor: C.danger, on: _tab == 'flag', onTap: () => setState(() => _tab = 'flag')),
          ]),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(2.w, 16.h, 0, 8.h),
          child: Row(children: [
            Icon(Icons.history_edu_rounded, size: 18.r, color: C.primary),
            SizedBox(width: 6.w),
            Expanded(child: Text('Recent Conduct Timeline', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
            TextButton.icon(
              onPressed: () => setState(() => _newest = !_newest),
              style: TextButton.styleFrom(minimumSize: Size(44.r, 44.r)),
              icon: Icon(Icons.swap_vert_rounded, size: 16.r),
              label: Text(_newest ? 'Newest first' : 'Oldest first', style: T.small),
            ),
          ]),
        ),
        if (st.status == BehaviourStatus.loaded && shown.isEmpty)
          const AppEmptyState('No conduct records', hint: 'Tap New Log to record praise, a guidance flag or a note.', icon: Icons.fact_check_outlined),
        for (final l in shown) _LogCard(l, students[l.studentId]),
      ]),
    );
  }
}

class _Pulse extends StatelessWidget {
  const _Pulse(this.label, this.value, this.unit, this.sub, this.icon, this.iconColor, this.unitColor);
  final String label, value, unit, sub;
  final IconData icon;
  final Color iconColor, unitColor;
  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.all(10.r),
        decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Expanded(child: Text(label, style: T.small, overflow: TextOverflow.ellipsis)), Icon(icon, size: 14.r, color: iconColor)]),
          SizedBox(height: 4.h),
          FittedBox(
            fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
            child: Text.rich(TextSpan(children: [
              TextSpan(text: value, style: T.stat.copyWith(fontSize: 22.sp)),
              if (unit.isNotEmpty) TextSpan(text: ' $unit', style: T.smallStrong.copyWith(color: unitColor)),
            ])),
          ),
          Text(sub, style: T.small.copyWith(fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
      );
}

class _LogCard extends StatelessWidget {
  const _LogCard(this.l, this.student);
  final BehaviourLog l;
  final Student? student;

  Future<void> _menu(BuildContext context, String v) async {
    final bloc = context.read<BehaviourBloc>();
    if (v == 'parent') bloc.add(BehaviourParentNotified(l));
    if (v == 'delete' && await AppDialogs.showConfirmDialog(context, title: 'Delete log?', message: 'This conduct record will be removed.', confirm: 'Delete', danger: true)) {
      bloc.add(BehaviourLogDeleted(l.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = student?.name ?? 'Unknown student';
    final tone = kindTone(l.kind);
    final accent = l.kind == 'flag' ? C.warning : l.kind == 'praise' ? C.primary : C.muted;
    return Container(
      margin: EdgeInsets.only(bottom: 14.h),
      decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.xl), border: Border.all(color: C.border)),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: student == null ? null : () => context.push(RoutePaths.student(student!.id)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(height: 4.h, color: accent),
            Padding(
              padding: EdgeInsets.fromLTRB(14.w, 12.h, 4.w, 14.h),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Avatar(name, size: 44, tone: tone),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text.rich(
                        TextSpan(children: [TextSpan(text: name, style: T.h3), TextSpan(text: student == null ? '' : '  ${rollTag(student!)}', style: T.small)]),
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                      ),
                      SizedBox(height: 6.h),
                      Pill(l.badge, tone: tone, icon: kindIcon(l.kind)),
                    ]),
                  ),
                  PopupMenuButton<String>(
                    tooltip: 'Log options', onSelected: (v) => _menu(context, v),
                    itemBuilder: (_) => const [PopupMenuItem(value: 'parent', child: Text('Notify parent')), PopupMenuItem(value: 'delete', child: Text('Delete log'))],
                  ),
                ]),
                Padding(
                  padding: EdgeInsets.only(right: 10.w),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    SizedBox(height: 8.h),
                    Text(l.context, style: T.smallStrong.copyWith(color: C.primary)),
                    SizedBox(height: 6.h),
                    Text(l.note, style: T.body.copyWith(color: C.ink)),
                    Divider(height: 22.h, color: C.border),
                    Text('${l.teacher} • ${fmtAgo(l.at)}', style: T.small),
                    SizedBox(height: 4.h),
                    Row(children: [
                      Icon(Icons.mark_email_read_outlined, size: 14.r, color: C.primary),
                      SizedBox(width: 6.w),
                      Expanded(child: Text(l.status, style: T.smallStrong.copyWith(color: C.primary), overflow: TextOverflow.ellipsis)),
                    ]),
                  ]),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
