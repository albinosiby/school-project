import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../home/screens/widgets/teacher_tab_header.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/bloc/school_states.dart';
import '../../school/models/school_models.dart';
import '../bloc/classes_bloc.dart';
import '../bloc/classes_events.dart';
import '../bloc/classes_states.dart';
import '../models/student_metrics.dart';
import 'widgets/classes_ui.dart';

/// Figma 1153:458 "3. Classes" (tab).
class ClassesScreen extends StatelessWidget {
  const ClassesScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<ClassesBloc>()..add(const ClassesLoadRequested()),
        child: const _ClassesView(),
      );
}

class _ClassesView extends StatefulWidget {
  const _ClassesView();
  @override
  State<_ClassesView> createState() => _ClassesViewState();
}

class _ClassesViewState extends State<_ClassesView> {
  String _q = '';
  bool _classTeacherOnly = false;
  String? _selected;

  Future<void> _filter() => showAppSheet(context, title: 'Filter classes', builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Column(children: [
          AppToggleRow(
            title: 'Class teacher assignments only', value: _classTeacherOnly,
            onChanged: (v) {
              setState(() => _classTeacherOnly = v);
              set(() {});
            },
          ),
          SizedBox(height: 12.h),
          AppButton('Done', onPressed: () => Navigator.pop(ctx)),
        ]),
      ));

  Future<void> _editPacing(SchoolClass c) {
    final bloc = context.read<ClassesBloc>();
    return showAppSheet(context, title: 'Syllabus Pacing', subtitle: 'Class ${clsName(c)} • ${c.subject}', builder: (ctx) => BlocBuilder<ClassesBloc, ClassesState>(
          bloc: bloc,
          builder: (ctx, st) {
            final p = st.pacing[c.id];
            final done = p?.done ?? 0, total = p?.total ?? 1;
            return Column(children: [
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                IconAction(Icons.remove_circle_outline_rounded, 'Fewer topics', () => bloc.add(PacingChanged(c.id, -1)), color: C.primary),
                Flexible(child: Text('$done / $total topics', style: T.h1, textAlign: TextAlign.center)),
                IconAction(Icons.add_circle_outline_rounded, 'More topics', () => bloc.add(PacingChanged(c.id, 1)), color: C.primary),
              ]),
              SizedBox(height: 8.h),
              AppProgress(total == 0 ? 0 : done / total, tone: Tone.success),
              SizedBox(height: 16.h),
              AppButton('Done', onPressed: () => Navigator.pop(ctx)),
            ]);
          },
        ));
  }

  String _years(String? y) {
    final m = RegExp(r'(\d{4})-(\d{2})').firstMatch(y ?? '');
    return m == null ? '2024–2025' : '${m[1]}–20${m[2]}';
  }

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final st = context.watch<ClassesBloc>().state;
    final all = school.classes;
    final q = _q.trim().toLowerCase();
    final classes = [
      for (final c in all)
        if ((!_classTeacherOnly || c.classTeacher) &&
            (q.isEmpty || '${c.subject} ${c.grade} ${c.section} ${clsName(c)} ${c.room} ${c.wing} ${c.topic}'.toLowerCase().contains(q)))
          c
    ];
    final sel = all.where((c) => c.id == _selected).firstOrNull ?? defaultClass(all);
    final t = school.teacher;

    return Column(children: [
      const TeacherTabHeader(eyebrow: 'EDUADMIN', title: 'My Classes & Sections'),
      Expanded(
        // main column, then `side:` (the second column on wide screens)
        // ignore: sort_child_properties_last
        child: AppTabBody(children: [
          PanelCard(
            padding: EdgeInsets.all(14.w),
            child: Column(children: [
              Row(children: [
                const IconTile(Icons.event_note_rounded, size: 40),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('ACADEMIC CYCLE', style: T.capsMuted.copyWith(fontSize: 10.sp)),
                    Text('${t?.term.isNotEmpty == true ? t!.term : 'Term 2'} (${_years(t?.year)})', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ]),
                ),
                const Pill('Active', tone: Tone.success, dot: true),
              ]),
              SizedBox(height: 12.h),
              Row(children: [
                Expanded(child: AppStatBox(label: 'Students', value: '${school.students.length}', unit: 'total')),
                SizedBox(width: 8.w),
                Expanded(child: AppStatBox(label: 'Classes', value: '${all.length}', unit: 'assigned', valueColor: C.primary)),
                SizedBox(width: 8.w),
                Expanded(child: AppStatBox(label: 'Pacing', value: '${st.overallPct}%', unit: 'on track', valueColor: C.success)),
              ]),
            ]),
          ),
          SizedBox(height: 14.h),
          AppSearchField(
            hint: 'Search classes, sections, subjects, room...', onChanged: (v) => setState(() => _q = v),
            trailing: Semantics(
              label: 'Filter classes', button: true,
              child: InkResponse(
                onTap: _filter,
                child: Container(
                  width: 48.r, height: 48.r,
                  decoration: BoxDecoration(color: _classTeacherOnly ? C.primarySoft : C.panel, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.panelBorder)),
                  child: Icon(Icons.tune_rounded, color: C.primary, size: 22.r),
                ),
              ),
            ),
          ),
          SizedBox(height: 14.h),
          if (school.status == SchoolStatus.loading) Padding(padding: EdgeInsets.all(24.r), child: const Center(child: CircularProgressIndicator())),
          if (school.status == SchoolStatus.loaded && classes.isEmpty)
            const AppEmptyState('No classes found', hint: 'Try a different search or filter.', icon: Icons.search_off_rounded),
          for (final c in classes)
            _ClassCard(c, roster: school.studentsOf(c.id).length, selected: sel?.id == c.id, onSelect: () => setState(() => _selected = c.id)),
        ], side: [
          if (sel != null) ...[
            SectionHeader('Class management hub', caps: true, action: 'All Tools', onAction: () => context.push('${RoutePaths.resources}?classId=${sel.id}')),
            _Hub(cls: sel, onPacing: () => _editPacing(sel)),
            SizedBox(height: 20.h),
            Text('Class Roster (${clsLong(sel)})', style: T.h3),
            Text('Active student performance & contact quicklinks', style: T.small),
            SizedBox(height: 4.h),
            _RosterPreview(cls: sel, school: school),
          ],
        ]),
      ),
    ]);
  }
}

