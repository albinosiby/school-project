import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/bloc/school_states.dart';
import '../../school/models/school_models.dart';
import '../bloc/behaviour_bloc.dart';
import '../bloc/behaviour_events.dart';
import '../bloc/behaviour_states.dart';
import '../models/classes_models.dart';
import '../models/student_metrics.dart';
import 'widgets/classes_ui.dart';
import 'widgets/custom_badge_sheet.dart';

/// Figma 1153:11247 "3.1.1 New Log" (+ 1153:11985 Custom Badge sheet).
class NewLogScreen extends StatelessWidget {
  const NewLogScreen({super.key, this.classId, this.studentId});
  final String? classId, studentId;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<BehaviourBloc>()..add(const BehaviourLoadRequested()),
        child: BlocListener<BehaviourBloc, BehaviourState>(
          listenWhen: (a, b) => a.noticeSeq != b.noticeSeq || a.savedSeq != b.savedSeq,
          listener: (ctx, s) {
            showNotice(ctx, s.notice);
            if (s.savedSeq > 0) ctx.canPop() ? ctx.pop() : ctx.go(RoutePaths.classes);
          },
          child: _NewLogForm(classId: classId, studentId: studentId),
        ),
      );
}

class _NewLogForm extends StatefulWidget {
  const _NewLogForm({this.classId, this.studentId});
  final String? classId, studentId;
  @override
  State<_NewLogForm> createState() => _NewLogFormState();
}

const _kinds = [('praise', 'Praise & Merits', Icons.workspace_premium_outlined), ('flag', 'Guidance Flag', Icons.flag_outlined), ('note', 'Pastoral Note', Icons.chat_bubble_outline_rounded)];

class _NewLogFormState extends State<_NewLogForm> {
  late String? _studentId = widget.studentId;
  String _kind = 'praise';
  String? _badge;
  final _ctx = TextEditingController();
  final _note = TextEditingController();
  final _customMerit = TextEditingController(text: '20');
  int _merits = 5;
  bool _custom = false;
  bool _notify = true, _dossier = true, _nominate = false;
  String? _attachment;
  String? _err;

  @override
  void dispose() {
    _ctx.dispose();
    _note.dispose();
    _customMerit.dispose();
    super.dispose();
  }

  Student? _student(SchoolState s) {
    if (_studentId != null) return s.students.where((x) => x.id == _studentId).firstOrNull;
    final cls = classOr(s.classes, widget.classId);
    final l = cls == null ? const <Student>[] : s.studentsOf(cls.id);
    return l.isEmpty ? null : l.first;
  }

  Future<void> _pickStudent(Student current) async {
    final picked = await showAppSheet<String>(context, title: 'Change Student / Class', builder: (ctx) => _StudentPicker(initialClass: current.classId));
    if (picked != null) setState(() => _studentId = picked);
  }

  Future<void> _customBadge(SchoolClass? cls) async {
    final bloc = context.read<BehaviourBloc>();
    final badge = await showCustomBadgeSheet(context, className: cls == null ? '' : clsName(cls));
    if (badge == null) return;
    bloc.add(BehaviourBadgeCreated(badge));
    setState(() {
      _kind = 'praise';
      _badge = badge.name;
      _merits = badge.merits;
      _custom = false;
      _err = null;
    });
  }

  void _publish(Student student, String teacher) {
    final merits = _kind == 'praise' ? (_custom ? int.tryParse(_customMerit.text.trim()) : _merits) : 0;
    String? err;
    if (_badge == null) {
      err = 'Select a badge';
    } else if (_note.text.trim().isEmpty) {
      err = 'Add an observation note';
    } else if (_note.text.length > 500) {
      err = 'Note must be 500 characters or fewer';
    } else if (merits == null || merits < 0) {
      err = 'Enter valid merits';
    }
    if (err != null) {
      setState(() => _err = err);
      showNotice(context, err);
      return;
    }
    context.read<BehaviourBloc>().add(BehaviourLogAdded(
          BehaviourLog(
            studentId: student.id, classId: student.classId, kind: _kind, badge: _badge!,
            context: _ctx.text.trim().isEmpty ? 'General' : _ctx.text.trim(), note: _note.text.trim(), merits: merits!,
            teacher: teacher, at: DateTime.now().toIso8601String(),
            status: _notify ? 'Parent notified' : (_dossier ? 'Logged to Dossier' : 'Logged'),
            extra: {'notify': _notify, 'dossier': _dossier, 'nominated': _nominate, 'attachment': _attachment},
          ),
          studentName: student.name,
        ));
  }

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final st = context.watch<BehaviourBloc>().state;
    final student = _student(school);
    if (student == null) {
      return DetailScaffold(title: 'NEW LOG', fallbackRoute: RoutePaths.classes, body: const AppEmptyState('No students available', icon: Icons.person_off_outlined));
    }
    final cls = school.classById(student.classId);
    final badges = [for (final b in st.badges) if (b.kind == _kind) b];
    final recentIds = {for (final l in st.logs) if (l.classId == student.classId) l.studentId}.take(4);
    final recent = [for (final id in recentIds) ?school.students.where((x) => x.id == id).firstOrNull];
    String short(Student s) {
      final p = s.name.split(' ');
      return p.length > 1 ? '${p.first} ${p.last[0]}.' : s.name;
    }

