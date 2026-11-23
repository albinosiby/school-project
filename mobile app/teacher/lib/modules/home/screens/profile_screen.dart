import 'package:school_sync/school_sync.dart';
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

/// Teacher profile (Figma 1153:1919 "7. Profile"), route RoutePaths.profile.
///
/// Layout: gradient hero (photo, name, role, status) with a stat strip overlapping its
/// bottom edge, a quick-action grid, contact card, then the office's staff record as a
/// single tabbed card (basic / address / … / documents / payroll) followed by sign out.
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
    ].join(' • ');
    final joined = (me?.joined ?? '').length >= 4 ? me!.joined.substring(0, 4) : '—';

    final pad = EdgeInsets.symmetric(horizontal: S.page);
    final chevron = Icon(Icons.chevron_right_rounded, color: C.muted, size: 22.r);
    return Scaffold(
      backgroundColor: C.surface,
      // Flat list so the lower sections (version row, sign out) build lazily.
      body: ListView(
        padding: EdgeInsets.only(bottom: 40.h),
        children: [
          // Hero with the stat strip overlapping its bottom edge.
          Stack(
            clipBehavior: Clip.none,
            children: [
              Padding(
                padding: EdgeInsets.only(bottom: 30.h),
                child: _Hero(
                  name: name,
                  role: role,
                  status: (me?.status ?? '').isEmpty ? 'Active' : me!.status,
                  empId: me?.empId ?? '',
                  school: me?.school ?? '',
                  photo: (me?.photo ?? '').isEmpty ? null : me!.photo,
                  inchargeLabel: incharge?.label,
                  onEdit: () => showEditAccountSheet(context),
                  onShare: () => _copy(context, '$name • ${me?.empId ?? ''}', 'Profile link'),
                ),
              ),
              Positioned(
                left: S.page,
                right: S.page,
                bottom: 0,
                child: _StatStrip([
                  ('$students', 'Students'),
                  ('${classes.length}', 'Classes'),
                  ('${prof.experience} yrs', 'Experience'),
                  (joined, 'Joined'),
                ]),
              ),
            ],
          ),
          SizedBox(height: 16.h),
          Padding(
            padding: pad,
            child: _QuickActions(
              items: [
                _QuickAction(Icons.qr_code_2_rounded, 'Faculty ID', 'Digital pass', Tone.brand, () => context.push(RoutePaths.facultyId)),
                _QuickAction(Icons.fingerprint_rounded, 'My attendance', 'Check-in log', Tone.success, () => context.push(RoutePaths.attendanceSelfLog)),
                _QuickAction(Icons.calendar_month_outlined, 'Timetable', 'Workload', Tone.purple, () => context.go(RoutePaths.timetable)),
                _QuickAction(Icons.event_available_outlined, 'Leave', 'Balance & requests', Tone.warning, () => context.push(RoutePaths.leaveManagement)),
              ],
            ),
          ),
          SizedBox(height: 18.h),
          Padding(padding: pad, child: const _Heading('Contact')),
          Padding(
            padding: pad,
            child: _ContactCard(
              rows: [
                _ContactRow(Icons.mail_outline_rounded, 'Email', me?.email ?? '', () => _copy(context, me?.email ?? '', 'Email')),
                _ContactRow(Icons.phone_outlined, 'Mobile', me?.phone ?? '', () => _copy(context, me?.phone ?? '', 'Phone number')),
                if (prof.desk.isNotEmpty) _ContactRow(Icons.location_on_outlined, 'Faculty desk', prof.desk, null),
              ],
            ),
          ),
          SizedBox(height: 18.h),
          Padding(
            padding: pad,
            child: _Heading(
              'Staff record',
              trailing: Pill(
                prof.hasHrCard ? 'From HR records' : 'Not shared yet',
                tone: prof.hasHrCard ? Tone.success : Tone.warning,
                icon: prof.hasHrCard ? Icons.verified_outlined : Icons.schedule_rounded,
              ),
            ),
          ),
          Padding(padding: pad, child: _StaffRecord(prof: prof)),
          SizedBox(height: 18.h),
          Padding(padding: pad, child: const _Heading('More')),
          Padding(
            padding: pad,
            child: AppSettingsGroup([
              AppSettingsRow(
                icon: Icons.settings_outlined,
                title: 'Notification & Account Settings',
                subtitle: 'Alerts, biometrics, appearance',
                trailing: chevron,
                onTap: () => context.push(RoutePaths.settings),
              ),
            ]),
          ),
          Padding(padding: pad, child: const AppVersionRow()),
          Padding(padding: pad, child: const SignOutTile()),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

class _Hero extends StatelessWidget {
  const _Hero({
    required this.name,
    required this.role,
    required this.status,
    required this.empId,
    required this.school,
    required this.photo,
    required this.inchargeLabel,
    required this.onEdit,
    required this.onShare,
  });
  final String name, role, status, empId, school;
  final String? photo, inchargeLabel;
  final VoidCallback onEdit, onShare;

  @override
  Widget build(BuildContext context) {
    final active = status.toLowerCase() == 'active';
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [C.primaryDark, C.primary]),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(R.xxl + 8.r)),
      ),
      child: Stack(
        children: [
          // Soft decorative rings.
          Positioned(right: -60.r, top: -40.r, child: _Ring(220.r)),
          Positioned(left: -70.r, bottom: 20.r, child: _Ring(180.r)),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: EdgeInsets.fromLTRB(8.w, 4.h, 8.w, 46.h),
              child: Column(
                children: [
                  Row(
                    children: [
                      IconButton(
                        tooltip: 'Back',
                        onPressed: () => context.canPop() ? context.pop() : context.go(RoutePaths.home),
                        icon: Icon(Icons.arrow_back_rounded, color: Colors.white, size: 24.r),
                      ),
                      Expanded(child: Text('Profile', style: T.h2.copyWith(color: Colors.white))),
                      _HeroIconButton(Icons.share_outlined, 'Share profile', onShare),
                      SizedBox(width: 6.w),
                      _HeroIconButton(Icons.edit_outlined, 'Edit account', onEdit),
                    ],
                  ),
                  SizedBox(height: 10.h),
                  Container(
                    padding: EdgeInsets.all(4.r),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: .18),
                      border: Border.all(color: Colors.white.withValues(alpha: .55), width: 1.5),
                    ),
                    child: Avatar(name, size: 96, image: photo),
                  ),
                  SizedBox(height: 12.h),
                  Text(name, style: T.title.copyWith(color: Colors.white), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
                  if (role.isNotEmpty) ...[
                    SizedBox(height: 4.h),
                    Text(role, style: T.body.copyWith(color: Colors.white.withValues(alpha: .85)), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
                  ],
                  SizedBox(height: 12.h),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 8.w,
                    runSpacing: 8.h,
                    children: [
                      _HeroChip(status, icon: Icons.circle, iconColor: active ? C.success : C.warning),
                      if (empId.isNotEmpty) _HeroChip(empId, icon: Icons.badge_outlined),
                      if (inchargeLabel != null) _HeroChip('Class $inchargeLabel in-charge', icon: Icons.star_rounded),
                    ],
                  ),
                  if (school.isNotEmpty) ...[
                    SizedBox(height: 10.h),
                    Text(school, style: T.small.copyWith(color: Colors.white.withValues(alpha: .75)), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Ring extends StatelessWidget {
  const _Ring(this.size);
  final double size;
  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white.withValues(alpha: .10), width: 28.r)),
    ),
  );
}

class _HeroIconButton extends StatelessWidget {
  const _HeroIconButton(this.icon, this.tooltip, this.onTap);
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tooltip,
    onPressed: onTap,
    style: IconButton.styleFrom(
      backgroundColor: Colors.white.withValues(alpha: .16),
      shape: const CircleBorder(),
      minimumSize: Size(40.r, 40.r),
    ),
    icon: Icon(icon, color: Colors.white, size: 20.r),
  );
}

class _HeroChip extends StatelessWidget {
  const _HeroChip(this.label, {required this.icon, this.iconColor});
  final String label;
  final IconData icon;
  final Color? iconColor;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .16),
      borderRadius: BorderRadius.circular(R.pill),
      border: Border.all(color: Colors.white.withValues(alpha: .25)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: iconColor == null ? 14.r : 9.r, color: iconColor ?? Colors.white),
        SizedBox(width: 6.w),
        Text(label, style: T.small.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
      ],
    ),
  );
}

