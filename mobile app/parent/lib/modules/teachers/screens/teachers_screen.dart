import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../family/screens/widgets/child_switcher.dart';
import '../bloc/teachers_bloc.dart';
import '../models/teacher_models.dart';
import 'widgets/contact_actions.dart';

enum TeacherSort {
  name('Name (A-Z)'),
  subject('Subject'),
  designation('Designation');

  const TeacherSort(this.label);
  final String label;
}

/// Figma 5.6 "View Teachers List": class teacher card, searchable / filterable subject faculty,
/// call (simulated), message (chat thread) and book PTM per teacher. Follows the child switcher.
class TeachersScreen extends StatelessWidget {
  const TeachersScreen({super.key});

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Teachers List',
    subtitle: 'Faculty of the selected child',
    fallbackRoute: RoutePaths.more,
    actions: const [HubHeaderActions()],
    body: ColoredBox(
      color: C.surface,
      child: Column(
        children: [
          const ChildSwitcher(),
          Expanded(
            child: ChildDataView<TeachersBloc, TeachersData>(
              create: () => getIt<TeachersBloc>(),
              isEmpty: (d) => d.faculty.isEmpty,
              emptyTitle: 'No teachers assigned yet',
              emptyIcon: Icons.groups_outlined,
              builder: (context, data, child) => _TeachersBody(data: data),
            ),
          ),
        ],
      ),
    ),
  );
}

class _TeachersBody extends StatefulWidget {
  const _TeachersBody({required this.data});
  final TeachersData data;
  @override
  State<_TeachersBody> createState() => _TeachersBodyState();
}

class _TeachersBodyState extends State<_TeachersBody> {
  static const _all = 'All';
  String _query = '';
  String _category = _all;
  TeacherSort _sort = TeacherSort.name;

  List<Teacher> get _visible {
    final list = widget.data.faculty
        .where((t) => t.matches(_query))
        .where((t) => _category == _all || t.category.label == _category)
        .toList();
    list.sort(
      (a, b) => switch (_sort) {
        TeacherSort.name =>
          a.name
              .replaceAll(RegExp(r'^(Mr|Mrs|Ms|Dr)\.?\s+'), '')
              .compareTo(
                b.name.replaceAll(RegExp(r'^(Mr|Mrs|Ms|Dr)\.?\s+'), ''),
              ),
        TeacherSort.subject => a.subject.compareTo(b.subject),
        TeacherSort.designation => a.designation.compareTo(b.designation),
      },
    );
    return list;
  }

  Future<void> _pickSort() async {
    final s = await showPickSheet<TeacherSort>(
      context,
      title: 'Sort teachers',
      items: TeacherSort.values,
      label: (s) => s.label,
      selected: _sort,
    );
    if (s != null) setState(() => _sort = s);
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.data;
    final visible = _visible;
    final chips = [_all, ...TeacherCategory.values.map((c) => c.label)];
    return ListView(
      padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 32.h),
      children: [
        _ClassTeacherCard(teacher: d.classTeacher),
        SizedBox(height: 20.h),
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Subject Faculty', style: T.h2),
                  Text(
                    'Academic instructors for Class ${d.className}',
                    style: T.small.copyWith(color: C.onSurfaceVariant),
                  ),
                ],
              ),
            ),
            Pill('${d.faculty.length} Active'),
          ],
        ),
        SizedBox(height: 12.h),
        AppSearchField(
          hint: 'Search by teacher name or subject...',
          onChanged: (v) => setState(() => _query = v),
          trailing: Tooltip(
            message: 'Sort teachers',
            child: Material(
              color: C.bg,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(R.lg),
                side: const BorderSide(color: C.panelBorder),
              ),
              child: InkWell(
                borderRadius: BorderRadius.circular(R.lg),
                onTap: _pickSort,
                child: SizedBox(
                  width: 48.r,
                  height: 48.r,
                  child: Icon(Icons.tune_rounded, color: C.ink, size: 22.r),
                ),
              ),
            ),
          ),
        ),
        SizedBox(height: 8.h),
        AppSolidChips(
          items: chips,
          value: _category,
          labelOf: (c) => c == _all
              ? 'All (${d.faculty.length})'
              : '$c (${d.countOf(TeacherCategory.values.firstWhere((x) => x.label == c))})',
          onChanged: (c) => setState(() => _category = c),
        ),
        SizedBox(height: 10.h),
        if (visible.isEmpty)
          Padding(
            padding: EdgeInsets.symmetric(vertical: 24.h),
            child: AppEmptyState(
              'No teachers match',
              hint: 'Try another name, subject or filter.',
              icon: Icons.person_search_outlined,
              action: AppButton(
                'Clear filters',
                kind: BtnKind.outline,
                expand: false,
                small: true,
                onPressed: () => setState(() {
                  _query = '';
                  _category = _all;
                }),
              ),
            ),
          )
        else
          for (final t in visible) _TeacherRow(teacher: t),
        SizedBox(height: 12.h),
        _DirectoryFooter(receptionPhone: d.receptionPhone),
      ],
    );
  }
}

