import 'package:school_sync/school_sync.dart';
import '../../../config/app_config.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../auth/screens/widgets/sign_out_tile.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/profile_bloc.dart';
import '../bloc/profile_events.dart';
import '../models/home_models.dart';
import 'widgets/edit_account_sheet.dart';
import 'widgets/teacher_tab_header.dart';

/// Teacher profile (Figma 1153:1919 "7. Profile"), route RoutePaths.profile.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      BlocProvider(create: (_) => getIt<ProfileBloc>()..add(const ProfileLoadRequested()), child: const _ProfileView());
}

class _ProfileView extends StatelessWidget {
  const _ProfileView();

  void _copy(BuildContext context, String v, String what) {
    Clipboard.setData(ClipboardData(text: v));
    AppDialogs.showSnackBar(context, message: '$what copied');
  }

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final prof = context.watch<ProfileBloc>().state.profile;
    final me = school.teacher;
    final classes = school.classes;
    final students = classes.fold<int>(0, (a, c) => a + c.students);
    final incharge = classes.where((c) => c.classTeacher).firstOrNull;
    final name = me?.name ?? 'Teacher';
    final role = [
      if ((me?.designation ?? '').isNotEmpty) me!.designation,
      if ((me?.subjects ?? '').isNotEmpty) me!.subjects,
      if (incharge != null) 'Class ${incharge.label} In-charge',
    ].join(' • ');
    return DetailScaffold(
      title: 'Profile',
      actions: [
        IconButton(
          tooltip: 'Edit account',
          icon: Icon(Icons.edit_outlined, color: C.slate, size: 22.r),
          onPressed: () => showEditAccountSheet(context),
        ),
        const TeacherHeaderActions(avatar: false),
      ],
      body: ListView(
        padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 40.h),
        children: [
          PanelCard(
            padding: EdgeInsets.all(18.r),
            child: Column(
              children: [
                Avatar(name, size: 84, online: true, image: (me?.photo ?? '').isEmpty ? null : me!.photo),
                SizedBox(height: 10.h),
                Pill((me?.status ?? '').isEmpty ? 'Active' : me!.status, tone: (me?.status ?? 'Active') == 'Active' ? Tone.success : Tone.neutral, dot: true),
                SizedBox(height: 10.h),
                Text(name, style: T.title, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
                SizedBox(height: 4.h),
                Text(
                  role,
                  textAlign: TextAlign.center,
                  style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.5.sp),
                ),
                SizedBox(height: 4.h),
                Text('${me?.empId ?? ''} • ${me?.school ?? ''}', textAlign: TextAlign.center, style: T.small),
                SizedBox(height: 16.h),
                Row(
                  children: [
                    Expanded(
                      child: AppButton(
                        'Digital Faculty ID',
                        icon: Icons.qr_code_2_rounded,
                        onPressed: () => context.push(RoutePaths.facultyId),
                      ),
                    ),
                    SizedBox(width: 10.w),
                    SizedBox(
                      width: 52.r,
                      height: 52.r,
                      child: IconButton.outlined(
                        tooltip: 'Share profile',
                        onPressed: () => _copy(context, '$name • ${me?.empId ?? ''}', 'Profile link'),
                        icon: Icon(Icons.share_outlined, color: C.primary, size: 22.r),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          SizedBox(height: 14.h),
          AppCard(
            radius: R.xl,
            padding: EdgeInsets.symmetric(vertical: 14.h),
            child: IntrinsicHeight(
              child: Row(
                children: [
                  _Stat('$students', 'Students'),
                  const VerticalDivider(width: 1, color: C.border),
                  _Stat('${classes.length}', 'Classes'),
                  const VerticalDivider(width: 1, color: C.border),
                  _Stat('${prof.experience} Yrs', 'Exp'),
                  const VerticalDivider(width: 1, color: C.border),
                  _Stat((me?.joined ?? '').length >= 4 ? me!.joined.substring(0, 4) : '—', 'Joined', color: C.successDark),
                ],
              ),
            ),
          ),
          SizedBox(height: 14.h),
          AppCard(
            radius: R.xl,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.alternate_email_rounded, size: 18.r, color: C.primary),
                    SizedBox(width: 8.w),
                    Expanded(child: Text('CONTACT & LOCATION', style: T.smallStrong.copyWith(letterSpacing: .6))),
                  ],
                ),
                SizedBox(height: 12.h),
                AppInfoTile(
                  icon: Icons.mail_outline_rounded,
                  label: 'EMAIL',
                  value: me?.email ?? '',
                  onCopy: () => _copy(context, me?.email ?? '', 'Email'),
                ),
                SizedBox(height: 8.h),
                AppInfoTile(
                  icon: Icons.phone_outlined,
                  label: 'DIRECT MOBILE',
                  value: me?.phone ?? '',
                  onCopy: () => _copy(context, me?.phone ?? '', 'Phone number'),
                ),
                SizedBox(height: 8.h),
                if (prof.desk.isNotEmpty) AppInfoTile(icon: Icons.location_on_outlined, label: 'FACULTY DESK', value: prof.desk),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(2.w, 20.h, 2.w, 10.h),
            child: Row(
              children: [
                Expanded(child: Text('STAFF PROFILE', style: T.capsMuted, maxLines: 1, overflow: TextOverflow.ellipsis)),
                Pill(prof.hasHrCard ? 'From HR records' : 'Not shared yet', tone: prof.hasHrCard ? Tone.neutral : Tone.warning),
              ],
            ),
          ),
          if (!prof.hasHrCard)
            Padding(
              padding: EdgeInsets.only(bottom: 10.h),
              child: Text(
                'Your HR profile appears here once the office saves it. Sign out and in again if it was saved recently.',
                style: T.small,
              ),
            ),
          for (final section in prof.sections)
            _SectionCard(title: section.title, icon: _sectionIcon(section.key), initiallyOpen: section.key == 'basic', child: _SectionBody(section)),
          _SectionCard(
            title: 'Staff documents',
            icon: Icons.folder_copy_outlined,
            badge: prof.documents.isEmpty ? null : '${prof.documents.length}',
            child: prof.documents.isEmpty
                ? const _NotOnFile('No documents uploaded')
                : Column(children: [for (final d in prof.documents) _DocumentRow(d)]),
          ),
          _SectionCard(
            title: 'Payroll bank details',
            icon: Icons.account_balance_outlined,
            child: prof.bank.isEmpty ? const _NotOnFile('No payroll bank details saved') : _FieldList(prof.bank),
          ),
          _SectionCard(
            title: 'Payroll history',
            icon: Icons.receipt_long_outlined,
            badge: prof.payments.isEmpty ? null : '${prof.payments.length}',
            child: prof.payments.isEmpty
                ? const _NotOnFile('No payroll payments recorded')
                : Column(children: [for (final p in prof.payments) _PaymentRow(p)]),
          ),
          const SectionHeader('Faculty workspace', caps: true),
          _Link(Icons.workspace_premium_outlined, 'My Certificates & Credentials', () => context.push(RoutePaths.certificatesMine)),
          _Link(Icons.calendar_month_outlined, 'Timetable & Workload', () => context.go(RoutePaths.timetable)),
          _Link(Icons.settings_outlined, 'Notification & Account Settings', () => context.push(RoutePaths.settings)),
          if (AppConfig.isFirebase)
            ListTile(
              leading: const Icon(Icons.workspace_premium_outlined),
              title: const Text('My school certificates'),
              onTap: () => context.push(RoutePaths.myCertificates),
            ),
          const AppVersionRow(),
          const SignOutTile(),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.v, this.l, {this.color});
  final String v, l;
  final Color? color;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            v,
            style: T.h2.copyWith(color: color ?? C.ink, fontWeight: FontWeight.w800),
          ),
        ),
        SizedBox(height: 2.h),
        Text(l, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
      ],
    ),
  );
}

class _Link extends StatelessWidget {
  const _Link(this.icon, this.label, this.onTap);
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 8.h),
    child: AppCard(
      radius: R.lg,
      padding: EdgeInsets.all(14.r),
      onTap: onTap,
      child: Row(
        children: [
          IconTile(icon, size: 38),
          SizedBox(width: 12.w),
          Expanded(
            child: Text(label, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
          Icon(Icons.chevron_right_rounded, color: C.muted, size: 22.r),
        ],
      ),
    ),
  );
}

IconData _sectionIcon(String key) => switch (key) {
  'basic' => Icons.badge_outlined,
  'address_current' || 'address_permanent' => Icons.home_outlined,
  'emergency' => Icons.emergency_outlined,
  'employment' => Icons.work_outline_rounded,
  'teaching' => Icons.menu_book_outlined,
  'qualifications' => Icons.workspace_premium_outlined,
  _ => Icons.info_outline_rounded,
};

String _rupees(double v) => '₹${NumberFormat('#,##0.00').format(v)}';
String _month(String yyyyMm) {
  final d = DateTime.tryParse('$yyyyMm-01');
  return d == null ? yyyyMm : DateFormat('MMM yyyy').format(d);
}

/// One collapsible card of the office's staff profile.
class _SectionCard extends StatefulWidget {
  const _SectionCard({required this.title, required this.icon, required this.child, this.badge, this.initiallyOpen = false});
  final String title;
  final IconData icon;
  final Widget child;
  final String? badge;
  final bool initiallyOpen;
  @override
  State<_SectionCard> createState() => _SectionCardState();
}

class _SectionCardState extends State<_SectionCard> {
  late bool _open = widget.initiallyOpen;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 10.h),
    child: AppCard(
      radius: R.xl,
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(R.xl),
            onTap: () => setState(() => _open = !_open),
            child: Padding(
              padding: EdgeInsets.fromLTRB(14.w, 12.h, 10.w, 12.h),
              child: Row(
                children: [
                  IconTile(widget.icon, size: 36),
                  SizedBox(width: 10.w),
                  Expanded(child: Text(widget.title, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  if (widget.badge != null) ...[Pill(widget.badge!, tone: Tone.brand), SizedBox(width: 4.w)],
                  Icon(_open ? Icons.expand_less_rounded : Icons.expand_more_rounded, color: C.muted, size: 24.r),
                ],
              ),
            ),
          ),
          if (_open) ...[
            const Divider(height: 1, color: C.border),
            Padding(padding: EdgeInsets.fromLTRB(14.w, 10.h, 14.w, 12.h), child: widget.child),
          ],
        ],
      ),
    ),
  );
}

