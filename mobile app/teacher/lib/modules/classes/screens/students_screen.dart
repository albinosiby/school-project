import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_functions/cloud_functions.dart';
import '../../../config/app_config.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/models/school_models.dart';
import '../bloc/students_bloc.dart';
import '../bloc/students_events.dart';
import '../bloc/students_states.dart';
import '../models/student_metrics.dart';
import 'widgets/classes_ui.dart';

const _statuses = ['All', 'Present', 'Absent', 'On Leave'];
const _sorts = ['Roll No (Asc)', 'Roll No (Desc)', 'Name (A-Z)', 'Attendance'];

/// Figma 1153:13381 "3.3 View All Students". Supports `?classId=` and `?q=`.
class StudentsScreen extends StatelessWidget {
  const StudentsScreen({super.key, this.classId, this.query});
  final String? classId, query;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<StudentsBloc>()..add(const StudentsLoadRequested()),
        child: BlocListener<StudentsBloc, StudentsState>(
          listenWhen: (a, b) => a.noticeSeq != b.noticeSeq,
          listener: (ctx, s) => showNotice(ctx, s.notice),
          child: _StudentsView(classId: classId, query: query),
        ),
      );
}

class _StudentsView extends StatefulWidget {
  const _StudentsView({this.classId, this.query});
  final String? classId, query;
  @override
  State<_StudentsView> createState() => _StudentsViewState();
}

class _StudentsViewState extends State<_StudentsView> {
  late final _search = TextEditingController(text: widget.query ?? '');
  late String _q = widget.query ?? '';
  late String? _classId = widget.classId;
  String _status = 'All';
  String _sort = _sorts.first;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final logs = context.watch<StudentsBloc>().state.logs;
    final cls = classOr(school.classes, _classId);
    if (cls == null) {
      return DetailScaffold(title: 'STUDENTS LIST', fallbackRoute: RoutePaths.classes, body: const AppEmptyState('No classes assigned', icon: Icons.class_outlined));
    }
    final roster = school.studentsOf(cls.id);
    int n(String s) => s == 'All' ? roster.length : roster.where((r) => todayStatus(r) == s).length;
    final q = _q.trim().toLowerCase();
    final list = [
      for (final r in roster)
        if ((_status == 'All' || todayStatus(r) == _status) && (q.isEmpty || '${r.name} ${r.roll} ${rollTag(r)} ${tagOf(r)} ${r.adm}'.toLowerCase().contains(q))) r
    ];
    switch (_sort) {
      case 'Roll No (Desc)':
        list.sort((a, b) => b.roll.compareTo(a.roll));
      case 'Name (A-Z)':
        list.sort((a, b) => a.name.compareTo(b.name));
      case 'Attendance':
        list.sort((a, b) => b.attendance.compareTo(a.attendance));
      default:
        list.sort((a, b) => a.roll.compareTo(b.roll));
    }
    final labels = [for (final s in _statuses) '$s (${n(s)})'];

