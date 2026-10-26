import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../design_system/design_system.dart';
import '../../bloc/family_bloc.dart';
import '../../models/family_models.dart';

/// Header child switcher: one chip per child (name + class). Tapping switches the data of every tab.
class ChildSwitcher extends StatelessWidget {
  const ChildSwitcher({super.key});

  @override
  Widget build(BuildContext context) => BlocBuilder<FamilyBloc, FamilyState>(
    builder: (context, state) {
      if (state.children.isEmpty) return const SizedBox.shrink();
      return Container(
        height: 64.h,
        color: C.bg,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: EdgeInsets.symmetric(horizontal: S.page, vertical: 8.h),
          itemCount: state.children.length,
          separatorBuilder: (_, _) => SizedBox(width: 10.w),
          itemBuilder: (_, i) => _ChildChip(
            child: state.children[i],
            selected: state.children[i].id == state.selected?.id,
          ),
        ),
      );
    },
  );
}

class _ChildChip extends StatelessWidget {
  const _ChildChip({required this.child, required this.selected});
  final Child child;
  final bool selected;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    label: 'Switch to ${child.name}, class ${child.className}',
    child: GestureDetector(
      key: ValueKey('child-chip-${child.id}'),
      onTap: () => context.read<FamilyBloc>().add(SelectChild(child.id)),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: EdgeInsets.only(left: 6.w, right: 14.w),
        decoration: BoxDecoration(
          color: selected ? C.primarySoft : C.bg,
          borderRadius: BorderRadius.circular(R.pill),
          border: Border.all(
            color: selected ? C.primary.withValues(alpha: .45) : C.border,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Avatar(
              child.name,
              size: 36,
              tone: selected ? Tone.brand : Tone.neutral,
            ),
            SizedBox(width: 8.w),
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  child.firstName,
                  style: T.smallStrong.copyWith(
                    color: selected ? C.primary : C.ink,
                  ),
                ),
                Text(
                  'Grade ${child.className}',
                  style: T.small.copyWith(fontSize: 10.5.sp),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}
