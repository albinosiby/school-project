import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/certificates_bloc.dart';
import '../bloc/certificates_events.dart';
import '../models/certificate_models.dart';
import 'certificates_screen.dart';
import 'widgets/certificate_widgets.dart';
import 'widgets/lessons_common.dart';

const _presets = ['Academic Merit', '100% Attendance', 'Science Exhibition', 'Sports Star'];

/// Figma 1153:9577 "5.9.2 Issue Certificate".
class CertificateIssueScreen extends StatelessWidget {
  const CertificateIssueScreen({super.key});
  @override
  Widget build(BuildContext context) => const CertificatesScope(child: _IssueView());
}

class _IssueView extends StatefulWidget {
  const _IssueView();
  @override
  State<_IssueView> createState() => _IssueViewState();
}

class _IssueViewState extends State<_IssueView> {
  final _title = TextEditingController(), _citation = TextEditingController(), _authority = TextEditingController(text: 'STEM Olympiad Board'), _search = TextEditingController();
  late final _dateCtl = TextEditingController(text: 'Today • ${fmtIso(todayIso(), 'MMM d, yyyy')}');
  String? _classId, _studentId, _tplId;
  bool _sign = true, _seal = true, _mark = false, _changing = true, _submitted = false;

  @override
  void dispose() {
    for (final c in [_title, _citation, _authority, _search, _dateCtl]) {
      c.dispose();
    }
    super.dispose();
  }

  void _preview(String? templateId) {
    setState(() => _submitted = true);
    if (_studentId == null) return AppDialogs.showSnackBar(context, message: 'Select a student first', isError: true);
    if (_title.text.trim().isEmpty || _citation.text.trim().length < 10) {
      return AppDialogs.showSnackBar(context, message: 'Fill the title and a citation (min 10 characters)', isError: true);
    }
    if (!_sign) return AppDialogs.showSnackBar(context, message: 'Teacher digital signature is required', isError: true);
    context.read<CertificatesBloc>().add(CertificateDraftSaved(CertificateDraft(
          studentId: _studentId!, title: _title.text.trim(), citation: _citation.text.trim(), authority: _authority.text.trim(),
          templateId: templateId ?? 'tp_1', seal: _seal, mark: _mark,
        )));
  }

  Widget _error(String text) => Padding(padding: EdgeInsets.only(bottom: 8.h), child: Text(text, style: T.small.copyWith(color: C.danger)));

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final st = context.watch<CertificatesBloc>().state;
    final classes = school.classes;
    _classId ??= classes.isEmpty ? null : classes.first.id;
    final cls = school.classById(_classId ?? '');
    final students = school.studentsOf(_classId ?? '');
    final q = _search.text.toLowerCase();
    final matches = students.where((e) => q.isEmpty || e.name.toLowerCase().contains(q) || '${e.roll}' == q.replaceAll('#', '')).take(5).toList();
    final stu = school.students.where((s) => s.id == _studentId).firstOrNull;
    final tpls = st.templates;
    final picked = _tplId ?? (tpls.isEmpty ? null : tpls.first.id);
    final me = school.teacher;

