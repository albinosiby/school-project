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

class _CircularsView extends StatelessWidget {
  const _CircularsView();

  @override
  Widget build(BuildContext context) {
    final s = context.watch<CircularsBloc>().state;
    final bloc = context.read<CircularsBloc>();
    if (s.status != LoadStatus.loaded) return DetailScaffold(title: 'Circulars', body: attLoading());
    final list = s.shown;
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
          padding: EdgeInsets.fromLTRB(2.w, 10.h, 2.w, 8.h),
          child: Text(title.toUpperCase(), style: T.capsMuted.copyWith(fontSize: 11.sp, letterSpacing: .6)),
        ),
        for (final c in rows) tile(c),
      ],
    ];
    return DetailScaffold(
      title: 'Circulars',
      subtitle: s.unread > 0 ? '${s.unread} unread' : 'All caught up',
      body: AttBody(
        children: [
          if (s.items.isNotEmpty) _Overview(unread: s.unread, toAck: toAck, total: s.items.length),
          SizedBox(height: 12.h),
          AppSearchField(
            hint: 'Search circulars, ref no…',
            onChanged: (v) => bloc.add(CircularsQueryChanged(v)),
            trailing: Semantics(
              button: true,
              selected: s.unreadOnly,
              label: s.unreadOnly ? 'Show all circulars' : 'Show unread only',
              child: InkWell(
                borderRadius: BorderRadius.circular(R.lg),
                onTap: () => bloc.add(const CircularsUnreadToggled()),
                child: Container(
                  width: 52.r,
                  height: 52.r,
                  decoration: BoxDecoration(
                    color: s.unreadOnly ? C.primarySoft : C.bg,
                    borderRadius: BorderRadius.circular(R.lg),
                    border: Border.all(color: s.unreadOnly ? C.primary : C.panelBorder),
                  ),
                  child: Icon(
                    s.unreadOnly ? Icons.mark_email_unread_rounded : Icons.mark_email_unread_outlined,
                    color: s.unreadOnly ? C.primary : C.ink,
                    size: 22.r,
                  ),
                ),
              ),
            ),
          ),
          SizedBox(height: 8.h),
          FilterChips(
            items: [for (final c in circularCategories) '$c ${s.count(c)}'],
            value: '${s.category} ${s.count(s.category)}',
            onChanged: (v) => bloc.add(CircularsCategoryChanged(v.split(' ').first)),
          ),
          SizedBox(height: 4.h),
          if (list.isEmpty)
            Padding(
              padding: EdgeInsets.only(top: 24.h),
              child: AppEmptyState(
                s.unreadOnly ? 'You are all caught up' : (s.items.isEmpty ? 'No circulars yet' : 'No circulars found'),
                hint: s.unreadOnly
                    ? 'No unread circulars in this category.'
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

/// Unread / to acknowledge summary at the top.
class _Overview extends StatelessWidget {
  const _Overview({required this.unread, required this.toAck, required this.total});
  final int unread, toAck, total;
  @override
  Widget build(BuildContext context) {
    Widget stat(String v, String l) => Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(v, style: T.h2.copyWith(color: Colors.white, height: 1.1)),
          Text(
            l,
            style: T.small.copyWith(color: Colors.white.withValues(alpha: .8), fontSize: 11.sp),
          ),
        ],
      ),
    );
    return Container(
      padding: EdgeInsets.all(14.w),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [C.primary, C.primaryDark],
        ),
        borderRadius: BorderRadius.circular(R.xl),
      ),
      child: Row(
        children: [
          Container(
            width: 42.r,
            height: 42.r,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .18),
              borderRadius: BorderRadius.circular(R.md),
            ),
            child: Icon(Icons.campaign_rounded, color: Colors.white, size: 22.r),
          ),
          SizedBox(width: 14.w),
          stat('$unread', 'Unread'),
          stat('$toAck', 'To acknowledge'),
          stat('$total', 'Total'),
        ],
      ),
    );
  }
}