void _message(BuildContext context, Teacher t) => context.push(
  RoutePaths.chatWith(t.threadId, teacher: t.name, role: t.role),
);

/// Teacher detail sheet: contact details and the three actions.
Future<void> showTeacherSheet(BuildContext context, Teacher t) =>
    showAppSheet<void>(
      context,
      title: t.displayName,
      subtitle: '${t.subject} • ${t.designation} • ${t.room}',
      builder: (ctx) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (t.isClassTeacher) ...[
            const Align(
              alignment: Alignment.centerLeft,
              child: Pill('Class Teacher', icon: Icons.star_rounded),
            ),
            SizedBox(height: 12.h),
          ],
          AppInfoTile(
            icon: Icons.schedule_rounded,
            label: 'OFFICE HOURS',
            value: t.officeHours,
          ),
          SizedBox(height: 8.h),
          AppInfoTile(
            icon: Icons.call_outlined,
            label: 'PHONE',
            value: t.phone,
          ),
          SizedBox(height: 8.h),
          AppInfoTile(
            icon: Icons.alternate_email_rounded,
            label: 'EMAIL',
            value: t.email,
          ),
          SizedBox(height: 16.h),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  'Call',
                  icon: Icons.call_rounded,
                  kind: BtnKind.outline,
                  onPressed: () {
                    Navigator.pop(ctx);
                    simulateCall(context, t.name, t.phone);
                  },
                ),
              ),
              SizedBox(width: 10.w),
              Expanded(
                child: AppButton(
                  'Message',
                  icon: Icons.chat_outlined,
                  kind: BtnKind.soft,
                  onPressed: () {
                    Navigator.pop(ctx);
                    _message(context, t);
                  },
                ),
              ),
            ],
          ),
          SizedBox(height: 10.h),
          AppButton(
            'Book PTM',
            icon: Icons.event_available_rounded,
            onPressed: () {
              Navigator.pop(ctx);
              context.push(RoutePaths.ptmWith(t.id));
            },
          ),
        ],
      ),
    );

class _ClassTeacherCard extends StatelessWidget {
  const _ClassTeacherCard({required this.teacher});
  final Teacher teacher;

