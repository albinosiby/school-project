import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../constants/app_constants.dart';
import '../../../../design_system/design_system.dart';
import '../../../family/bloc/family_bloc.dart';
import '../../../family/models/family_models.dart';

/// Child selector & school identity card (Figma Home): photo badge with class, name with a dropdown,
/// roll / board, "N Children" switcher and the school bar with the RFID chip.
class HomeChildCard extends StatelessWidget {
  const HomeChildCard({super.key, required this.child});
  final Child child;

  Future<void> _switch(BuildContext context) {
    final family = context.read<FamilyBloc>();
    return showAppSheet<void>(
      context,
      title: 'Switch child',
      subtitle: 'Every tab follows the selected child',
      useRootNavigator: true,
      builder: (ctx) => Column(
        children: [
          for (final c in family.state.children)
            ListTile(
              key: ValueKey('switch-${c.id}'),
              contentPadding: EdgeInsets.zero,
              minTileHeight: 56.h,
              leading: Avatar(
                c.name,
                size: 40,
                tone: c.id == child.id ? Tone.brand : Tone.neutral,
              ),
              title: Text(c.name, style: T.bodyStrong),
              subtitle: Text(
                'Grade ${c.className} • Roll #${c.rollNo}',
                style: T.small,
              ),
              trailing: c.id == child.id
                  ? Icon(
                      Icons.check_circle_rounded,
                      color: C.primary,
                      size: 22.r,
                    )
                  : null,
              onTap: () {
                family.add(SelectChild(c.id));
                Navigator.of(ctx).pop();
              },
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final count = context.select<FamilyBloc, int>(
      (b) => b.state.children.length,
    );
    return AppElevatedCard(
      padding: EdgeInsets.all(14.w),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Semantics(
                  button: true,
                  label: '${child.name}, switch child',
                  excludeSemantics: true,
                  child: InkWell(
                    key: const Key('home-child-trigger'),
                    borderRadius: BorderRadius.circular(R.md),
                    onTap: () => _switch(context),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 54.r,
                          height: 54.r,
                          child: Stack(
                            children: [
                              Avatar(child.name, size: 48),
                              Positioned(
                                right: 0,
                                bottom: 0,
                                child: Container(
                                  padding: EdgeInsets.symmetric(
                                    horizontal: 6.w,
                                    vertical: 1.h,
                                  ),
                                  decoration: BoxDecoration(
                                    color: C.primary,
                                    borderRadius: BorderRadius.circular(R.pill),
                                    border: Border.all(
                                      color: Colors.white,
                                      width: 1.5,
                                    ),
                                  ),
                                  child: Text(
                                    child.className.replaceAll('-', ''),
                                    style: T.smallStrong.copyWith(
                                      color: Colors.white,
                                      fontSize: 10.sp,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        SizedBox(width: 10.w),
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
                                      style: T.h2.copyWith(color: C.ink),
                                    ),
                                  ),
                                  Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    size: 20.r,
                                    color: C.primary,
                                  ),
                                ],
                              ),
                              Text(
                                'Roll #${child.rollNo} • CBSE Campus',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: T.small,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              SizedBox(width: 8.w),
              Semantics(
                button: true,
                label: '$count children linked, switch child',
                excludeSemantics: true,
                child: InkWell(
                  key: const Key('home-children-pill'),
                  borderRadius: BorderRadius.circular(R.pill),
                  onTap: () => _switch(context),
                  child: Container(
                    constraints: BoxConstraints(minHeight: 36.h),
                    padding: EdgeInsets.symmetric(horizontal: 12.w),
                    decoration: BoxDecoration(
                      color: C.indigoSoft.withValues(alpha: .6),
                      borderRadius: BorderRadius.circular(R.pill),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.people_alt_rounded,
                          size: 15.r,
                          color: C.primary,
                        ),
                        SizedBox(width: 6.w),
                        Text(
                          '$count ${count == 1 ? 'Child' : 'Children'}',
                          style: T.smallStrong.copyWith(color: C.primary),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 9.h),
            decoration: BoxDecoration(
              color: C.surface,
              borderRadius: BorderRadius.circular(R.md),
              border: Border.all(color: C.cardBorder),
            ),
            child: Row(
              children: [
                Icon(Icons.apartment_rounded, size: 15.r, color: C.primary),
                SizedBox(width: 8.w),
                Expanded(
                  child: Text(
                    AppConstants.schoolName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.small.copyWith(color: C.slate),
                  ),
                ),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                  decoration: BoxDecoration(
                    color: C.emeraldSoft,
                    borderRadius: BorderRadius.circular(R.sm),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6.r,
                        height: 6.r,
                        decoration: const BoxDecoration(
                          color: C.success,
                          shape: BoxShape.circle,
                        ),
                      ),
                      SizedBox(width: 5.w),
                      Text(
                        'Secured RFID',
                        style: T.smallStrong.copyWith(
                          color: C.emerald,
                          fontSize: 11.sp,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