class _ClassCard extends StatelessWidget {
  const _ClassCard(this.c, {required this.roster, required this.selected, required this.onSelect});
  final SchoolClass c;
  final int roster;
  final bool selected;
  final VoidCallback onSelect;
  @override
  Widget build(BuildContext context) {
    final open = context.watch<ClassesBloc>().state.openHomework(c.id);
    final hw = open.isEmpty ? null : open.first;
    final total = hw?.submissions.length ?? 0;
    final submitted = hw?.turnedIn ?? 0;
    return AppCard(
      margin: EdgeInsets.only(bottom: 14.h),
      color: selected ? C.panel : C.bg, border: selected ? C.primary.withValues(alpha: .5) : C.panelBorder, radius: R.xxl,
      padding: EdgeInsets.all(16.w), onTap: onSelect,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(spacing: 8.w, runSpacing: 6.h, children: [
          if (c.classTeacher) const Pill('Class Teacher Assigned', tone: Tone.brand),
          if (c.rep.isNotEmpty) Pill('Rep: ${c.rep}', tone: Tone.purple),
        ]),
        SizedBox(height: 10.h),
        Text('${c.subject} • Section ${c.section}', style: T.h3.copyWith(fontSize: 16.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
        SizedBox(height: 4.h),
        Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8.w, children: [
          Text('${c.room} • ${c.wing}', style: T.small.copyWith(color: const Color(0xFF475569))),
          Text('• Attendance ${c.attendance.toStringAsFixed(1)}%', style: T.smallStrong.copyWith(color: C.success)),
        ]),
        SizedBox(height: 12.h),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            _Quick(Icons.groups_rounded, 'Roster ($roster)', () => context.push('${RoutePaths.students}?classId=${c.id}'), primary: true),
            SizedBox(width: 8.w),
            _Quick(Icons.assignment_outlined, 'Homework', () => context.go(RoutePaths.tasks), badge: open.isEmpty ? null : '${open.length}'),
            SizedBox(width: 8.w),
            _Quick(Icons.star_border_rounded, 'Marks', () => context.push('${RoutePaths.marks}?class=${c.id}')),
          ]),
        ),
        SizedBox(height: 12.h),
        AppCard(
          radius: R.lg, padding: EdgeInsets.all(12.w), onTap: hw == null ? null : () => context.push(RoutePaths.homework(hw.id)),
          child: hw == null
              ? Row(children: [
                  Icon(Icons.assignment_turned_in_outlined, color: C.muted, size: 22.r),
                  SizedBox(width: 10.w),
                  Expanded(child: Text('No active assignment', style: T.body)),
                  _NewHw(c.id),
                ])
              : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Container(width: 8.r, height: 8.r, decoration: const BoxDecoration(color: C.warning, shape: BoxShape.circle)),
                    SizedBox(width: 6.w),
                    Expanded(child: Text('ACTIVE ASSIGNMENT (${hw.extra['code'] ?? 'HW'})', style: T.capsMuted.copyWith(fontSize: 10.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    SizedBox(width: 6.w),
                    Flexible(child: Pill(fmtDue(hw), tone: Tone.warning)),
                  ]),
                  SizedBox(height: 8.h),
                  Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(hw.title, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
                        SizedBox(height: 2.h),
                        Text('$submitted / $total Students Submitted • ${total - submitted} Pending', style: T.small),
                      ]),
                    ),
                    SizedBox(width: 8.w),
                    _NewHw(c.id),
                  ]),
                  SizedBox(height: 10.h),
                  AppProgress(total == 0 ? 0 : submitted / total),
                ]),
        ),
      ]),
    );
  }
}

