import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../family/bloc/family_bloc.dart';
import '../../family/models/family_models.dart';
import '../../teachers/screens/widgets/contact_actions.dart';
import '../bloc/student_profile_bloc.dart';
import '../models/student_models.dart';

/// Figma 5.1 "Student Profile": identity, academic standing (linking to Academics), honours, personal and
/// medical details, transport, guardians, residence and documents of the selected child.
class StudentProfileScreen extends StatelessWidget {
  const StudentProfileScreen({super.key});

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Student Profile',
    subtitle: 'Identity, academics and records',
    fallbackRoute: RoutePaths.more,
    actions: const [HubHeaderActions()],
    body: ColoredBox(
      color: C.surface,
      child: ChildDataView<StudentProfileBloc, StudentProfile>(
        create: () => getIt<StudentProfileBloc>(),
        builder: (context, p, child) => _ProfileBody(p: p),
      ),
    ),
  );
}

class _ProfileBody extends StatelessWidget {
  const _ProfileBody({required this.p});
  final StudentProfile p;

  void _academics(BuildContext context, String section) =>
      context.go(RoutePaths.academicsSection(section));

  Future<void> _switchChild(BuildContext context) async {
    final family = context.read<FamilyBloc>();
    final picked = await showPickSheet<Child>(
      context,
      title: 'Switch profile',
      items: family.state.children,
      label: (c) => c.name,
      sub: (c) => 'Class ${c.className} • Roll #${c.rollNo}',
      selected: family.state.selected,
    );
    if (picked != null) family.add(SelectChild(picked.id));
  }

  void _dossier(BuildContext context) => AppDialogs.showSnackBar(
    context,
    message:
        '${p.child.name.replaceAll(' ', '_')}_Dossier_${p.academicYear}.pdf saved to Downloads (simulated)',
  );