// ---------------------------------------------------------------------------
// Stat strip, quick actions, headings, contact
// ---------------------------------------------------------------------------

class _StatStrip extends StatelessWidget {
  const _StatStrip(this.stats);
  final List<(String, String)> stats;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(vertical: 14.h),
    decoration: BoxDecoration(
      color: C.bg,
      borderRadius: BorderRadius.circular(R.xl),
      border: Border.all(color: C.border),
      boxShadow: [BoxShadow(color: C.ink.withValues(alpha: .08), blurRadius: 18, offset: const Offset(0, 8))],
    ),
    child: IntrinsicHeight(
      child: Row(
        children: [
          for (var i = 0; i < stats.length; i++) ...[
            if (i > 0) const VerticalDivider(width: 1, color: C.border),
            Expanded(
              child: Column(
                children: [
                  FittedBox(fit: BoxFit.scaleDown, child: Text(stats[i].$1, style: T.h2.copyWith(fontWeight: FontWeight.w800))),
                  SizedBox(height: 2.h),
                  Text(stats[i].$2, style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ],
      ),
    ),
  );
}

class _QuickAction {
  const _QuickAction(this.icon, this.title, this.subtitle, this.tone, this.onTap);
  final IconData icon;
  final String title, subtitle;
  final Tone tone;
  final VoidCallback onTap;
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.items});
  final List<_QuickAction> items;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var r = 0; r < items.length; r += 2) ...[
        if (r > 0) SizedBox(height: 10.h),
        Row(
          children: [
            Expanded(child: _QuickActionTile(items[r])),
            SizedBox(width: 10.w),
            Expanded(child: r + 1 < items.length ? _QuickActionTile(items[r + 1]) : const SizedBox.shrink()),
          ],
        ),
      ],
    ],
  );
}