    return DetailScaffold(
      title: 'CLASS ${clsName(cls).replaceAll('-', ' - ')}  STUDENTS LIST', fallbackRoute: RoutePaths.classes,
      actions: [
        IconAction(Icons.file_download_outlined, 'Export students', () => context.read<StudentsBloc>().add(StudentsExportRequested(cls.id, list.length)), color: C.primary),
      ],
      body: ListView(padding: EdgeInsets.fromLTRB(16.w, 14.h, 16.w, 40.h), children: [
        AppCard(
          radius: R.xxl, padding: EdgeInsets.all(14.w),
          child: Column(children: [
            Row(children: [
              const IconTile(Icons.groups_rounded, size: 44),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Academic ${school.teacher?.term ?? 'Term 2'} • Sec ${cls.section}', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text('Class ${clsLong(cls)} Directory', style: T.small),
                ]),
              ),
              const Pill('Active Batch', tone: Tone.success, dot: true),
            ]),
            SizedBox(height: 12.h),
            Row(children: [
              Expanded(child: AppStatBox(label: 'TOTAL', value: '${roster.length}', caption: 'Students', centered: true)),
              SizedBox(width: 8.w),
              Expanded(child: AppStatBox(label: 'ATTENDANCE', value: '${cls.attendance.toStringAsFixed(1)}%', caption: 'On Track', valueColor: C.successDark, centered: true)),
              SizedBox(width: 8.w),
              Expanded(child: AppStatBox(label: 'CLASS REP', value: cls.rep, caption: 'Prefect', valueColor: C.primary, centered: true)),
            ]),
          ]),
        ),
        SizedBox(height: 14.h),
        FilterChips(
          items: [for (final c in school.classes) 'Class ${clsName(c)}'], value: 'Class ${clsName(cls)}',
          onChanged: (v) => setState(() {
            _classId = school.classes.firstWhere((c) => 'Class ${clsName(c)}' == v).id;
            _status = 'All';
          }),
        ),
        SizedBox(height: 10.h),
        AppSearchField(controller: _search, hint: 'Search student, roll number, tag...', onChanged: (v) => setState(() => _q = v)),
        SizedBox(height: 10.h),
        FilterChips(items: labels, value: labels[_statuses.indexOf(_status)], onChanged: (v) => setState(() => _status = _statuses[labels.indexOf(v)])),
        Row(children: [
          PopupMenuButton<String>(
            tooltip: 'Sort students', onSelected: (v) => setState(() => _sort = v),
            itemBuilder: (_) => [for (final o in _sorts) PopupMenuItem(value: o, child: Text(o))],
            child: Container(
              margin: EdgeInsets.symmetric(vertical: 10.h), padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 8.h),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(R.sm), border: Border.all(color: C.border)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text('SORT: ', style: T.capsMuted),
                Text(_sort, style: T.smallStrong),
                Icon(Icons.keyboard_arrow_down_rounded, size: 18.r, color: C.slate),
              ]),
            ),
          ),
          const Spacer(),
          if (cls.classTeacher && AppConfig.isFirebase && roster.any((s) => s.roll <= 0))
            TextButton.icon(
              onPressed: () => _assignRollsByName(context, roster),
              icon: Icon(Icons.format_list_numbered_rounded, size: 18.r),
              label: Text('Assign roll numbers', style: T.smallStrong.copyWith(color: C.primary)),
            )
          else
            Text('${list.length} ${list.length == 1 ? 'student' : 'students'}', style: T.small),
        ]),
        if (list.isEmpty) const AppEmptyState('No students match', hint: 'Try another search or filter.', icon: Icons.person_search_outlined),
        for (final s in list) _StudentCard(s, merits: meritsOf(s, logs),
          onRoll: cls.classTeacher && AppConfig.isFirebase
              ? () => showDialog<void>(context: context, builder: (_) => _RollDialog(s))
              : null),
      ]),
    );
  }
}

/// Numbers every student without a roll in name order, continuing after the highest number already in use, through
/// the server's per-student allotment (which refuses a number another student holds). Renumbering a division that is
/// already numbered is done by the office on the dashboard.
Future<void> _assignRollsByName(BuildContext context, List<Student> roster) async {
  final pending = [for (final s in roster) if (s.roll <= 0) s]..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
  if (pending.isEmpty) return;
  var next = roster.fold<int>(0, (m, s) => s.roll > m ? s.roll : m) + 1;
  final ok = await AppDialogs.showConfirmDialog(
    context,
    title: 'Assign roll numbers?',
    message: '${pending.length} students have no roll number. They get $next to ${next + pending.length - 1} in alphabetical order: ${pending.take(3).map((s) => s.name).join(', ')}${pending.length > 3 ? '…' : ''}.',
    confirm: 'Assign',
  );
  if (!ok || !context.mounted) return;
  final callable = FirebaseFunctions.instanceFor(region: 'asia-south1').httpsCallable('assignStudentRoll');
  var done = 0;
  String? failure;
  for (final s in pending) {
    try {
      await callable.call({'studentId': s.id, 'roll': next});
      done++;
      next++;
    } on FirebaseFunctionsException catch (error) {
      failure = error.message ?? 'Could not assign a roll number.';
      break;
    } catch (_) {
      failure = 'Could not assign a roll number.';
      break;
    }
  }
  if (!context.mounted) return;
  AppDialogs.showSnackBar(context, message: failure == null ? 'Roll numbers assigned to $done students' : '$done assigned, then: $failure');
}

