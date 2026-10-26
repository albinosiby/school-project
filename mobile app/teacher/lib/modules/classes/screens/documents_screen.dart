import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/bloc/school_states.dart';
import '../../school/models/school_models.dart';
import '../bloc/documents_bloc.dart';
import '../bloc/documents_events.dart';
import '../bloc/documents_states.dart';
import '../models/classes_models.dart';
import '../models/student_metrics.dart';
import 'widgets/classes_ui.dart';

const _groups = ['Term 2 Submissions', 'KYC & Board Records', 'Lab Reports & Projects'];
const _kyc = 'KYC & Board Records';
const _docOptions = <(String, String)>[
  ('Aadhaar Card Copy', 'Front & back color scan • UIDAI'),
  ('Birth Certificate', 'Self-attested copy'),
  ('Medical Fitness Certificate', 'Issued within last 6 months'),
  ('Previous Marksheet', 'Last term report card'),
  ('Transfer Certificate', 'From previous school'),
];

/// Figma 1153:13657 "3.4.12 Documents" (+ 1153:13271 Request Document sheet).
class DocumentsScreen extends StatelessWidget {
  const DocumentsScreen({super.key, required this.studentId});
  final String studentId;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<DocumentsBloc>()..add(DocumentsLoadRequested(studentId)),
        child: BlocListener<DocumentsBloc, DocumentsState>(
          listenWhen: (a, b) => a.noticeSeq != b.noticeSeq,
          listener: (ctx, s) => showNotice(ctx, s.notice),
          child: _DocumentsView(studentId: studentId),
        ),
      );
}

class _DocumentsView extends StatefulWidget {
  const _DocumentsView({required this.studentId});
  final String studentId;
  @override
  State<_DocumentsView> createState() => _DocumentsViewState();
}

class _DocumentsViewState extends State<_DocumentsView> {
  String _group = 'All Documents';

  Future<void> _request(Student st, SchoolClass? cls) => showAppSheet(
        context, title: 'Request Document', subtitle: '${st.name} • Class ${cls == null ? '' : clsName(cls)} · ${rollTag(st)}',
        builder: (ctx) => _RequestForm(student: st, onSend: (r) => context.read<DocumentsBloc>().add(DocumentRequested(r))),
      );

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final ds = context.watch<DocumentsBloc>().state;
    final st = school.students.where((s) => s.id == widget.studentId).firstOrNull;
    if (st == null) {
      return DetailScaffold(
        title: 'STUDENT DOCUMENTS', fallbackRoute: RoutePaths.students,
        body: school.status == SchoolStatus.loaded ? const AppEmptyState('Student not found', icon: Icons.person_off_outlined) : const Center(child: CircularProgressIndicator()),
      );
    }
    final docs = ds.documents;
    final shown = _group == 'All Documents' ? docs : docs.where((d) => d.group == _group).toList();
    final assignments = ds.count('Term 2 Submissions') + ds.count('Lab Reports & Projects');
    final labels = ['All Documents (${docs.length})', for (final g in _groups) '$g (${ds.count(g)})'];
    final keys = ['All Documents', ..._groups];

    return DetailScaffold(
      title: 'STUDENT DOCUMENTS', fallbackRoute: RoutePaths.student(st.id),
      actions: [IconAction(Icons.share_outlined, 'Share vault', () => showNotice(context, 'Vault link copied'))],
      bottom: AppButton('Request Document', icon: Icons.note_add_outlined, onPressed: () => _request(st, school.classById(st.classId))),
      body: ListView(padding: EdgeInsets.fromLTRB(16.w, 14.h, 16.w, 30.h), children: [
        FilterChips(items: labels, value: labels[keys.indexOf(_group)], onChanged: (v) => setState(() => _group = keys[labels.indexOf(v)])),
        SizedBox(height: 14.h),
        PanelCard(
          padding: EdgeInsets.all(14.w),
          child: Column(children: [
            Row(children: [
              const IconTile(Icons.folder_special_outlined, size: 44),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('STUDENT VAULT', style: T.caps),
                  Text('${docs.length} Documents • ${(docs.length * 1.9).toStringAsFixed(1)} MB Stored', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                ]),
              ),
              const Pill('Sync OK', tone: Tone.success, dot: true),
            ]),
            SizedBox(height: 12.h),
            Row(children: [
              Expanded(child: AppStatBox(label: 'Assignments', value: '$assignments', centered: true, icon: Icons.task_alt_rounded)),
              SizedBox(width: 8.w),
              Expanded(child: AppStatBox(label: 'KYC & Official', value: '${ds.count(_kyc)}', centered: true, icon: Icons.verified_user_outlined)),
              SizedBox(width: 8.w),
              Expanded(child: AppStatBox(label: 'Pending Due', value: '${ds.requests.length}', valueColor: C.danger, centered: true, icon: Icons.pending_actions_rounded)),
            ]),
          ]),
        ),
        if (ds.requests.isNotEmpty) ...[
          const SectionHeader('Pending requests', caps: true),
          for (final r in ds.requests) _RequestCard(r),
        ],
        if (ds.status == DocumentsStatus.loaded && shown.isEmpty)
          const AppEmptyState('No documents yet', hint: 'Use Request Document to ask the guardians for one.', icon: Icons.folder_open_outlined),
        for (final g in _groups)
          if (shown.any((d) => d.group == g)) ...[
            Padding(
              padding: EdgeInsets.fromLTRB(2.w, 20.h, 2.w, 10.h),
              child: Row(children: [
                Container(width: 8.r, height: 8.r, decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle)),
                SizedBox(width: 8.w),
                Expanded(child: Text(g == _kyc ? 'Official KYC & School Records' : g, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
                Pill('${shown.where((d) => d.group == g).length} ${g == _kyc ? 'Verified' : 'Recent'}'),
              ]),
            ),
            for (final d in shown.where((d) => d.group == g)) _DocCard(d),
          ],
      ]),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard(this.r);
  final DocumentRequest r;
  @override
  Widget build(BuildContext context) {
    final bloc = context.read<DocumentsBloc>();
    final due = DateTime.tryParse(r.due);
    return AppCard(
      margin: EdgeInsets.only(bottom: 8.h), radius: R.lg, color: C.warningSoft, border: C.warning.withValues(alpha: .4), padding: EdgeInsets.fromLTRB(12.w, 8.h, 4.w, 8.h),
      child: Row(children: [
        Icon(Icons.hourglass_top_rounded, color: C.warningDark, size: 22.r),
        SizedBox(width: 10.w),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(r.doc, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
            Text('Due ${due == null ? r.due : DateFormat('dd MMM yyyy').format(due)} • ${r.priority}', style: T.small),
          ]),
        ),
        IconAction(Icons.check_circle_outline_rounded, 'Mark received', () => bloc.add(DocumentRequestReceived(r)), color: C.successDark),
        IconAction(Icons.close_rounded, 'Cancel request', () => bloc.add(DocumentRequestCancelled(r.id)), color: C.danger),
      ]),
    );
  }
}