  @override
  Widget build(BuildContext context) {
    final hasSiblings = context.select<FamilyBloc, bool>(
      (b) => b.state.children.length > 1,
    );
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 24.h),
            children: [
              Row(
                children: [
                  Container(
                    width: 7.r,
                    height: 7.r,
                    decoration: const BoxDecoration(
                      color: C.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                  SizedBox(width: 6.w),
                  Expanded(
                    child: Text(
                      'ACADEMIC YEAR ${p.academicYear}',
                      style: T.capsMuted.copyWith(color: C.onSurfaceVariant),
                    ),
                  ),
                  if (hasSiblings)
                    AppButton(
                      'Switch Profile',
                      icon: Icons.swap_horiz_rounded,
                      kind: BtnKind.soft,
                      small: true,
                      expand: false,
                      onPressed: () => _switchChild(context),
                    ),
                ],
              ),
              SizedBox(height: 12.h),
              _IdentityCard(p: p),
              SectionHeader(
                'Academic & Standing',
                icon: Icons.insights_rounded,
                action: p.evaluation,
                onAction: () => _academics(context, 'marks'),
              ),
              _AttendanceCard(
                p: p,
                onTap: () => _academics(context, 'attendance'),
              ),
              SizedBox(height: 12.h),
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: _StandingTile(
                        icon: Icons.military_tech_outlined,
                        tag: p.cgpaTag,
                        value: p.cgpa?.toStringAsFixed(1) ?? '--',
                        unit: '/10',
                        label: '${p.evaluation} CGPA',
                        progress: (p.cgpa ?? 0) / 10,
                        onTap: () => _academics(context, 'marks'),
                      ),
                    ),
                    SizedBox(width: 10.w),
                    Expanded(
                      child: _StandingTile(
                        icon: Icons.star_outline_rounded,
                        tag: p.meritTag,
                        value: '${p.meritPoints}',
                        unit: 'pts',
                        label: 'Merit Points & Honors',
                        footer: 'House Honors',
                        tone: Tone.success,
                        onTap: () => context.push(RoutePaths.behaviour),
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 12.h),
              Wrap(
                spacing: 8.w,
                runSpacing: 8.h,
                children: [
                  for (final (label, section, icon) in const [
                    ('Attendance', 'attendance', Icons.fact_check_outlined),
                    ('Homework', 'homework', Icons.menu_book_outlined),
                    ('Marks', 'marks', Icons.grading_rounded),
                    (
                      'Timetable',
                      'timetable',
                      Icons.calendar_view_week_outlined,
                    ),
                  ])
                    ActionChip(
                      avatar: Icon(icon, size: 16.r, color: C.primary),
                      label: Text(
                        label,
                        style: T.smallStrong.copyWith(color: C.primary),
                      ),
                      backgroundColor: C.bg,
                      side: const BorderSide(color: C.panelBorder),
                      onPressed: () => _academics(context, section),
                    ),
                ],
              ),
              _HonorsSection(p: p),
              _PersonalSection(p: p),
              _MedicalSection(p: p),
              _TransportSection(p: p),
              _GuardiansSection(p: p),
              _DocumentsSection(p: p),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: EdgeInsets.fromLTRB(16.w, 10.h, 16.w, 12.h),
            decoration: const BoxDecoration(
              color: C.bg,
              border: Border(top: BorderSide(color: C.border)),
            ),
            child: AppButton(
              'Download Full Student Dossier (PDF)',
              icon: Icons.download_rounded,
              onPressed: () => _dossier(context),
            ),
          ),
        ),
      ],
    );
  }
}

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.p});
  final StudentProfile p;

  @override
  Widget build(BuildContext context) => AppSurfaceCard(
    hero: true,
    padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 20.h),
    child: Column(
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              padding: EdgeInsets.all(4.r),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(colors: [C.primary, C.primaryDark]),
              ),
              child: Avatar(p.child.name, size: 100),
            ),
            Positioned(
              right: 2.r,
              bottom: 6.r,
              child: Container(
                width: 28.r,
                height: 28.r,
                decoration: BoxDecoration(
                  color: C.bg,
                  shape: BoxShape.circle,
                  border: Border.all(color: C.border),
                ),
                child: Icon(
                  Icons.workspace_premium_rounded,
                  size: 16.r,
                  color: C.primary,
                ),
              ),
            ),
          ],
        ),
        SizedBox(height: 12.h),
        Text(
          p.child.name,
          textAlign: TextAlign.center,
          style: T.title.copyWith(color: C.onSurface),
        ),
        SizedBox(height: 8.h),
        Container(
          padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
          decoration: BoxDecoration(
            color: C.surfaceLow,
            borderRadius: BorderRadius.circular(R.pill),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.school_outlined, size: 15.r, color: C.primary),
              SizedBox(width: 6.w),
              Text(
                'Class ${p.child.className} • Roll #${p.child.rollNo}',
                style: T.small.copyWith(color: C.onSurface),
              ),
            ],
          ),
        ),
        // house chip only when the school records a house
        if (p.house.isNotEmpty) ...[
          SizedBox(height: 6.h),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
            decoration: BoxDecoration(
              color: C.indigoSoft,
              borderRadius: BorderRadius.circular(R.pill),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.shield_outlined, size: 15.r, color: C.primaryDark),
                SizedBox(width: 6.w),
                Flexible(
                  child: Text(
                    p.houseRole.isEmpty
                        ? p.house
                        : '${p.house} • ${p.houseRole}',
                    overflow: TextOverflow.ellipsis,
                    style: T.smallStrong.copyWith(color: C.primaryDark),
                  ),
                ),
              ],
            ),
          ),
        ],
        SizedBox(height: 8.h),
        Text('Admission No. ${p.child.admissionNo}', style: T.small),
      ],
    ),
  );
}

