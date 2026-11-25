import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/circulars_bloc.dart';
import '../bloc/circulars_events.dart';
import '../bloc/circulars_states.dart';
import '../bloc/load_status.dart';
import '../models/attendance_models.dart';
import '../models/circular_models.dart';
import 'widgets/att_widgets.dart';
import 'widgets/circular_widgets.dart';

export 'widgets/circular_widgets.dart' show circularTone;

/// Circulars from the school office: search, category filter, unread-only, grouped Pinned / This week / Earlier.
class CircularsScreen extends StatelessWidget {
  const CircularsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<CircularsBloc>()..add(const CircularsLoadRequested()),
    child: const _CircularsView(),
  );
}

class _CircularsView extends StatefulWidget {
  const _CircularsView();
  @override
  State<_CircularsView> createState() => _CircularsViewState();
}

class _CircularsViewState extends State<_CircularsView> {
  /// All | Unread | To acknowledge
  String view = 'All';

  @override
  Widget build(BuildContext context) {
    final s = context.watch<CircularsBloc>().state;
    final bloc = context.read<CircularsBloc>();
    if (s.status != LoadStatus.loaded) return DetailScaffold(title: 'Circulars', body: attLoading());
    final list = [
      for (final c in s.shown)
        if (view == 'All' || (view == 'Unread' && !c.read) || (view == 'To acknowledge' && !c.ack)) c,
    ];
    final weekAgo = dkey(todayDate().subtract(const Duration(days: 6)));
    final pinned = [
      for (final c in list)
        if (c.pinned) c,
    ];
    final recent = [
      for (final c in list)
        if (!c.pinned && c.date.compareTo(weekAgo) >= 0) c,
    ];
    final older = [
      for (final c in list)
        if (!c.pinned && c.date.compareTo(weekAgo) < 0) c,
    ];
    final toAck = s.items.where((c) => !c.ack).length;
    // categories that have circulars (the filter row only shows them when there is a choice)
    final cats = [
      for (final c in circularCategories)
        if (c == 'All' || s.count(c) > 0) c,
    ];
    Widget tile(Circular c) => CircularTile(
      c,
      onPin: () {
        bloc.add(CircularPinToggled(c.id));
        toast(context, c.pinned ? 'Unpinned' : 'Pinned to top');
      },
    );
    List<Widget> group(String title, List<Circular> rows) => [
      if (rows.isNotEmpty) ...[
        Padding(
          padding: EdgeInsets.fromLTRB(2.w, 12.h, 2.w, 8.h),
          child: Text(title.toUpperCase(), style: T.capsMuted.copyWith(fontSize: 11.sp, letterSpacing: .6)),
        ),
        for (final c in rows) tile(c),
      ],
    ];
    return DetailScaffold(
      title: 'Circulars',
      subtitle: s.unread > 0
          ? '${s.unread} unread • $toAck to acknowledge'
          : (toAck > 0 ? '$toAck to acknowledge' : 'All caught up'),
      body: AttBody(
        children: [
          AppSearchField(hint: 'Search circulars, ref no…', onChanged: (v) => bloc.add(CircularsQueryChanged(v))),
          SizedBox(height: 10.h),
          // one row: what to show, then the categories that have circulars
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final v in const ['All', 'Unread', 'To acknowledge'])
                  _Chip(
                    label: v,
                    count: v == 'Unread' ? s.unread : (v == 'To acknowledge' ? toAck : null),
                    on: view == v,
                    onTap: () => setState(() => view = v),
                  ),
                if (cats.length > 1) ...[
                  Container(
                    width: 1,
                    height: 20.h,
                    margin: EdgeInsets.symmetric(horizontal: 6.w),
                    color: C.border,
                  ),
                  for (final c in cats)
                    _Chip(
                      label: Circular.labelOf(c),
                      on: s.category == c,
                      soft: true,
                      onTap: () => bloc.add(CircularsCategoryChanged(s.category == c ? 'All' : c)),
                    ),
                ],
              ],
            ),
          ),
          SizedBox(height: 6.h),
          if (list.isEmpty)
            Padding(
              padding: EdgeInsets.only(top: 24.h),
              child: AppEmptyState(
                view != 'All' ? 'You are all caught up' : (s.items.isEmpty ? 'No circulars yet' : 'No circulars found'),
                hint: view != 'All'
                    ? 'Nothing ${view == 'Unread' ? 'unread' : 'to acknowledge'} in this category.'
                    : (s.items.isEmpty
                          ? 'Circulars from the school office appear here.'
                          : 'Try a different search or category.'),
                icon: Icons.campaign_outlined,
              ),
            ),
          ...group('Pinned', pinned),
          ...group('This week', recent),
          ...group('Earlier', older),
        ],
      ),
    );
  }
}

/// Small filter pill: label (and a count), filled when selected.
class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.on, required this.onTap, this.count, this.soft = false});
  final String label;
  final bool on;
  final int? count;
  final VoidCallback onTap;

  /// category chips: a light fill when selected, so only the view chip reads as the main choice
  final bool soft;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(right: 6.w),
    child: Semantics(
      button: true,
      selected: on,
      child: InkWell(
        borderRadius: BorderRadius.circular(R.pill),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          height: 34.h,
          padding: EdgeInsets.symmetric(horizontal: 12.w),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? (soft ? C.primarySoft : C.primary) : C.bg,
            borderRadius: BorderRadius.circular(R.pill),
            border: Border.all(color: on ? (soft ? C.primary.withValues(alpha: .4) : C.primary) : C.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: T.smallStrong.copyWith(fontSize: 12.5.sp, color: on ? Colors.white : C.ink),
              ),
              if (count != null && count! > 0) ...[
                SizedBox(width: 6.w),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 1.h),
                  decoration: BoxDecoration(
                    color: on ? Colors.white24 : C.primarySoft,
                    borderRadius: BorderRadius.circular(R.pill),
                  ),
                  child: Text(
                    '$count',
                    style: T.small.copyWith(
                      fontSize: 11.sp,
                      fontWeight: FontWeight.w700,
                      color: on ? Colors.white : C.primary,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}
