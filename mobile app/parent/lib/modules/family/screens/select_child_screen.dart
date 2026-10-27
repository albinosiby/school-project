import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../../../design_system/design_system.dart';
import '../../auth/repositories/auth_demo_data.dart';
import '../../auth/screens/widgets/auth_page.dart';
import '../../auth/screens/widgets/school_contact.dart';
import '../bloc/family_bloc.dart';
import '../models/family_models.dart';

/// Figma "Onboarding 4": choose the active child after signing in (also opened from the child switcher).
class SelectChildScreen extends StatefulWidget {
  const SelectChildScreen({super.key});

  @override
  State<SelectChildScreen> createState() => _SelectChildScreenState();
}

class _SelectChildScreenState extends State<SelectChildScreen> {
  String? _picked;

  void _continue(Child child) {
    context.read<FamilyBloc>().add(SelectChild(child.id));
    AppDialogs.showSnackBar(context, message: 'Now showing ${child.name}');
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(RoutePaths.home);
    }
  }

  @override
  Widget build(BuildContext context) => BlocBuilder<FamilyBloc, FamilyState>(
    builder: (context, family) {
      final children = family.children;
      final picked =
          children.where((c) => c.id == _picked).firstOrNull ?? family.selected;
      return AuthPage(
        bottom: picked == null
            ? null
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AppButton(
                    'Continue with ${picked.name}',
                    key: const Key('select-child-continue'),
                    icon: Icons.arrow_forward_rounded,
                    onPressed: () => _continue(picked),
                  ),
                  Wrap(
                    alignment: WrapAlignment.center,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        'Need help resolving ward records?',
                        style: T.small.copyWith(fontSize: 13.sp),
                      ),
                      TextButton.icon(
                        onPressed: () =>
                            callSchoolDesk(context, desk: 'the Registrar'),
                        style: TextButton.styleFrom(
                          minimumSize: Size(0, 44.h),
                          padding: EdgeInsets.symmetric(horizontal: 6.w),
                        ),
                        icon: Icon(Icons.phone_in_talk_rounded, size: 16.r),
                        label: Text(
                          'Contact Registrar',
                          style: T.smallStrong.copyWith(
                            color: C.primary,
                            fontSize: 13.sp,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
        children: [
          AppFlowHeader('Select student', showBack: context.canPop()),
          SizedBox(height: 10.h),
          Row(
            children: [
              Icon(Icons.school_outlined, size: 16.r, color: C.primary),
              SizedBox(width: 6.w),
              Text(
                'PARENT PORTAL ACCESS',
                style: T.caps.copyWith(fontSize: 10.sp),
              ),
            ],
          ),
          SizedBox(height: 6.h),
          Text('Select Student Profile', style: T.title),
          SizedBox(height: 6.h),
          Text(
            'Choose the active child context or institution you want to manage. You can switch profiles anytime from the profile.',
            style: T.small,
          ),
          SizedBox(height: 16.h),
          const AppInstitutionCard(
            name: AuthDemoData.school,
            subtitle: AuthDemoData.verification,
            badge: AuthDemoData.board,
            icon: Icons.school_rounded,
            tinted: true,
          ),
          SizedBox(height: 16.h),
          if (family.status == LoadStatus.error)
            AppErrorWidget(
              message: family.error ?? 'Could not load your family.',
              onRetry: () => context.read<FamilyBloc>().add(const LoadFamily()),
            )
          else if (children.isEmpty && family.status == LoadStatus.loading)
            Padding(
              padding: EdgeInsets.all(24.r),
              child: const Center(child: CircularProgressIndicator()),
            )
          else if (children.isEmpty)
            const AppEmptyState(
              'No children linked',
              hint: 'Please contact the registrar to link your ward.',
              icon: Icons.family_restroom_rounded,
            )
          else ...[
            Text(
              'REGISTERED DEPENDENTS (${children.length})',
              style: T.capsMuted.copyWith(fontSize: 12.sp),
            ),
            SizedBox(height: 10.h),
            for (final c in children)
              Padding(
                padding: EdgeInsets.only(bottom: 10.h),
                child: _ChildOption(
                  child: c,
                  active: c.id == family.selected?.id,
                  picked: c.id == picked?.id,
                  onTap: () => setState(() => _picked = c.id),
                ),
              ),
          ],
        ],
      );
    },
  );
}

class _ChildOption extends StatelessWidget {
  const _ChildOption({
    required this.child,
    required this.active,
    required this.picked,
    required this.onTap,
  });
  final Child child;
  final bool active, picked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: picked,
    label: '${child.name}, class ${child.className}',
    child: Material(
      color: C.bg,
      borderRadius: BorderRadius.circular(R.lg),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: ValueKey('select-child-${child.id}'),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(R.lg),
            border: Border.all(
              color: picked ? C.primary : C.border,
              width: picked ? 1.5 : 1,
            ),
          ),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 5.w,
                  color: picked ? C.primary : Colors.transparent,
                ),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(12.w, 14.h, 14.w, 14.h),
                    child: Row(
                      children: [
                        Avatar(
                          child.name,
                          size: 52,
                          tone: picked ? Tone.brand : Tone.neutral,
                        ),
                        SizedBox(width: 12.w),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      child.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: T.h2,
                                    ),
                                  ),
                                  SizedBox(width: 8.w),
                                  active
                                      ? const Pill('Active', dot: true)
                                      : const Pill(
                                          'Linked Child',
                                          tone: Tone.neutral,
                                        ),
                                ],
                              ),
                              SizedBox(height: 4.h),
                              Text(
                                'Class ${child.className} • Roll #${child.rollNo}',
                                style: T.body,
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          picked
                              ? Icons.check_circle_rounded
                              : Icons.radio_button_unchecked_rounded,
                          size: 24.r,
                          color: picked ? C.primary : C.border,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