class _QuickActionTile extends StatelessWidget {
  const _QuickActionTile(this.a);
  final _QuickAction a;
  @override
  Widget build(BuildContext context) => AppCard(
    radius: R.lg,
    padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 12.h),
    onTap: a.onTap,
    child: Row(
      children: [
        IconTile(a.icon, tone: a.tone, size: 38),
        SizedBox(width: 10.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(a.title, style: T.bodyStrong.copyWith(fontSize: 13.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
              Text(a.subtitle, style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ],
    ),
  );
}

class _Heading extends StatelessWidget {
  const _Heading(this.title, {this.trailing});
  final String title;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(2.w, 0, 2.w, 10.h),
    child: Row(
      children: [
        Expanded(child: Text(title, style: T.h3)),
        ?trailing,
      ],
    ),
  );
}

class _ContactRow {
  const _ContactRow(this.icon, this.label, this.value, this.onCopy);
  final IconData icon;
  final String label, value;
  final VoidCallback? onCopy;
}

class _ContactCard extends StatelessWidget {
  const _ContactCard({required this.rows});
  final List<_ContactRow> rows;
  @override
  Widget build(BuildContext context) => AppCard(
    radius: R.xl,
    padding: EdgeInsets.zero,
    child: Column(
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) const Divider(height: 1, color: C.border),
          Padding(
            padding: EdgeInsets.fromLTRB(14.w, 10.h, 6.w, 10.h),
            child: Row(
              children: [
                IconTile(rows[i].icon, tone: Tone.neutral, size: 36),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(rows[i].label.toUpperCase(), style: T.capsMuted.copyWith(fontSize: 9.5.sp)),
                      SizedBox(height: 2.h),
                      Text(rows[i].value.isEmpty ? '—' : rows[i].value, style: T.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
                if (rows[i].onCopy != null && rows[i].value.isNotEmpty)
                  IconButton(
                    tooltip: 'Copy ${rows[i].label.toLowerCase()}',
                    onPressed: rows[i].onCopy,
                    icon: Icon(Icons.copy_rounded, size: 18.r, color: C.slate),
                  )
                else
                  SizedBox(width: 8.w),
              ],
            ),
          ),
        ],
      ],
    ),
  );
}

