import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../config/routes/routes.dart';
import '../../design_system/design_system.dart';
import '../../di/injection.dart';
import '../../modules/school/bloc/school_bloc.dart';
import '../../modules/school/models/school_models.dart';
import '../../utils/services/local_storage_service.dart';

/// First-run walkthrough: Figma "Onboarding 1" (1153:2689, welcome) and "Onboarding 2" (1153:2755, confirm profile).
/// Completing it stores the onboarding flag (the router redirect reads it) and opens Home.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _ctrl = PageController();
  int _page = 0;
  /// Classes the teacher unticked on the confirm page (local until "Confirm & Continue").
  final Set<String> _unchecked = {};

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    await getIt<LocalStorageService>().setOnboardingComplete();
    if (mounted) context.go(RoutePaths.home);
  }

  void _goto(int p) => _ctrl.animateToPage(p, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final me = school.teacher;
    final classes = school.classes;
    final confirmed = classes.where((c) => !_unchecked.contains(c.id)).length;
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: Column(children: [
          SizedBox(
            height: 52.h,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 8.w),
              child: Row(children: [
                if (_page > 0)
                  IconButton(tooltip: 'Back', onPressed: () => _goto(0), icon: Icon(Icons.arrow_back_rounded, color: C.ink, size: 24.r)),
                const Spacer(),
                if (_page == 0)
                  TextButton(
                    onPressed: _finish,
                    style: TextButton.styleFrom(minimumSize: Size(48.w, 44.h)),
                    child: Text('Skip', style: T.bodyStrong.copyWith(color: C.slate)),
                  ),
              ]),
            ),
          ),
          Expanded(
            child: PageView(controller: _ctrl, onPageChanged: (p) => setState(() => _page = p), children: [
              _Welcome(teacher: me),
              _Confirm(
                teacher: me, classes: classes, unchecked: _unchecked, confirmed: confirmed,
                onToggle: (id) => setState(() => _unchecked.contains(id) ? _unchecked.remove(id) : _unchecked.add(id)),
              ),
            ]),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(20.w, 8.h, 20.w, 12.h),
            child: _page == 0
                ? Column(mainAxisSize: MainAxisSize.min, children: [
                    AppButton('Get Started', icon: Icons.arrow_forward_rounded, onPressed: () => _goto(1)),
                    SizedBox(height: 8.h),
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(Icons.shield_outlined, size: 14.r, color: C.primary), SizedBox(width: 6.w),
                      Flexible(child: Text('Pre-configured with school roster & curriculum.', style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    ]),
                  ])
                : Column(mainAxisSize: MainAxisSize.min, children: [
                    AppButton('Confirm & Continue', onPressed: confirmed == 0 ? null : _finish),
                    SizedBox(height: 4.h),
                    TextButton(
                      onPressed: () => AppDialogs.showSnackBar(context, message: 'Please contact the School Admin desk (Ext #102)'),
                      child: Text('Need corrections? Contact School Admin', style: T.small.copyWith(color: C.primary)),
                    ),
                  ]),
          ),
        ]),
      ),
    );
  }
}

class _YearChip extends StatelessWidget {
  const _YearChip(this.year);
  final String year;
  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.centerLeft,
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
          decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(R.sm)),
          child: Text(year, style: T.smallStrong.copyWith(color: C.slate)),
        ),
      );
}

class _Welcome extends StatelessWidget {
  const _Welcome({required this.teacher});
  final Teacher? teacher;
  @override
  Widget build(BuildContext context) => ListView(padding: EdgeInsets.symmetric(horizontal: 20.w), children: [
        _YearChip(teacher?.year ?? ''),
        SizedBox(height: 12.h),
        Text('Welcome to EduAdmin', style: T.title.copyWith(fontSize: 24.sp)),
        SizedBox(height: 8.h),
        Text('Your modern educator workspace for seamless classroom management and student success.', style: T.body),
        SizedBox(height: 18.h),
        // Figma uses a campus photo; the app logo on the brand gradient stands in.
        Container(
          height: 240.h,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(R.xl),
            gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [C.primaryDark, C.primary, C.purple]),
          ),
          child: Center(
            child: Container(
              padding: EdgeInsets.all(18.r),
              decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
              child: const AppLogo(size: 120),
            ),
          ),
        ),
        SizedBox(height: 18.h),
        AppCard(
          radius: R.xl,
          child: Row(children: [
            const IconTile(Icons.school_rounded, size: 48), SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text(teacher?.school ?? '', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  SizedBox(width: 4.w), Icon(Icons.verified_rounded, size: 16.r, color: C.primary),
                ]),
                Text('Academic year ${teacher?.year ?? ''} • CBSE', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              ]),
            ),
            SizedBox(width: 6.w),
            const Pill('Default', tone: Tone.success),
          ]),
        ),
      ]);
}