class _AttendanceCard extends StatelessWidget {
  const _AttendanceCard({required this.p, required this.onTap});
  final StudentProfile p;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tone = p.attendancePercent >= 90
        ? Tone.success
        : p.attendancePercent >= 75
        ? Tone.warning
        : Tone.danger;
    Widget stat(String label, int value, {Color? color}) => Expanded(
      child: Column(
        children: [
          Text(label, style: T.small.copyWith(color: C.onSurface)),
          SizedBox(height: 2.h),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '$value ',
                  style: T.h3.copyWith(color: color ?? C.onSurface),
                ),
                TextSpan(text: 'days', style: T.small),
              ],
            ),
          ),
        ],
      ),
    );
    return AppSurfaceCard(
      onTap: onTap,
      semanticLabel:
          'Attendance ${p.attendancePercent.toStringAsFixed(1)} percent',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 7.r,
                          height: 7.r,
                          decoration: BoxDecoration(
                            color: toneColors(tone).fg,
                            shape: BoxShape.circle,
                          ),
                        ),
                        SizedBox(width: 6.w),
                        Text('ATTENDANCE STATUS', style: T.capsMuted),
                      ],
                    ),
                    SizedBox(height: 6.h),
                    Row(
                      children: [
                        Text(
                          '${p.attendancePercent.toStringAsFixed(1)}%',
                          key: const Key('profile-attendance'),
                          style: T.stat.copyWith(fontSize: 28.sp),
                        ),
                        SizedBox(width: 8.w),
                        Pill(p.attendanceLabel, tone: tone),
                      ],
                    ),
                  ],
                ),
              ),
              Tooltip(
                message: 'Open attendance',
                child: IconTile(Icons.event_available_rounded, size: 48),
              ),
            ],
          ),
          SizedBox(height: 12.h),
          AppProgress(p.attendancePercent / 100, tone: tone),
          Divider(height: 24.h, color: C.border),
          Row(
            children: [
              stat('Present', p.present),
              stat('Absent', p.absent, color: C.danger),
              stat('Working', p.workingDays),
            ],
          ),
        ],
      ),
    );
  }
}

class _StandingTile extends StatelessWidget {
  const _StandingTile({
    required this.icon,
    required this.tag,
    required this.value,
    required this.unit,
    required this.label,
    required this.onTap,
    this.progress,
    this.footer,
    this.tone = Tone.brand,
  });
  final IconData icon;
  final String tag, value, unit, label;
  final double? progress;
  final String? footer;
  final Tone tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => AppSurfaceCard(
    onTap: onTap,
    semanticLabel: '$label $value $unit',
    padding: EdgeInsets.all(12.w),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            IconTile(icon, size: 36, tone: tone),
            const Spacer(),
            Flexible(child: Pill(tag, tone: tone)),
          ],
        ),
        SizedBox(height: 12.h),
        Text.rich(
          TextSpan(
            children: [
              TextSpan(text: value, style: T.stat),
              TextSpan(text: ' $unit', style: T.small),
            ],
          ),
        ),
        Text(
          label,
          style: T.small.copyWith(color: C.onSurface),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        const Spacer(),
        SizedBox(height: 8.h),
        if (progress != null) AppProgress(progress!.clamp(0, 1).toDouble()),
        if (footer != null)
          Row(
            children: [
              Icon(Icons.verified_user_outlined, size: 14.r, color: C.teal),
              SizedBox(width: 4.w),
              Flexible(
                child: Text(
                  footer!,
                  style: T.smallStrong.copyWith(color: C.teal),
                ),
              ),
            ],
          ),
      ],
    ),
  );
}

IconData _honorIcon(HonorKind k) => switch (k) {
  HonorKind.academic => Icons.science_outlined,
  HonorKind.leadership => Icons.groups_2_outlined,
  HonorKind.olympiad => Icons.emoji_events_outlined,
  HonorKind.sports => Icons.directions_run_rounded,
  HonorKind.arts => Icons.palette_outlined,
};

class _HonorsSection extends StatelessWidget {
  const _HonorsSection({required this.p});
  final StudentProfile p;