// ---------------------------------------------------------------------------
// Staff record (tabbed)
// ---------------------------------------------------------------------------

class _Tab {
  const _Tab(this.key, this.label, this.icon, {this.count});
  final String key, label;
  final IconData icon;
  final int? count;
}

IconData _sectionIcon(String key) => switch (key) {
  'basic' => Icons.badge_outlined,
  'address_current' || 'address_permanent' => Icons.home_outlined,
  'emergency' => Icons.emergency_outlined,
  'employment' => Icons.work_outline_rounded,
  'teaching' => Icons.menu_book_outlined,
  'qualifications' => Icons.workspace_premium_outlined,
  'documents' => Icons.folder_copy_outlined,
  'payroll' => Icons.account_balance_outlined,
  _ => Icons.info_outline_rounded,
};

/// Short chip label for a section.
String _tabLabel(ProfileSection s) => switch (s.key) {
  'basic' => 'Basic',
  'address_current' => 'Address',
  'address_permanent' => 'Permanent address',
  'emergency' => 'Emergency',
  'employment' => 'Employment',
  'teaching' => s.title.replaceFirst(' details', ''),
  'qualifications' => 'Qualifications',
  _ => s.title,
};

class _StaffRecord extends StatefulWidget {
  const _StaffRecord({required this.prof});
  final FacultyProfile prof;
  @override
  State<_StaffRecord> createState() => _StaffRecordState();
}

class _StaffRecordState extends State<_StaffRecord> {
  String _tab = '';

  List<_Tab> get _tabs => [
    for (final s in widget.prof.sections) _Tab(s.key, _tabLabel(s), _sectionIcon(s.key), count: s.key == 'qualifications' && s.groups.isNotEmpty ? s.groups.length : null),
    _Tab('documents', 'Documents', Icons.folder_copy_outlined, count: widget.prof.documents.isEmpty ? null : widget.prof.documents.length),
    _Tab('payroll', 'Payroll', Icons.account_balance_outlined, count: widget.prof.payments.isEmpty ? null : widget.prof.payments.length),
  ];