class _Confirm extends StatelessWidget {
  const _Confirm({required this.teacher, required this.classes, required this.unchecked, required this.onToggle, required this.confirmed});
  final Teacher? teacher;
  final List<SchoolClass> classes;
  final Set<String> unchecked;
  final ValueChanged<String> onToggle;
  final int confirmed;
  @override
  Widget build(BuildContext context) => ListView(padding: EdgeInsets.symmetric(horizontal: 20.w), children: [
        _YearChip(teacher?.year ?? ''),
        SizedBox(height: 12.h),
        Text('Confirm Your Profile', style: T.title.copyWith(fontSize: 24.sp)),
        SizedBox(height: 8.h),
        Text('Verify your school affiliation and assigned classes to personalize your academic workspace.', style: T.body),
        SizedBox(height: 16.h),
        AppCard(
          radius: R.xl,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const IconTile(Icons.account_balance_rounded, size: 44), SizedBox(width: 12.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('AFFILIATED CAMPUS', style: T.capsMuted.copyWith(fontSize: 10.sp)),
                  Text(teacher?.school ?? '', style: T.h3, maxLines: 2, overflow: TextOverflow.ellipsis),
                  Text('CBSE Affiliated • North Academic Wing', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                ]),
              ),
              const Pill('Verified', tone: Tone.success, icon: Icons.check_circle_outline_rounded),
            ]),
            SizedBox(height: 10.h),
            Wrap(spacing: 8.w, runSpacing: 6.h, children: const [
              Pill('Primary Branch', tone: Tone.success, dot: true),
              Pill('Gurugram, NCR', tone: Tone.neutral, icon: Icons.place_outlined),
            ]),
          ]),
        ),
        SizedBox(height: 12.h),
        AppCard(
          radius: R.xl,
          child: Row(children: [
            Avatar(teacher?.name ?? 'T', size: 56), SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(teacher?.name ?? '', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                Text('${teacher?.designation ?? ''} • ${teacher?.subjects ?? ''}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                SizedBox(height: 4.h),
                Pill(teacher?.empId ?? '', tone: Tone.neutral, icon: Icons.badge_outlined),
              ]),
            ),
          ]),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(2.w, 18.h, 2.w, 10.h),
          child: Row(children: [
            Icon(Icons.event_available_outlined, size: 18.r, color: C.primary), SizedBox(width: 8.w),
            Expanded(child: Text('ASSIGNED CLASSES', style: T.smallStrong.copyWith(letterSpacing: .6))),
            Pill('$confirmed Confirmed', tone: Tone.brand),
          ]),
        ),
        for (final c in classes)
          Padding(
            padding: EdgeInsets.only(bottom: 10.h),
            child: AppCard(
              radius: R.xl, onTap: () => onToggle(c.id),
              padding: EdgeInsets.fromLTRB(16.w, 12.h, 8.w, 12.h),
              child: Row(children: [
                IconTile(Icons.functions_rounded, size: 44, tone: unchecked.contains(c.id) ? Tone.neutral : Tone.brand), SizedBox(width: 12.w),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Class ${c.grade}–${c.section}', style: T.h3),
                    Text('${c.subject} • ${c.students} Students', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ]),
                ),
                Semantics(
                  label: 'Confirm class ${c.label}',
                  child: Checkbox(value: !unchecked.contains(c.id), onChanged: (_) => onToggle(c.id)),
                ),
              ]),
            ),
          ),
        Padding(
          padding: EdgeInsets.symmetric(vertical: 8.h),
          child: Row(children: [
            Icon(Icons.sync_rounded, size: 14.r, color: C.slate), SizedBox(width: 6.w),
            Expanded(child: Text('Class rosters automatically sync with ERP Gradebook', style: T.small.copyWith(fontSize: 11.sp))),
          ]),
        ),
      ]);
}