class _DocCard extends StatelessWidget {
  const _DocCard(this.d);
  final StudentDocument d;
  @override
  Widget build(BuildContext context) {
    final kyc = d.group == _kyc;
    void open() => showNotice(context, 'Opening ${d.title}');
    return AppCard(
      margin: EdgeInsets.only(bottom: 10.h), radius: R.lg, padding: EdgeInsets.all(12.w),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          IconTile(kyc ? Icons.badge_outlined : Icons.picture_as_pdf_rounded, tone: kyc ? Tone.brand : Tone.danger, size: 42),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(d.title, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                if (kyc && d.tag.isNotEmpty) ...[SizedBox(width: 6.w), Flexible(child: Pill(d.tag))],
              ]),
              Text(d.meta, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
          if (!kyc && d.tag.isNotEmpty) ...[SizedBox(width: 6.w), Pill(d.tag, tone: Tone.success)],
          if (kyc) ...[
            IconAction(Icons.visibility_outlined, 'View ${d.title}', open),
            IconAction(Icons.download_rounded, 'Download ${d.title}', () => showNotice(context, 'Download started')),
          ],
        ]),
        if (!kyc) ...[
          Divider(height: 18.h, color: C.border),
          Align(
            alignment: Alignment.centerRight,
            child: AppButton('View PDF', icon: Icons.visibility_outlined, kind: BtnKind.soft, small: true, expand: false, onPressed: open),
          ),
        ],
      ]),
    );
  }
}

class _RequestForm extends StatefulWidget {
  const _RequestForm({required this.student, required this.onSend});
  final Student student;
  final ValueChanged<DocumentRequest> onSend;
  @override
  State<_RequestForm> createState() => _RequestFormState();
}

class _RequestFormState extends State<_RequestForm> {
  String _doc = _docOptions.first.$1;
  String _priority = 'Normal';
  bool _notify = true;
  DateTime _due = DateTime.now().add(const Duration(days: 7));
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(context: context, initialDate: _due, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
    if (d != null) setState(() => _due = d);
  }

  void _send() {
    widget.onSend(DocumentRequest(
      studentId: widget.student.id, doc: _doc, due: DateFormat('yyyy-MM-dd').format(_due), priority: _priority, note: _note.text.trim(), notify: _notify,
      createdAt: DateTime.now().toIso8601String(),
    ));
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final sub = _docOptions.firstWhere((e) => e.$1 == _doc).$2;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      AppDropdown<String>(label: 'DOCUMENT *', value: _doc, items: [for (final e in _docOptions) e.$1], onChanged: (v) => setState(() => _doc = v)),
      Transform.translate(offset: Offset(0, -8.h), child: Text(sub, style: T.small)),
      Text('DUE DATE *', style: T.smallStrong.copyWith(color: C.slate)),
      SizedBox(height: 6.h),
      AppPickTile(icon: Icons.calendar_today_rounded, plainIcon: true, label: DateFormat('dd MMM yyyy').format(_due), onTap: _pickDate),
      SizedBox(height: 14.h),
      Text('PRIORITY', style: T.smallStrong.copyWith(color: C.slate)),
      SizedBox(height: 6.h),
      AppSegmented(items: const ['Normal', 'Urgent'], value: _priority, onChanged: (v) => setState(() => _priority = v)),
      SizedBox(height: 14.h),
      AppTextField(label: 'NOTE TO PARENT / STUDENT (Optional)', controller: _note, maxLines: 3, hint: 'Add a short instruction...'),
      AppToggleRow(title: 'Notify via WhatsApp & SMS', subtitle: 'Direct upload link sent to registered guardians', value: _notify, onChanged: (v) => setState(() => _notify = v)),
      SizedBox(height: 16.h),
      Row(children: [
        Expanded(child: AppButton('Cancel', kind: BtnKind.outline, onPressed: () => Navigator.pop(context))),
        SizedBox(width: 10.w),
        Expanded(flex: 2, child: AppButton('Send Request', icon: Icons.send_rounded, onPressed: _send)),
      ]),
    ]);
  }
}