  @override
  Widget build(BuildContext context) {
    final prof = widget.prof;
    final tabs = _tabs;
    final selected = tabs.any((t) => t.key == _tab) ? _tab : tabs.first.key;
    final current = tabs.firstWhere((t) => t.key == selected);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!prof.hasHrCard)
          Padding(
            padding: EdgeInsets.only(bottom: 10.h),
            child: Container(
              padding: EdgeInsets.all(12.r),
              decoration: BoxDecoration(color: C.warningSoft, borderRadius: BorderRadius.circular(R.md)),
              child: Row(
                children: [
                  Icon(Icons.info_outline_rounded, size: 18.r, color: C.warningDark),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: Text(
                      'Your HR profile appears here once the office saves it. Sign out and in again if it was saved recently.',
                      style: T.small.copyWith(color: C.warningDark),
                    ),
                  ),
                ],
              ),
            ),
          ),
        // Scrollable tab chips.
        SizedBox(
          height: 40.h,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            itemCount: tabs.length,
            separatorBuilder: (_, _) => SizedBox(width: 8.w),
            itemBuilder: (_, i) => _TabChip(tabs[i], selected: tabs[i].key == selected, onTap: () => setState(() => _tab = tabs[i].key)),
          ),
        ),
        SizedBox(height: 12.h),
        AppCard(
          radius: R.xl,
          padding: EdgeInsets.zero,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            switchInCurve: Curves.easeOut,
            switchOutCurve: Curves.easeIn,
            layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, ?current]),
            child: KeyedSubtree(
              key: ValueKey(selected),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: EdgeInsets.fromLTRB(14.w, 12.h, 14.w, 12.h),
                    child: Row(
                      children: [
                        IconTile(current.icon, size: 34),
                        SizedBox(width: 10.w),
                        Expanded(child: Text(_panelTitle(prof, selected), style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                      ],
                    ),
                  ),
                  const Divider(height: 1, color: C.border),
                  Padding(padding: EdgeInsets.fromLTRB(14.w, 6.h, 14.w, 12.h), child: _panel(prof, selected)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  String _panelTitle(FacultyProfile prof, String key) => switch (key) {
    'documents' => 'Staff documents',
    'payroll' => 'Payroll',
    _ => prof.sections.firstWhere((s) => s.key == key).title,
  };

  Widget _panel(FacultyProfile prof, String key) => switch (key) {
    'documents' => prof.documents.isEmpty
        ? const _NotOnFile('No documents uploaded', icon: Icons.folder_off_outlined)
        : Column(children: [for (var i = 0; i < prof.documents.length; i++) _DocumentRow(prof.documents[i], first: i == 0)]),
    'payroll' => _PayrollPanel(bank: prof.bank, payments: prof.payments),
    _ => _SectionBody(prof.sections.firstWhere((s) => s.key == key)),
  };
}

class _TabChip extends StatelessWidget {
  const _TabChip(this.tab, {required this.selected, required this.onTap});
  final _Tab tab;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    label: tab.label,
    child: InkWell(
      borderRadius: BorderRadius.circular(R.pill),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: EdgeInsets.symmetric(horizontal: 14.w),
        decoration: BoxDecoration(
          color: selected ? C.primary : C.bg,
          borderRadius: BorderRadius.circular(R.pill),
          border: Border.all(color: selected ? C.primary : C.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(tab.icon, size: 15.r, color: selected ? Colors.white : C.slate),
            SizedBox(width: 6.w),
            Text(tab.label, style: T.small.copyWith(color: selected ? Colors.white : C.ink, fontWeight: FontWeight.w700, fontSize: 12.5.sp)),
            if (tab.count != null) ...[
              SizedBox(width: 6.w),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 1.h),
                decoration: BoxDecoration(color: selected ? Colors.white.withValues(alpha: .22) : C.primarySoft, borderRadius: BorderRadius.circular(R.pill)),
                child: Text('${tab.count}', style: T.small.copyWith(color: selected ? Colors.white : C.primary, fontWeight: FontWeight.w800, fontSize: 10.5.sp)),
              ),
            ],
          ],
        ),
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
    if (section.note.isNotEmpty && section.groups.isEmpty) return _NotOnFile(section.note, icon: Icons.link_rounded);
    final single = section.title.replaceFirst(RegExp(r's$'), '');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < section.groups.length; i++) ...[
          if (section.groups.length > 1) ...[
            SizedBox(height: i == 0 ? 8.h : 14.h),
            Row(
              children: [
                Container(width: 3.w, height: 14.h, decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(2))),
                SizedBox(width: 8.w),
                Text('$single ${i + 1}'.toUpperCase(), style: T.caps),
              ],
            ),
            SizedBox(height: 2.h),
          ],
          _FieldList(section.groups[i]),
        ],
      ],
    );
  }
}

/// Label-above-value rows, two per line when both values are short.
class _FieldList extends StatelessWidget {
  const _FieldList(this.fields);
  final List<ProfileField> fields;