  void _all(BuildContext context) => showAppSheet<void>(
    context,
    title: 'Badges & Honors',
    subtitle: '${p.honors.length} earned by ${p.child.firstName}',
    builder: (ctx) => Column(
      children: [
        for (final h in p.honors)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: IconTile(_honorIcon(h.kind), size: 40),
            title: Text(h.title, style: T.bodyStrong),
            subtitle: Text(
              '${h.subtitle} • ${fmtDate(h.awardedOn, year: true)}',
              style: T.small,
            ),
            trailing: Pill(h.tag, tone: Tone.purple),
          ),
        SizedBox(height: 8.h),
        AppButton(
          'View Certificates',
          kind: BtnKind.outline,
          icon: Icons.workspace_premium_outlined,
          onPressed: () {
            Navigator.pop(ctx);
            context.push(RoutePaths.certificates);
          },
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SectionHeader(
        'Earned Badges & Honors',
        icon: Icons.workspace_premium_outlined,
        action: 'View All',
        onAction: () => _all(context),
      ),
      Text('${p.honors.length} Badges Earned', style: T.small),
      SizedBox(height: 8.h),
      SizedBox(
        height: 132.h,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: p.honors.length,
          separatorBuilder: (_, _) => SizedBox(width: 10.w),
          itemBuilder: (_, i) {
            final h = p.honors[i];
            return SizedBox(
              width: 170.w,
              child: AppSurfaceCard(
                padding: EdgeInsets.all(12.w),
                onTap: () => _all(context),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        IconTile(
                          _honorIcon(h.kind),
                          size: 32,
                          tone: Tone.purple,
                        ),
                        SizedBox(width: 6.w),
                        Expanded(
                          child: Text(
                            h.tag,
                            style: T.small.copyWith(fontSize: 11.sp),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Text(
                      h.title,
                      style: T.smallStrong.copyWith(color: C.onSurface),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      h.subtitle,
                      style: T.small,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    ],
  );
}

/// Two-column grid of [AppInfoTile]s.
class _TileGrid extends StatelessWidget {
  const _TileGrid(this.tiles);
  final List<(IconData, String, String)> tiles;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var i = 0; i < tiles.length; i += 2)
        Padding(
          padding: EdgeInsets.only(bottom: 8.h),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var j = i; j < i + 2; j++) ...[
                  if (j > i) SizedBox(width: 8.w),
                  Expanded(
                    child: j < tiles.length
                        ? AppInfoTile(
                            compact: true,
                            icon: tiles[j].$1,
                            label: tiles[j].$2,
                            value: tiles[j].$3,
                          )
                        : const SizedBox.shrink(),
                  ),
                ],
              ],
            ),
          ),
        ),
    ],
  );
}

class _PersonalSection extends StatelessWidget {
  const _PersonalSection({required this.p});
  final StudentProfile p;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const SectionHeader('Personal Details', icon: Icons.badge_outlined),
      _TileGrid([
        (
          Icons.cake_outlined,
          'DATE OF BIRTH',
          '${fmtDate(p.dob, year: true)} (${p.ageAt(DateTime.now())} yrs)',
        ),
        (Icons.person_outline_rounded, 'GENDER', p.gender),
        (
          Icons.confirmation_number_outlined,
          'ADMISSION NO.',
          p.child.admissionNo,
        ),
        (
          Icons.event_outlined,
          'ADMITTED ON',
          fmtDate(p.admissionDate, year: true),
        ),
        (
          Icons.class_outlined,
          'CLASS & SECTION',
          '${p.child.grade} - ${p.child.section}',
        ),
        (Icons.co_present_outlined, 'CLASS TEACHER', p.child.classTeacher),
      ]),
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          onPressed: () => context.push(RoutePaths.teachers),
          icon: Icon(Icons.groups_outlined, size: 18.r),
          label: const Text('View all teachers'),
        ),
      ),
    ],
  );
}

class _MedicalSection extends StatelessWidget {
  const _MedicalSection({required this.p});
  final StudentProfile p;

