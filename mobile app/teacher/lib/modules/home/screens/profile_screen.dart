import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
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
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<ProfileBloc>()..add(const ProfileLoadRequested()),
        child: const _ProfileView(),
      );
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
        IconButton(tooltip: 'Edit account', icon: Icon(Icons.edit_outlined, color: C.slate, size: 22.r), onPressed: () => showEditAccountSheet(context)),
        const TeacherHeaderActions(avatar: false),
      ],
      body: ListView(padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 40.h), children: [
        PanelCard(
          padding: EdgeInsets.all(18.r),
          child: Column(children: [
            Avatar(name, size: 84, online: true), SizedBox(height: 10.h),
            const Pill('Active • On Duty', tone: Tone.success, dot: true), SizedBox(height: 10.h),
            Text(name, style: T.title, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
            SizedBox(height: 4.h),
            Text(role, textAlign: TextAlign.center, style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.5.sp)),
            SizedBox(height: 4.h),
            Text('${me?.empId ?? ''} • ${me?.school ?? ''}', textAlign: TextAlign.center, style: T.small),
            SizedBox(height: 16.h),
            Row(children: [
              Expanded(child: AppButton('Digital Faculty ID', icon: Icons.qr_code_2_rounded, onPressed: () => context.push(RoutePaths.facultyId))),
              SizedBox(width: 10.w),
              SizedBox(
                width: 52.r, height: 52.r,
                child: IconButton.outlined(
                  tooltip: 'Share profile', onPressed: () => _copy(context, '$name • ${me?.empId ?? ''}', 'Profile link'),
                  icon: Icon(Icons.share_outlined, color: C.primary, size: 22.r),
                ),
              ),
            ]),
          ]),
        ),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.xl, padding: EdgeInsets.symmetric(vertical: 14.h),
          child: IntrinsicHeight(
            child: Row(children: [
              _Stat('$students', 'Students'), const VerticalDivider(width: 1, color: C.border),
              _Stat('${classes.length}', 'Classes'), const VerticalDivider(width: 1, color: C.border),
              _Stat('${prof.experience} Yrs', 'Exp'), const VerticalDivider(width: 1, color: C.border),
              _Stat('${prof.attendancePct}%', 'Attendance', color: C.successDark),
            ]),
          ),
        ),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.xl,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.workspace_premium_outlined, size: 18.r, color: C.primary), SizedBox(width: 8.w),
              Expanded(child: Text('QUALIFICATIONS', style: T.smallStrong.copyWith(letterSpacing: .6))),
              const Pill('Verified', tone: Tone.success, icon: Icons.verified_outlined),
            ]),
            SizedBox(height: 12.h),
            Wrap(spacing: 8.w, runSpacing: 8.h, children: [for (final q in prof.qualifications) _QualChip(q)]),
          ]),
        ),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.xl,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.alternate_email_rounded, size: 18.r, color: C.primary), SizedBox(width: 8.w),
              Expanded(child: Text('CONTACT & LOCATION', style: T.smallStrong.copyWith(letterSpacing: .6))),
            ]),
            SizedBox(height: 12.h),
            AppInfoTile(icon: Icons.mail_outline_rounded, label: 'EMAIL', value: me?.email ?? '', onCopy: () => _copy(context, me?.email ?? '', 'Email')),
            SizedBox(height: 8.h),
            AppInfoTile(icon: Icons.phone_outlined, label: 'DIRECT MOBILE', value: me?.phone ?? '', onCopy: () => _copy(context, me?.phone ?? '', 'Phone number')),
            SizedBox(height: 8.h),
            AppInfoTile(icon: Icons.location_on_outlined, label: 'FACULTY DESK', value: prof.desk),
          ]),
        ),
        const SectionHeader('Faculty workspace', caps: true),
        _Link(Icons.workspace_premium_outlined, 'My Certificates & Credentials', () => context.push(RoutePaths.certificatesMine)),
        _Link(Icons.calendar_month_outlined, 'Timetable & Workload', () => context.go(RoutePaths.timetable)),
        _Link(Icons.settings_outlined, 'Notification & Account Settings', () => context.push(RoutePaths.settings)),
        const SignOutTile(),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.v, this.l, {this.color});
  final String v, l;
  final Color? color;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(children: [
          FittedBox(fit: BoxFit.scaleDown, child: Text(v, style: T.h2.copyWith(color: color ?? C.ink, fontWeight: FontWeight.w800))),
          SizedBox(height: 2.h),
          Text(l, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
      );
}

class _QualChip extends StatelessWidget {
  const _QualChip(this.q);
  final Qualification q;
  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
        decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Flexible(child: Text(q.title, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)), SizedBox(width: 6.w),
          if (q.tone == 'warning') Pill(q.note, tone: Tone.warning) else Text(q.note.startsWith('#') ? q.note : '• ${q.note}', style: T.small),
        ]),
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
          radius: R.lg, padding: EdgeInsets.all(14.r), onTap: onTap,
          child: Row(children: [
            IconTile(icon, size: 38), SizedBox(width: 12.w),
            Expanded(child: Text(label, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
            Icon(Icons.chevron_right_rounded, color: C.muted, size: 22.r),
          ]),
        ),
      );
}