  static bool _short(ProfileField f) => f.value.length <= 18 && !f.value.contains('\n');

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < fields.length;) {
      final a = fields[i];
      final b = i + 1 < fields.length ? fields[i + 1] : null;
      if (b != null && _short(a) && _short(b)) {
        rows.add(Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [Expanded(child: _Field(a)), SizedBox(width: 12.w), Expanded(child: _Field(b))],
        ));
        i += 2;
      } else {
        rows.add(_Field(a));
        i += 1;
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) const Divider(height: 1, color: C.border),
          rows[i],
        ],
      ],
    );
  }
}

class _Field extends StatelessWidget {
  const _Field(this.f);
  final ProfileField f;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: 9.h),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(f.label.toUpperCase(), style: T.capsMuted.copyWith(fontSize: 9.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
        SizedBox(height: 3.h),
        Text(f.value, style: T.bodyStrong.copyWith(fontSize: 13.5.sp)),
      ],
    ),
  );
}

class _NotOnFile extends StatelessWidget {
  const _NotOnFile(this.text, {this.icon = Icons.inbox_outlined});
  final String text;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: 18.h),
    child: Column(
      children: [
        Icon(icon, size: 30.r, color: C.muted),
        SizedBox(height: 8.h),
        Text(text, style: T.small, textAlign: TextAlign.center),
      ],
    ),
  );
}

// ---------------------------------------------------------------------------
// Documents & payroll
// ---------------------------------------------------------------------------

String _rupees(double v) => '₹${NumberFormat('#,##0.00').format(v)}';
String _month(String yyyyMm) {
  final d = DateTime.tryParse('$yyyyMm-01');
  return d == null ? yyyyMm : DateFormat('MMM yyyy').format(d);
}

