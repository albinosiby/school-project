import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../constants/app_constants.dart';
import '../../../../design_system/design_system.dart';
import '../../../notifications/screens/widgets/notification_bell.dart';
import '../../bloc/family_bloc.dart';
import 'child_switcher.dart';

/// "AY 2026–27": academic years start in April.
String academicYearLabel([DateTime? now]) {
  final n = now ?? DateTime.now();
  final start = n.month >= DateTime.april ? n.year : n.year - 1;
  return 'AY $start–${((start + 1) % 100).toString().padLeft(2, '0')}';
}

/// Top of every tab screen (Figma "1. Home" header): Edvio PARENT brand, academic year + school,
/// bell (-> notifications) and guardian avatar (-> profile), then the child switcher.
/// [title] names the tab for screen readers; [subtitle] is shown under the brand when given.
class ParentTabHeader extends StatelessWidget {
  const ParentTabHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.hasUnread = false,
    this.showChildSwitcher = true,
  });
  final String title;
  final String? subtitle;
  final bool hasUnread, showChildSwitcher;

  @override
  Widget build(BuildContext context) => BlocBuilder<FamilyBloc, FamilyState>(
    buildWhen: (a, b) => a.guardian != b.guardian,
    builder: (context, state) => Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          header: true,
          label: '$title, ${AppConstants.schoolName}',
          child: Container(
            padding: EdgeInsets.fromLTRB(16.w, 10.h, 16.w, 10.h),
            color: C.bg,
            child: Row(
              children: [
                Container(
                  width: 44.r,
                  height: 44.r,
                  decoration: BoxDecoration(
                    color: C.primary,
                    borderRadius: BorderRadius.circular(R.md),
                  ),
                  child: Icon(
                    Icons.school_rounded,
                    color: Colors.white,
                    size: 24.r,
                  ),
                ),
                SizedBox(width: 10.w),
                Expanded(
                  child: ExcludeSemantics(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text('Edvio', style: T.h2),
                            SizedBox(width: 6.w),
                            Text(
                              'PARENT',
                              style: T.caps.copyWith(fontSize: 12.sp),
                            ),
                          ],
                        ),
                        SizedBox(height: 3.h),
                        Row(
                          children: [
                            Container(
                              padding: EdgeInsets.symmetric(
                                horizontal: 7.w,
                                vertical: 2.h,
                              ),
                              decoration: BoxDecoration(
                                color: C.surface,
                                borderRadius: BorderRadius.circular(R.sm),
                                border: Border.all(color: C.border),
                              ),
                              child: Text(
                                academicYearLabel(),
                                style: T.small.copyWith(
                                  fontSize: 10.5.sp,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            SizedBox(width: 6.w),
                            Expanded(
                              child: Text(
                                '• ${subtitle ?? AppConstants.schoolName}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: T.small.copyWith(fontSize: 11.sp),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                UnreadNotificationsBuilder(
                  builder: (context, unread) => _BellButton(
                    hasUnread: hasUnread || unread > 0,
                    onTap: () => context.push(RoutePaths.notifications),
                  ),
                ),
                SizedBox(width: 8.w),
                Semantics(
                  button: true,
                  label: 'Profile, ${state.guardian?.name ?? 'Parent'}',
                  child: InkResponse(
                    key: const Key('header-avatar'),
                    onTap: () => context.push(RoutePaths.profile),
                    radius: 26.r,
                    child: Avatar(
                      state.guardian?.name ?? 'Parent',
                      size: 44,
                      online: true,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (showChildSwitcher) const ChildSwitcher(),
      ],
    ),
  );
}

class _BellButton extends StatelessWidget {
  const _BellButton({required this.hasUnread, required this.onTap});
  final bool hasUnread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: hasUnread ? 'Notifications, unread' : 'Notifications',
    child: InkResponse(
      key: const Key('header-bell'),
      onTap: onTap,
      radius: 26.r,
      child: Container(
        width: 44.r,
        height: 44.r,
        decoration: BoxDecoration(
          color: C.bg,
          borderRadius: BorderRadius.circular(R.md),
          border: Border.all(color: C.border),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Icon(Icons.notifications_none_rounded, color: C.ink, size: 22.r),
            if (hasUnread)
              Positioned(
                right: 11.r,
                top: 10.r,
                child: Container(
                  width: 8.r,
                  height: 8.r,
                  decoration: BoxDecoration(
                    color: C.danger,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}