    return DetailScaffold(
      title: 'Issue Certificate',
      subtitle: 'Academic 2026-27',
      fallbackRoute: RoutePaths.certificates,
      bottom: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          Expanded(child: AppButton('Preview', icon: Icons.visibility_outlined, kind: BtnKind.outline, onPressed: () => _preview(picked))),
          SizedBox(width: 10.w),
          Expanded(flex: 2, child: AppButton('Sign & Issue', icon: Icons.verified_outlined, onPressed: () => _preview(picked))),
        ]),
        SizedBox(height: 4.h),
        Text('Auto-syncs with Student Documents & Parent Portal upon signing.', style: T.small.copyWith(fontSize: 11.sp), textAlign: TextAlign.center, maxLines: 2),
      ]),
      body: ListView(padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 24.h), children: [
        LessonHeading('1. Select Recipient', icon: Icons.how_to_reg_outlined),
        if (classes.isNotEmpty)
          AppDropdown<String>(
            label: 'TARGET CLASS / BATCH', value: _classId!, items: [for (final c in classes) c.id],
            labelOf: (id) {
              final c = classes.firstWhere((e) => e.id == id);
              return 'Class ${c.label} • ${c.students} Students';
            },
            onChanged: (v) => setState(() {
              _classId = v;
              _studentId = null;
              _changing = true;
            }),
          ),
        if (stu != null && !_changing)
          AppCard(
            color: C.panel, border: C.primary,
            child: Row(children: [
              Avatar(stu.name, size: 44),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(child: Text(stu.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    SizedBox(width: 6.w),
                    const Pill('SELECTED'),
                  ]),
                  Text('Roll #${'${stu.roll}'.padLeft(2, '0')} • Class ${cls?.label ?? ''}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ]),
              ),
              TextButton(style: TextButton.styleFrom(minimumSize: Size(0, 44.h)), onPressed: () => setState(() => _changing = true), child: const Text('Change')),
            ]),
          )
        else ...[
          TextField(
            controller: _search, onChanged: (_) => setState(() {}),
            decoration: InputDecoration(hintText: 'Search student by name or roll number...', prefixIcon: Icon(Icons.search_rounded, size: 22.r)),
          ),
          SizedBox(height: 8.h),
          for (final e in matches)
            ListTile(
              dense: true, contentPadding: EdgeInsets.zero, minTileHeight: 52.h,
              leading: Avatar(e.name, size: 36),
              title: Text(e.name, style: T.bodyStrong),
              subtitle: Text('Roll #${e.roll}', style: T.small),
              trailing: _studentId == e.id ? Icon(Icons.check_circle_rounded, color: C.primary, size: 22.r) : null,
              onTap: () => setState(() {
                _studentId = e.id;
                _changing = false;
              }),
            ),
          if (matches.isEmpty) Text('No students found', style: T.body),
          if (_submitted && _studentId == null) _error('Select a recipient'),
        ],
        LessonHeading('2. Certificate Content', icon: Icons.workspace_premium_outlined),
        AppTextField(label: 'CERTIFICATE TITLE / AWARD NAME', controller: _title, hint: 'e.g. Junior Mathematics Olympiad — 1st Place', onChanged: (_) => setState(() {})),
        if (_submitted && _title.text.trim().isEmpty) _error('Enter the award title'),
        Wrap(spacing: 8.w, runSpacing: 8.h, children: [
          for (final p in _presets)
            ActionChip(
              label: Text(p, style: T.smallStrong),
              backgroundColor: const Color(0xFFF1F5F9), side: const BorderSide(color: C.border),
              onPressed: () => setState(() => _title.text = p),
            ),
        ]),
        SizedBox(height: 14.h),
        AppTextField(
          label: 'CITATION / SUBTITLE TEXT  (${_citation.text.length} / 240)', controller: _citation, maxLines: 4, maxLength: 240, hint: 'In recognition of…',
          onChanged: (_) => setState(() {}),
        ),
        if (_submitted && _citation.text.trim().length < 10) _error('Citation needs at least 10 characters'),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: AppTextField(label: 'DATE OF ISSUE', readOnly: true, controller: _dateCtl, suffix: Icon(Icons.calendar_today_outlined, size: 18.r))),
          SizedBox(width: 10.w),
          Expanded(child: AppTextField(label: 'AUTHORITY / EVENT', controller: _authority)),
        ]),
        LessonHeading('3. Choose Certificate Template', icon: Icons.style_outlined,
            trailing: tpls.isEmpty ? null : '${tpls.indexWhere((t) => t.id == picked) + 1} of ${tpls.length}'),
        SizedBox(
          height: 150.h,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: tpls.length > 4 ? 4 : tpls.length,
            separatorBuilder: (_, _) => SizedBox(width: 10.w),
            itemBuilder: (_, i) => _TplChoice(tpls[i], selected: picked == tpls[i].id, name: stu?.name ?? '', onTap: () => setState(() => _tplId = tpls[i].id)),
          ),
        ),
        SizedBox(height: 10.h),
        AppButton('Browse All ${tpls.length} Templates', kind: BtnKind.outline, onPressed: () async {
          final r = await context.push<String>(RoutePaths.certificateTemplates, extra: picked);
          if (r != null && mounted) setState(() => _tplId = r);
        }),
        LessonHeading('4. Verification & Security', icon: Icons.verified_user_outlined),
        AppSwitchTile(title: 'Teacher Digital Signature', subtitle: '${me?.name ?? 'Teacher'} • ${me?.designation ?? ''}', value: _sign, onChanged: (v) => setState(() => _sign = v)),
        AppSwitchTile(title: 'Affix Official School Seal', subtitle: 'Adds the school seal to the certificate', value: _seal, onChanged: (v) => setState(() => _seal = v)),
        AppSwitchTile(title: 'Principal Cryptographic Watermark', subtitle: 'Tamper-evident verification layer', value: _mark, onChanged: (v) => setState(() => _mark = v)),
      ]),
    );
  }
}

class _TplChoice extends StatelessWidget {
  const _TplChoice(this.t, {required this.selected, required this.name, required this.onTap});
  final CertTemplate t;
  final bool selected;
  final String name;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true, selected: selected, label: t.name,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: 140.w, padding: EdgeInsets.all(6.r),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(R.md), color: selected ? C.primarySoft : C.bg,
              border: Border.all(color: selected ? C.primary : C.border, width: selected ? 2 : 1),
            ),
            child: Column(children: [
              Expanded(child: FittedBox(child: SizedBox(width: 120.w, child: TemplateThumb(t, name: name)))),
              SizedBox(height: 4.h),
              Text(t.name, style: T.smallStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
        ),
      );
}