class _SectionBody extends StatelessWidget {
  const _SectionBody(this.section);
  final ProfileSection section;
  @override
  Widget build(BuildContext context) {
    if (section.isEmpty) return const _NotOnFile('Nothing on file');
    if (section.note.isNotEmpty && section.groups.isEmpty) return _NotOnFile(section.note);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < section.groups.length; i++) ...[
          if (section.groups.length > 1) ...[
            if (i > 0) SizedBox(height: 10.h),
            Text('${section.title.replaceFirst(RegExp(r's$'), '')} ${i + 1}'.toUpperCase(), style: T.capsMuted.copyWith(color: C.primary)),
            SizedBox(height: 4.h),
          ],
          _FieldList(section.groups[i]),
        ],
      ],
    );
  }
}

class _FieldList extends StatelessWidget {
  const _FieldList(this.fields);
  final List<ProfileField> fields;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (var i = 0; i < fields.length; i++) ...[
        if (i > 0) const Divider(height: 1, color: C.border),
        Padding(
          padding: EdgeInsets.symmetric(vertical: 8.h),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 128.w, child: Text(fields[i].label, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis)),
              SizedBox(width: 8.w),
              Expanded(child: Text(fields[i].value, style: T.bodyStrong.copyWith(fontSize: 13.5.sp))),
            ],
          ),
        ),
      ],
    ],
  );
}