class _NewHw extends StatelessWidget {
  const _NewHw(this.classId);
  final String classId;
  @override
  Widget build(BuildContext context) =>
      AppButton('New HW', icon: Icons.add_rounded, kind: BtnKind.outline, small: true, expand: false, onPressed: () => context.push('${RoutePaths.homeworkNew}?classId=$classId'));
}

class _Quick extends StatelessWidget {
  const _Quick(this.icon, this.label, this.onTap, {this.badge, this.primary = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final String? badge;
  final bool primary;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap, borderRadius: BorderRadius.circular(R.md),
        child: Container(
          constraints: BoxConstraints(minHeight: 44.h),
          padding: EdgeInsets.symmetric(horizontal: 14.w),
          decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.panelBorder)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 18.r, color: primary ? C.primary : C.warning),
            SizedBox(width: 6.w),
            Text(label, style: T.bodyStrong.copyWith(color: primary ? C.primary : C.ink, fontSize: 13.sp)),
            if (badge != null) ...[SizedBox(width: 6.w), Pill(badge!, tone: Tone.warning)],
          ]),
        ),
      );
}

class _Hub extends StatelessWidget {
  const _Hub({required this.cls, required this.onPacing});
  final SchoolClass cls;
  final VoidCallback onPacing;
  @override
  Widget build(BuildContext context) {
    final st = context.watch<ClassesBloc>().state;
    final id = cls.id;
    final p = st.pacing[id];
    final done = p?.done ?? 0, total = p?.total ?? 0;
    final pct = p?.pct ?? 0;
    final praise = st.logCount(id, 'praise'), notes = st.logCount(id, 'note');
    final files = st.resourceCount(id);
    final tiles = [
      (Icons.auto_stories_rounded, Tone.success, '$pct% Done', 'Syllabus Pacing', '$done/$total Topics', onPacing),
      (Icons.verified_user_outlined, Tone.purple, '$praise Badges', 'Behaviour', '$praise praises logged', () => context.push('${RoutePaths.behaviour}?classId=$id')),
      (Icons.folder_copy_outlined, Tone.brand, '$files Files', 'Shared Resources', 'PDFs & Sheets', () => context.push('${RoutePaths.resources}?classId=$id')),
      (Icons.description_outlined, Tone.warning, '$notes Notes', 'Lesson Plans', 'Observations', () => context.push(RoutePaths.lessonPlans)),
    ];
    return LayoutBuilder(builder: (ctx, cs) {
      final w = (cs.maxWidth - 12.w) / 2;
      return Wrap(spacing: 12.w, runSpacing: 12.h, children: [
        for (final t in tiles)
          SizedBox(
            width: w,
            child: AppCard(
              onTap: t.$6, radius: R.xl, padding: EdgeInsets.all(14.w),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  IconTile(t.$1, tone: t.$2, size: 36),
                  SizedBox(width: 6.w),
                  Flexible(child: Pill(t.$3, tone: t.$2)),
                ]),
                SizedBox(height: 14.h),
                Text(t.$4, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(t.$5, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              ]),
            ),
          ),
      ]);
    });
  }
}