class _DocumentRow extends StatelessWidget {
  const _DocumentRow(this.doc, {this.first = false});
  final StaffDocumentRow doc;
  final bool first;
  @override
  Widget build(BuildContext context) {
    final pdf = doc.name.toLowerCase().endsWith('.pdf');
    final uploaded = doc.uploadedAt.length >= 10 ? fmtDate(doc.uploadedAt.substring(0, 10), year: true) : doc.uploadedAt;
    return Column(
      children: [
        if (!first) const Divider(height: 1, color: C.border),
        Padding(
          padding: EdgeInsets.symmetric(vertical: 10.h),
          child: Row(
            children: [
              IconTile(pdf ? Icons.picture_as_pdf_outlined : Icons.image_outlined, tone: pdf ? Tone.danger : Tone.purple, size: 38),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(doc.label, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                    SizedBox(height: 2.h),
                    Text(doc.name, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                    if (uploaded.isNotEmpty) Text('Uploaded $uploaded', style: T.small.copyWith(fontSize: 11.sp, color: C.muted), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              SizedBox(width: 8.w),
              const Pill('Uploaded', tone: Tone.success, icon: Icons.check_rounded),
            ],
          ),
        ),
      ],
    );
  }
}

class _PayrollPanel extends StatelessWidget {
  const _PayrollPanel({required this.bank, required this.payments});
  final List<ProfileField> bank;
  final List<PayrollPayment> payments;

  String _of(String label) => bank.where((f) => f.label.toLowerCase() == label).map((f) => f.value).firstOrNull ?? '';

  @override
  Widget build(BuildContext context) {
    if (bank.isEmpty && payments.isEmpty) {
      return const _NotOnFile('No payroll details saved', icon: Icons.account_balance_wallet_outlined);
    }
    final holder = _of('account holder');
    final bankName = _of('bank');
    final account = _of('account number');
    final ifsc = _of('ifsc');
    final branch = _of('branch');
    final others = bank.where((f) => !const {'account holder', 'bank', 'account number', 'ifsc', 'branch'}.contains(f.label.toLowerCase())).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(height: 8.h),
        if (bank.isEmpty)
          const _NotOnFile('No payroll bank details saved', icon: Icons.account_balance_outlined)
        else ...[
          Text('BANK ACCOUNT', style: T.capsMuted),
          SizedBox(height: 8.h),
          _BankCard(holder: holder, bank: bankName, account: account, ifsc: ifsc, branch: branch),
          if (others.isNotEmpty) ...[SizedBox(height: 4.h), _FieldList(others)],
        ],
        SizedBox(height: 16.h),
        Row(
          children: [
            Expanded(child: Text('PAYMENT HISTORY', style: T.capsMuted)),
            if (payments.isNotEmpty) Text('${payments.length} ${payments.length == 1 ? 'month' : 'months'}', style: T.small),
          ],
        ),
        if (payments.isEmpty)
          const _NotOnFile('No payroll payments recorded', icon: Icons.receipt_long_outlined)
        else
          for (var i = 0; i < payments.length; i++) _PaymentRow(payments[i], first: i == 0),
      ],
    );
  }
}

/// Dark "bank card" for the masked payroll account.
class _BankCard extends StatelessWidget {
  const _BankCard({required this.holder, required this.bank, required this.account, required this.ifsc, required this.branch});
  final String holder, bank, account, ifsc, branch;
  @override
  Widget build(BuildContext context) {
    final sub = [if (branch.isNotEmpty) branch, if (ifsc.isNotEmpty) 'IFSC $ifsc'].join(' • ');
    return Container(
      padding: EdgeInsets.all(16.r),
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF1E293B), C.ink]),
        borderRadius: BorderRadius.circular(R.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.account_balance_rounded, color: Colors.white.withValues(alpha: .85), size: 18.r),
              SizedBox(width: 8.w),
              Expanded(child: Text(bank.isEmpty ? 'Bank account' : bank, style: T.smallStrong.copyWith(color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis)),
              Icon(Icons.lock_outline_rounded, color: Colors.white.withValues(alpha: .6), size: 16.r),
            ],
          ),
          SizedBox(height: 18.h),
          Text(account.isEmpty ? '•••• ••••' : account, style: T.h1.copyWith(color: Colors.white, letterSpacing: 2, fontSize: 20.sp)),
          SizedBox(height: 12.h),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ACCOUNT HOLDER', style: T.capsMuted.copyWith(color: Colors.white.withValues(alpha: .6), fontSize: 9.sp)),
                    Text(holder.isEmpty ? '—' : holder, style: T.smallStrong.copyWith(color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              if (sub.isNotEmpty) ...[
                SizedBox(width: 10.w),
                Flexible(child: Text(sub, style: T.small.copyWith(color: Colors.white.withValues(alpha: .75), fontSize: 11.sp), maxLines: 2, textAlign: TextAlign.right)),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _PaymentRow extends StatelessWidget {
  const _PaymentRow(this.p, {this.first = false});
  final PayrollPayment p;
  final bool first;
  @override
  Widget build(BuildContext context) {
    final meta = [
      if (p.paidOn.isNotEmpty) 'Paid ${fmtDate(p.paidOn, year: true)}',
      'Gross ${_rupees(p.gross)}',
      if (p.deductions > 0) 'Deductions ${_rupees(p.deductions)}',
      if (p.reference.isNotEmpty) 'Ref ${p.reference}',
    ].join(' • ');
    return Column(
      children: [
        if (!first) const Divider(height: 1, color: C.border),
        Padding(
          padding: EdgeInsets.symmetric(vertical: 10.h),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const IconTile(Icons.payments_outlined, tone: Tone.success, size: 36),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_month(p.month), style: T.bodyStrong),
                    SizedBox(height: 2.h),
                    Text(meta, style: T.small),
                  ],
                ),
              ),
              SizedBox(width: 8.w),
              Text(_rupees(p.net), style: T.bodyStrong.copyWith(color: C.successDark)),
            ],
          ),
        ),
      ],
    );
  }
}