class _StudentCard extends StatelessWidget {
  const _StudentCard(this.s, {required this.merits, this.onRoll});
  final VoidCallback? onRoll;
  final Student s;
  final int merits;
  @override
  Widget build(BuildContext context) {
    final status = todayStatus(s);
    final tone = switch (status) { 'Absent' => Tone.danger, 'On Leave' => Tone.warning, _ => Tone.success };
    final dot = toneColors(tone).fg;
    return AppCard(
      margin: EdgeInsets.only(bottom: 10.h), radius: R.lg, padding: EdgeInsets.all(12.w), onTap: () => context.push(RoutePaths.student(s.id)),
      child: Row(children: [
        Avatar(s.name, size: 48, tone: status == 'Present' ? Tone.brand : tone),
        SizedBox(width: 12.w),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Pill(rollTag(s), tone: Tone.neutral),
              SizedBox(width: 6.w),
              Expanded(child: Text(s.name, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
            ]),
            SizedBox(height: 4.h),
            Pill(status == 'Present' ? tagOf(s) : status, tone: status == 'Present' ? Tone.purple : tone),
            SizedBox(height: 4.h),
            Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8.w, children: [
              Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 6.r, height: 6.r, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
                SizedBox(width: 4.w),
                Text('${s.attendance}% Attend', style: T.smallStrong.copyWith(color: dot)),
              ]),
              Text('+$merits Merits', style: T.smallStrong.copyWith(color: C.primary)),
            ]),
          ]),
        ),
        if (onRoll != null)
          IconButton(tooltip: 'Assign roll number', icon: const Icon(Icons.numbers), onPressed: onRoll),
        Icon(Icons.chevron_right_rounded, color: C.muted, size: 22.r),
      ]),
    );
  }
}

class _RollDialog extends StatefulWidget {
  const _RollDialog(this.student);
  final Student student;

  @override
  State<_RollDialog> createState() => _RollDialogState();
}

class _RollDialogState extends State<_RollDialog> {
  late final _input = TextEditingController(
    text: widget.student.roll > 0 ? widget.student.roll.toString() : '',
  );
  String? _error;
  bool _saving = false;

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _assign({bool automatic = false}) async {
    if (_saving) return;
    final roll = int.tryParse(_input.text);
    if (!automatic && (roll == null || roll < 1 || roll > 999)) {
      setState(() => _error = 'Enter a whole number from 1 to 999.');
      return;
    }
    setState(() { _saving = true; _error = null; });
    try {
      await FirebaseFunctions.instanceFor(region: 'asia-south1').httpsCallable('assignStudentRoll').call(
        {'studentId': widget.student.id, 'roll': automatic ? null : roll},
      );
      if (mounted) {
        setState(() => _saving = false);
        Navigator.of(context).pop();
      }
    } on FirebaseFunctionsException catch (error) {
      if (mounted) setState(() => _error = error.message ?? 'Could not assign the roll number.');
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not assign the roll number.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_saving,
    child: AlertDialog(
      title: Text('Roll number for ${widget.student.name}'),
      content: TextField(
        controller: _input,
        enabled: !_saving,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(3)],
        decoration: InputDecoration(labelText: 'Roll number', errorText: _error),
      ),
      actions: [
        TextButton(onPressed: _saving ? null : () => Navigator.of(context).pop(), child: const Text('Cancel')),
        TextButton(onPressed: _saving ? null : () => _assign(automatic: true), child: const Text('Assign automatically')),
        FilledButton(onPressed: _saving ? null : () => _assign(), child: Text(_saving ? 'Saving…' : 'Save')),
      ],
    ),
  );
}