  @override
  Widget build(BuildContext context) {
    final m = p.medical;
    final e = p.emergency;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(
          'Medical & Emergency',
          icon: Icons.medical_services_outlined,
        ),
        _TileGrid([
          (Icons.bloodtype_outlined, 'BLOOD GROUP', m.bloodGroup),
          (
            Icons.height_rounded,
            'HEIGHT / WEIGHT',
            '${m.heightCm} cm / ${m.weightKg} kg',
          ),
          (Icons.no_food_outlined, 'ALLERGIES', m.allergies),
          (Icons.monitor_heart_outlined, 'CONDITIONS', m.conditions),
          (Icons.medication_outlined, 'MEDICATION', m.medications),
          (
            Icons.event_note_outlined,
            'LAST CHECK-UP',
            fmtDate(m.lastCheckup, year: true),
          ),
        ]),
        AppSurfaceCard(
          margin: EdgeInsets.only(bottom: 8.h),
          padding: EdgeInsets.all(12.w),
          borderColor: C.dangerSoft,
          child: Row(
            children: [
              IconTile(Icons.emergency_outlined, size: 40, tone: Tone.danger),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'EMERGENCY CONTACT',
                      style: T.capsMuted.copyWith(color: C.danger),
                    ),
                    Text('${e.name} (${e.relation})', style: T.bodyStrong),
                    Text(e.phone, style: T.small),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Call ${e.name}',
                onPressed: () => simulateCall(context, e.name, e.phone),
                icon: Icon(Icons.call_rounded, color: C.danger, size: 22.r),
              ),
            ],
          ),
        ),
        AppSurfaceCard(
          padding: EdgeInsets.all(12.w),
          child: Row(
            children: [
              IconTile(Icons.local_hospital_outlined, size: 40),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('FAMILY DOCTOR', style: T.capsMuted),
                    Text(m.doctor, style: T.bodyStrong),
                    Text(m.doctorPhone, style: T.small),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Call ${m.doctor}',
                onPressed: () => simulateCall(context, m.doctor, m.doctorPhone),
                icon: Icon(Icons.call_rounded, color: C.primary, size: 22.r),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TransportSection extends StatelessWidget {
  const _TransportSection({required this.p});
  final StudentProfile p;

  @override
  Widget build(BuildContext context) {
    final t = p.transport;
    const header = SectionHeader(
      'School Bus & Transit Route',
      icon: Icons.directions_bus_outlined,
    );
    if (!t.onBus) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          header,
          AppSurfaceCard(
            key: const Key('profile-no-bus'),
            child: Row(
              children: [
                IconTile(Icons.directions_bus_outlined, size: 40),
                SizedBox(width: 10.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Not on a school bus', style: T.bodyStrong),
                      Text(
                        'Ask the school office if your child should have a bus stop.',
                        style: T.small,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        header,
        AppSurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        t.scheduleBased
                            ? const Pill(
                                'Schedule-based',
                                tone: Tone.neutral,
                                icon: Icons.schedule_rounded,
                              )
                            : const Pill(
                                'Live In Transit',
                                tone: Tone.success,
                                dot: true,
                              ),
                        SizedBox(height: 6.h),
                        Text(
                          '${t.busNo} (${t.route})'.toUpperCase(),
                          style: T.h3,
                        ),
                      ],
                    ),
                  ),
                  AppButton(
                    t.scheduleBased ? 'TRACK BUS' : 'LIVE GPS',
                    icon: Icons.my_location_rounded,
                    small: true,
                    expand: false,
                    onPressed: () => context.push(RoutePaths.trackLive),
                  ),
                ],
              ),
              SizedBox(height: 12.h),
              _TileGrid([
                (Icons.wb_sunny_outlined, 'MORNING PICKUP', t.pickup),
                (Icons.nights_stay_outlined, 'AFTERNOON DROP', t.drop),
              ]),
              AppInfoTile(
                icon: Icons.place_outlined,
                iconColor: C.primary,
                label: t.stopAddress.isEmpty
                    ? 'BUS STOP'
                    : t.stopName.toUpperCase(),
                value: t.stopAddress.isEmpty
                    ? (t.stopName.isEmpty ? 'Not set' : t.stopName)
                    : t.stopAddress,
              ),
              SizedBox(height: 10.h),
              Row(
                children: [
                  Avatar(t.driver, size: 40, tone: Tone.neutral),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${t.driver.isEmpty ? 'Not assigned' : t.driver} (Driver)',
                          style: T.bodyStrong,
                        ),
                        Text(
                          t.attendant.isEmpty
                              ? 'Supervisor: ${t.supervisorPhone.isEmpty ? 'not recorded' : t.supervisorPhone}'
                              : 'Attendant: ${t.attendant}${t.supervisorPhone.isEmpty ? '' : ' • ${t.supervisorPhone}'}',
                          style: T.small,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Call ${t.driver.isEmpty ? 'the driver' : t.driver}',
                    onPressed: () => simulateCall(
                      context,
                      t.driver.isEmpty ? 'the driver' : t.driver,
                      t.driverPhone,
                    ),
                    icon: Icon(
                      Icons.call_rounded,
                      color: C.primary,
                      size: 22.r,
                    ),
                  ),
                  if (t.supervisorPhone.isNotEmpty)
                    IconButton(
                      tooltip:
                          'Call ${t.attendant.isEmpty ? 'the bus supervisor' : t.attendant}',
                      onPressed: () => simulateCall(
                        context,
                        t.attendant.isEmpty ? 'the bus supervisor' : t.attendant,
                        t.supervisorPhone,
                      ),
                      icon: Icon(
                        Icons.support_agent_rounded,
                        color: C.primary,
                        size: 22.r,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _GuardiansSection extends StatelessWidget {
  const _GuardiansSection({required this.p});
  final StudentProfile p;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SectionHeader(
        'Registered Guardians',
        icon: Icons.family_restroom_rounded,
        action: 'Update',
        onAction: () => context.push(RoutePaths.editProfile),
      ),
      Text('${p.guardians.length} Contacts', style: T.small),
      SizedBox(height: 8.h),
      AppSurfaceCard(
        padding: EdgeInsets.zero,
        child: Column(
          children: [
            for (var i = 0; i < p.guardians.length; i++) ...[
              if (i > 0) const Divider(height: 1, color: C.border),
              _GuardianRow(g: p.guardians[i]),
            ],
          ],
        ),
      ),
      SizedBox(height: 12.h),
      AppSurfaceCard(
        padding: EdgeInsets.all(12.w),
        child: Row(
          children: [
            IconTile(Icons.home_outlined, size: 40),
            SizedBox(width: 10.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('REGISTERED RESIDENCE', style: T.capsMuted),
                  Text(p.address, style: T.bodyStrong),
                  if (p.addressVerified) ...[
                    SizedBox(height: 4.h),
                    const Pill(
                      'Official Address Proof Verified',
                      tone: Tone.success,
                      icon: Icons.verified_rounded,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

class _GuardianRow extends StatelessWidget {
  const _GuardianRow({required this.g});
  final GuardianContact g;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
    child: Row(
      children: [
        Avatar(g.name, size: 44, tone: g.primary ? Tone.brand : Tone.purple),
        SizedBox(width: 10.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      g.name,
                      style: T.bodyStrong,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  SizedBox(width: 6.w),
                  Pill(
                    g.primary ? 'Primary' : 'Secondary',
                    tone: g.primary ? Tone.brand : Tone.neutral,
                  ),
                ],
              ),
              Text('${g.relation} • ${g.occupation}', style: T.small),
              Text(g.phone, style: T.small.copyWith(color: C.ink)),
            ],
          ),
        ),
        IconButton(
          tooltip: 'Call ${g.name}',
          onPressed: () => simulateCall(context, g.name, g.phone),
          icon: Icon(Icons.call_rounded, color: C.primary, size: 22.r),
        ),
      ],
    ),
  );
}

class _DocumentsSection extends StatelessWidget {
  const _DocumentsSection({required this.p});
  final StudentProfile p;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SectionHeader(
        'Documents',
        icon: Icons.folder_open_outlined,
        action: 'Certificates',
        onAction: () => context.push(RoutePaths.certificates),
      ),
      for (final d in p.documents)
        Padding(
          padding: EdgeInsets.only(bottom: 8.h),
          child: AppFileChip(
            name: d.name,
            size: d.size,
            sub: d.verified ? 'Verified' : 'Pending verification',
            tone: d.verified ? Tone.brand : Tone.warning,
            onTap: () => AppDialogs.showSnackBar(
              context,
              message: 'Opened ${d.name} (simulated)',
            ),
            trailing: Icon(
              d.verified ? Icons.verified_rounded : Icons.hourglass_top_rounded,
              size: 18.r,
              color: d.verified ? C.success : C.warning,
            ),
          ),
        ),
    ],
  );
}