class _NotOnFile extends StatelessWidget {
  const _NotOnFile(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: 6.h),
    child: Text(text, style: T.small.copyWith(fontStyle: FontStyle.italic)),
  );
}

class _DocumentRow extends StatelessWidget {
  const _DocumentRow(this.doc);
  final StaffDocumentRow doc;
  @override
  Widget build(BuildContext context) {
    final pdf = doc.name.toLowerCase().endsWith('.pdf');
    final uploaded = doc.uploadedAt.length >= 10 ? fmtDate(doc.uploadedAt.substring(0, 10), year: true) : doc.uploadedAt;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 7.h),
      child: Row(
        children: [
          Icon(pdf ? Icons.picture_as_pdf_outlined : Icons.image_outlined, size: 22.r, color: C.slate),
          SizedBox(width: 10.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(doc.label, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                Text('${doc.name} • $uploaded', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          const Pill('Uploaded', tone: Tone.success),
        ],
      ),
    );
  }
}

class _PaymentRow extends StatelessWidget {
  const _PaymentRow(this.p);
  final PayrollPayment p;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: 7.h),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_month(p.month), style: T.bodyStrong),
              Text(
                [
                  if (p.paidOn.isNotEmpty) 'Paid ${fmtDate(p.paidOn, year: true)}',
                  'Gross ${_rupees(p.gross)}',
                  if (p.deductions > 0) 'Deductions ${_rupees(p.deductions)}',
                  if (p.reference.isNotEmpty) 'Ref ${p.reference}',
                ].join(' • '),
                style: T.small,
              ),
            ],
          ),
        ),
        SizedBox(width: 8.w),
        Text(_rupees(p.net), style: T.bodyStrong.copyWith(color: C.successDark)),
      ],
    ),
  );
}