    return DetailScaffold(
      title: 'NEW LOG', fallbackRoute: RoutePaths.classes,
      bottom: AppButton('Publish', icon: Icons.send_rounded, onPressed: () => _publish(student, school.teacher?.name ?? 'Teacher')),
      body: ListView(padding: EdgeInsets.fromLTRB(16.w, 14.h, 16.w, 30.h), children: [
        Row(children: [
          Expanded(child: Text('SUBJECT STUDENT', style: T.capsMuted)),
          TextButton(
            onPressed: () => _pickStudent(student),
            style: TextButton.styleFrom(minimumSize: Size(44.r, 44.r)),
            child: Text('Change Student / Class', style: T.bodyStrong.copyWith(color: C.primary, fontSize: 12.5.sp)),
          ),
        ]),
        PanelCard(
          padding: EdgeInsets.all(14.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Avatar(student.name, size: 48),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(student.name, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                  SizedBox(height: 2.h),
                  Pill(tagOf(student).toUpperCase()),
                  SizedBox(height: 2.h),
                  Text('Roll ${rollTag(student)} • Class ${cls == null ? '' : clsLong(cls)}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ]),
              ),
              Flexible(child: Pill('+${meritsOf(student, st.logs)} Merits', tone: Tone.success)),
            ]),
            if (recent.isNotEmpty) ...[
              SizedBox(height: 10.h),
              Text('Quick Switch Recent:', style: T.small),
              SizedBox(height: 6.h),
              AppChoiceChips(
                solid: true, items: [for (final r in recent) short(r)], value: short(student),
                onChanged: (v) => setState(() => _studentId = recent.firstWhere((r) => short(r) == v).id),
              ),
            ],
          ]),
        ),
        SizedBox(height: 16.h),
        const CapsLabel('Entry Classification'),
        Row(children: [
          for (final k in _kinds)
            Expanded(
              child: Semantics(
                button: true, selected: _kind == k.$1,
                child: InkWell(
                  borderRadius: BorderRadius.circular(R.md),
                  onTap: () => setState(() {
                    _kind = k.$1;
                    _badge = null;
                    _err = null;
                  }),
                  child: Container(
                    height: 64.h, margin: EdgeInsets.only(right: k.$1 == 'note' ? 0 : 8.w), padding: EdgeInsets.symmetric(horizontal: 4.w),
                    decoration: BoxDecoration(
                      color: _kind == k.$1 ? C.primarySoft : C.bg, borderRadius: BorderRadius.circular(R.md),
                      border: Border.all(color: _kind == k.$1 ? C.primary : C.border),
                    ),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(k.$3, size: 20.r, color: _kind == k.$1 ? C.primary : C.slate),
                      SizedBox(height: 4.h),
                      Text(k.$2, style: T.smallStrong.copyWith(color: _kind == k.$1 ? C.primary : C.slate, fontSize: 11.sp), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ]),
                  ),
                ),
              ),
            ),
        ]),
        SizedBox(height: 16.h),
        CapsLabel('Badge Commendation', trailing: Pill(_badge == null ? 'None selected' : '1 Selected')),
        AppChoiceChips(
          items: [for (final b in badges) b.name], value: _badge ?? '', solid: true, check: true,
          icons: {for (final b in badges) b.name: badgeIcon(b.icon)},
          onChanged: (v) => setState(() {
            _badge = v;
            if (_kind == 'praise') {
              _merits = badges.firstWhere((b) => b.name == v).merits.clamp(5, 25);
              _custom = false;
            }
            _err = null;
          }),
        ),
        SizedBox(height: 8.h),
        Align(
          alignment: Alignment.centerLeft,
          child: AppButton('Custom Badge', icon: Icons.add_rounded, kind: BtnKind.soft, small: true, expand: false, onPressed: () => _customBadge(cls)),
        ),
        SizedBox(height: 16.h),
        AppTextField(label: 'Activity / Subject Context', controller: _ctx, hint: 'e.g. Quadratic Equations Peer Review'),
        Row(children: [
          Expanded(child: Text('Observation Note', style: T.smallStrong.copyWith(color: C.slate))),
          Text('${_note.text.length} / 500 chars', style: T.small.copyWith(color: _note.text.length > 500 ? C.danger : C.slate)),
        ]),
        SizedBox(height: 6.h),
        TextField(
          controller: _note, maxLines: 5, minLines: 4, onChanged: (_) => setState(() => _err = null),
          decoration: const InputDecoration(hintText: 'Describe what you observed...'),
        ),
        if (_err != null) Padding(padding: EdgeInsets.only(top: 6.h), child: Text(_err!, style: T.small.copyWith(color: C.danger))),
        if (_kind == 'praise') ...[
          SizedBox(height: 16.h),
          const CapsLabel('Merits Awarded'),
          AppChoiceChips(
            items: const ['+5', '+10', '+15', '+25', 'Custom'], value: _custom ? 'Custom' : '+$_merits', solid: true,
            onChanged: (v) => setState(() {
              if (v == 'Custom') {
                _custom = true;
              } else {
                _merits = int.parse(v.substring(1));
                _custom = false;
              }
            }),
          ),
          if (_custom) Padding(padding: EdgeInsets.only(top: 10.h), child: AppTextField(label: 'Custom merits', controller: _customMerit, keyboard: TextInputType.number)),
        ],
        SizedBox(height: 12.h),
        AppToggleRow(title: 'Instant Parent Notification', subtitle: 'SMS & Portal alert to ${student.guardian}', value: _notify, onChanged: (v) => setState(() => _notify = v), margin: EdgeInsets.only(bottom: 8.h)),
        AppToggleRow(
          title: 'Add to Official Student Dossier', subtitle: "Will appear in ${student.name.split(' ').first}'s official Term 2 Progress Card",
          value: _dossier, onChanged: (v) => setState(() => _dossier = v), margin: EdgeInsets.only(bottom: 8.h),
        ),
        AppToggleRow(
          title: 'Nominate for Monthly Star Contender', subtitle: "Submits directly to Principal's Honor Roll selection panel",
          value: _nominate, onChanged: (v) => setState(() => _nominate = v), margin: EdgeInsets.only(bottom: 8.h),
        ),
        SizedBox(height: 12.h),
        const CapsLabel('Attachment & Evidence (Optional)'),
        AppCard(
          radius: R.lg, color: C.panel, border: C.panelBorder, padding: EdgeInsets.all(16.w),
          onTap: () => setState(() => _attachment = _attachment == null ? 'evidence_${DateTime.now().millisecondsSinceEpoch % 10000}.jpg' : null),
          child: Row(children: [
            Icon(_attachment == null ? Icons.cloud_upload_outlined : Icons.attach_file_rounded, color: C.primary, size: 24.r),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_attachment ?? 'Attach Classwork Photo or Certificate (Optional)', style: T.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis),
                Text(_attachment == null ? 'Supports PNG, JPG, or PDF up to 10MB' : 'Tap to remove', style: T.small),
              ]),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _StudentPicker extends StatefulWidget {
  const _StudentPicker({this.initialClass});
  final String? initialClass;
  @override
  State<_StudentPicker> createState() => _StudentPickerState();
}

class _StudentPickerState extends State<_StudentPicker> {
  late String _cid = widget.initialClass ?? '';
  String _q = '';
  @override
  Widget build(BuildContext context) {
    final s = context.watch<SchoolBloc>().state;
    final classes = s.classes;
    if (classes.isEmpty) return const AppEmptyState('No classes');
    final cls = classes.where((c) => c.id == _cid).firstOrNull ?? classes.first;
    final q = _q.toLowerCase();
    final list = [for (final st in s.studentsOf(cls.id)) if (q.isEmpty || '${st.name} ${st.roll}'.toLowerCase().contains(q)) st];
    return Column(children: [
      FilterChips(items: [for (final c in classes) clsName(c)], value: clsName(cls), onChanged: (v) => setState(() => _cid = classes.firstWhere((c) => clsName(c) == v).id)),
      SizedBox(height: 10.h),
      AppSearchField(hint: 'Search student or roll', onChanged: (v) => setState(() => _q = v)),
      SizedBox(
        height: 320.h,
        child: ListView.builder(
          itemCount: list.length,
          itemBuilder: (_, i) => ListTile(
            contentPadding: EdgeInsets.zero, minTileHeight: 52.h,
            leading: Avatar(list[i].name, size: 36), title: Text(list[i].name, style: T.bodyStrong, overflow: TextOverflow.ellipsis),
            subtitle: Text('Roll ${rollTag(list[i])}', style: T.small),
            onTap: () => Navigator.pop(context, list[i].id),
          ),
        ),
      ),
    ]);
  }
}