  @override
  Widget build(BuildContext context) => AppSurfaceCard(
    hero: true,
    semanticLabel: 'Class teacher ${teacher.name}',
    onTap: () => showTeacherSheet(context, teacher),
    padding: EdgeInsets.all(14.w),
    child: Row(
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            _TeacherPhoto(teacher.name, size: 72, tone: Tone.brand),
            Positioned(
              right: -4.r,
              bottom: -4.r,
              child: Container(
                padding: EdgeInsets.all(2.r),
                decoration: BoxDecoration(
                  color: C.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
                child: Icon(
                  Icons.star_rounded,
                  size: 12.r,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
        SizedBox(width: 12.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 6.w,
                runSpacing: 4.h,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: 8.w,
                      vertical: 3.h,
                    ),
                    decoration: BoxDecoration(
                      color: C.primary,
                      borderRadius: BorderRadius.circular(R.pill),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.star_rounded,
                          size: 12.r,
                          color: Colors.white,
                        ),
                        SizedBox(width: 3.w),
                        Text(
                          'Class Teacher',
                          style: T.small.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            fontSize: 11.sp,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '${teacher.room} • ${teacher.designation}',
                    style: T.small.copyWith(color: C.onSurfaceVariant),
                  ),
                ],
              ),
              SizedBox(height: 4.h),
              Text(
                teacher.displayName,
                style: T.h3.copyWith(fontSize: 16.sp, color: C.onSurface),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                teacher.subject,
                style: T.small.copyWith(color: C.primary),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              SizedBox(height: 2.h),
              Row(
                children: [
                  Icon(
                    Icons.schedule_rounded,
                    size: 13.r,
                    color: C.onSurfaceVariant,
                  ),
                  SizedBox(width: 4.w),
                  Flexible(
                    child: Text(
                      'Office Hours: ${teacher.officeHours}',
                      style: T.small.copyWith(color: C.onSurfaceVariant),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        SizedBox(width: 8.w),
        _MessageButton(teacher: teacher, solid: true),
      ],
    ),
  );
}

class _TeacherRow extends StatelessWidget {
  const _TeacherRow({required this.teacher});
  final Teacher teacher;

  @override
  Widget build(BuildContext context) => AppSurfaceCard(
    margin: EdgeInsets.only(bottom: 10.h),
    padding: EdgeInsets.all(12.w),
    semanticLabel: '${teacher.name}, ${teacher.subject}',
    onTap: () => showTeacherSheet(context, teacher),
    child: Row(
      children: [
        _TeacherPhoto(
          teacher.name,
          size: 56,
          tone: teacher.isClassTeacher ? Tone.brand : Tone.neutral,
        ),
        SizedBox(width: 12.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: 6.w,
                      vertical: 2.h,
                    ),
                    decoration: BoxDecoration(
                      color: C.surfaceLow,
                      borderRadius: BorderRadius.circular(4.r),
                    ),
                    child: Text(
                      teacher.designation,
                      style: T.small.copyWith(
                        fontSize: 11.sp,
                        color: C.onSurfaceVariant,
                      ),
                    ),
                  ),
                  SizedBox(width: 6.w),
                  Flexible(
                    child: Text(
                      teacher.room,
                      style: T.small.copyWith(color: C.onSurface),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 2.h),
              Text(
                teacher.name,
                style: T.h3.copyWith(color: C.onSurface),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                teacher.subject,
                style: T.small.copyWith(color: C.primary),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        SizedBox(width: 8.w),
        _MessageButton(teacher: teacher),
      ],
    ),
  );
}

class _MessageButton extends StatelessWidget {
  const _MessageButton({required this.teacher, this.solid = false});
  final Teacher teacher;
  final bool solid;

  @override
  Widget build(BuildContext context) => Tooltip(
    message: 'Message ${teacher.name}',
    child: Material(
      color: solid ? C.primary : C.surfaceLow,
      borderRadius: BorderRadius.circular(R.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(R.md),
        onTap: () => _message(context, teacher),
        child: SizedBox(
          width: 44.r,
          height: 44.r,
          child: Icon(
            Icons.chat_outlined,
            size: 20.r,
            color: solid ? Colors.white : C.primary,
          ),
        ),
      ),
    ),
  );
}

/// Photo placeholder (no image assets): rounded initials tile.
class _TeacherPhoto extends StatelessWidget {
  const _TeacherPhoto(this.name, {required this.size, required this.tone});
  final String name;
  final double size;
  final Tone tone;

  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone == Tone.neutral ? Tone.brand : tone);
    final initials = name
        .replaceAll(RegExp(r'^(Mr|Mrs|Ms|Dr)\.?\s+'), '')
        .split(RegExp(r'\s+'))
        .where((e) => RegExp(r'^[A-Za-z]').hasMatch(e))
        .take(2)
        .map((e) => e[0].toUpperCase())
        .join();
    return Container(
      width: size.r,
      height: size.r,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(R.md),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: tone == Tone.neutral
              ? [C.tealSoft, C.primarySoft]
              : [c.bg, C.indigoSoft],
        ),
      ),
      child: Text(
        initials,
        style: T.h3.copyWith(
          color: tone == Tone.neutral ? C.teal : c.fg,
          fontSize: (size * .3).sp,
        ),
      ),
    );
  }
}

class _DirectoryFooter extends StatelessWidget {
  const _DirectoryFooter({required this.receptionPhone});
  final String receptionPhone;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(
        'All faculty communications are monitored under the school\'s '
        'Parent-Teacher guidelines. For urgent school queries, call Reception.',
        textAlign: TextAlign.center,
        style: T.small.copyWith(color: C.onSurfaceVariant),
      ),
      SizedBox(height: 6.h),
      TextButton.icon(
        onPressed: () => showAppSheet<void>(
          context,
          title: 'Directory Help',
          subtitle: 'Reach the school office for anything not listed here.',
          builder: (ctx) => Column(
            children: [
              AppInfoTile(
                icon: Icons.support_agent_rounded,
                label: 'RECEPTION',
                value: receptionPhone,
              ),
              SizedBox(height: 8.h),
              const AppInfoTile(
                icon: Icons.schedule_rounded,
                label: 'OFFICE HOURS',
                value: 'Mon - Sat, 08:00 AM - 04:00 PM',
              ),
              SizedBox(height: 16.h),
              AppButton(
                'Call Reception',
                icon: Icons.call_rounded,
                onPressed: () {
                  Navigator.pop(ctx);
                  simulateCall(context, 'Reception', receptionPhone);
                },
              ),
            ],
          ),
        ),
        icon: Icon(Icons.help_outline_rounded, size: 16.r, color: C.primary),
        label: Text(
          'Directory Help',
          style: T.smallStrong.copyWith(color: C.primary),
        ),
      ),
    ],
  );
}