class _RosterPreview extends StatefulWidget {
  const _RosterPreview({required this.cls, required this.school});
  final SchoolClass cls;
  final SchoolState school;
  @override
  State<_RosterPreview> createState() => _RosterPreviewState();
}

class _RosterPreviewState extends State<_RosterPreview> {
  String _sort = 'Roll No';
  @override
  Widget build(BuildContext context) {
    final c = widget.cls;
    final list = widget.school.studentsOf(c.id);
    if (_sort == 'Attendance') list.sort((a, b) => b.attendance.compareTo(a.attendance));
    if (_sort == 'Name') list.sort((a, b) => a.name.compareTo(b.name));
    return Column(children: [
      Align(
        alignment: Alignment.centerRight,
        child: PopupMenuButton<String>(
          tooltip: 'Sort roster', onSelected: (v) => setState(() => _sort = v),
          itemBuilder: (_) => [for (final o in ['Roll No', 'Attendance', 'Name']) PopupMenuItem(value: o, child: Text(o))],
          child: Padding(padding: EdgeInsets.symmetric(vertical: 12.h), child: Text('Sort By: $_sort', style: T.bodyStrong.copyWith(color: C.primary, fontSize: 12.sp))),
        ),
      ),
      for (final s in list.take(3))
        AppCard(
          margin: EdgeInsets.only(bottom: 10.h), radius: R.lg, padding: EdgeInsets.all(12.w), onTap: () => context.push(RoutePaths.student(s.id)),
          child: Row(children: [
            Avatar(s.name, size: 44),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${rollTag(s)}  ${s.name}', style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                Text('Roll: ${c.grade}${c.section}-${s.roll.toString().padLeft(2, '0')} • Att: ${s.attendance}%', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                SizedBox(height: 6.h),
                Wrap(spacing: 6.w, runSpacing: 4.h, children: [Pill('Grade ${gradeOf(avgScore(s))}', tone: Tone.brand), Pill(tagOf(s), tone: Tone.success)]),
              ]),
            ),
            Text('Profile', style: T.smallStrong.copyWith(color: C.primary, fontSize: 11.sp)),
            Icon(Icons.chevron_right_rounded, color: C.muted, size: 22.r),
          ]),
        ),
      AppButton('View All ${list.length} Students in ${clsName(c)}', kind: BtnKind.soft, onPressed: () => context.push('${RoutePaths.students}?classId=${c.id}')),
    ]);
  }
}
