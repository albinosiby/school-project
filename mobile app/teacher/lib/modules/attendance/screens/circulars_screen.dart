import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/circulars_bloc.dart';
import '../bloc/circulars_events.dart';
import '../bloc/circulars_states.dart';
import '../bloc/load_status.dart';
import '../models/attendance_models.dart';
import '../models/circular_models.dart';
import 'widgets/att_widgets.dart';

Tone circularTone(String c) => switch (c) { 'Academic' => Tone.brand, 'Admin' => Tone.neutral, 'Events' => Tone.success, _ => Tone.purple };

/// 1.5 Circulars (Figma 1153:20335).
class CircularsScreen extends StatelessWidget {
  const CircularsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(create: (_) => getIt<CircularsBloc>()..add(const CircularsLoadRequested()), child: const _CircularsView());
}

class _CircularsView extends StatelessWidget {
  const _CircularsView();

  @override
  Widget build(BuildContext context) {
    final s = context.watch<CircularsBloc>().state;
    final bloc = context.read<CircularsBloc>();
    if (s.status != LoadStatus.loaded) return DetailScaffold(title: 'Circulars', body: attLoading());
    final list = s.shown;
    final chips = [for (final c in circularCategories) '$c ${s.count(c)}'];
    return DetailScaffold(
      title: 'Circulars',
      subtitle: 'AY 2026–27',
      body: AttBody(children: [
        AppSearchField(
          hint: 'Search circulars, ref no...', onChanged: (v) => bloc.add(CircularsQueryChanged(v)),
          trailing: Semantics(
            button: true, selected: s.unreadOnly, label: s.unreadOnly ? 'Show all circulars' : 'Show unread only',
            child: InkWell(
              borderRadius: BorderRadius.circular(R.lg),
              onTap: () => bloc.add(const CircularsUnreadToggled()),
              child: Container(
                width: 52.r, height: 52.r,
                decoration: BoxDecoration(color: s.unreadOnly ? C.primarySoft : C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: s.unreadOnly ? C.primary : C.panelBorder)),
                child: Icon(s.unreadOnly ? Icons.mark_email_unread_rounded : Icons.tune_rounded, color: s.unreadOnly ? C.primary : C.ink, size: 22.r),
              ),
            ),
          ),
        ),
        SizedBox(height: 4.h),
        Row(children: [
          Icon(Icons.calendar_month_rounded, size: 16.r, color: C.primary), SizedBox(width: 4.w),
          Text('AY 2026–27', style: T.smallStrong),
          const Spacer(),
          TextButton.icon(
            onPressed: () => bloc.add(const CircularsSortToggled()),
            icon: Icon(Icons.swap_vert_rounded, size: 16.r, color: C.slate),
            label: Text.rich(TextSpan(children: [
              TextSpan(text: 'Sort: ', style: T.small),
              TextSpan(text: s.newestFirst ? 'Newest First' : 'Oldest First', style: T.smallStrong),
            ])),
          ),
        ]),
        FilterChips(items: chips, value: '${s.category} ${s.count(s.category)}', onChanged: (v) => bloc.add(CircularsCategoryChanged(v.split(' ').first))),
        SizedBox(height: 12.h),
        Row(children: [
          Expanded(child: Text('General Circulars', style: T.h2)),
          if (s.unread > 0) Text('${s.unread} updates', style: T.small),
        ]),
        SizedBox(height: 10.h),
        if (list.isEmpty)
          AppEmptyState(s.unreadOnly ? 'You are all caught up' : 'No circulars found',
              hint: s.unreadOnly ? 'No unread circulars in this category.' : 'Try a different search or category.', icon: Icons.campaign_outlined),
        for (final c in list) _CircularCard(c),
      ]),
    );
  }
}

class _CircularCard extends StatelessWidget {
  const _CircularCard(this.c);
  final Circular c;
  @override
  Widget build(BuildContext context) {
    final status = c.ack ? 'Acknowledged' : c.read ? 'Read' : fmtKey(c.date, 'MMM d, yyyy');
    void open() => context.push(RoutePaths.circular(c.id));
    return AppCard(
      margin: EdgeInsets.only(bottom: 10.h), radius: R.xl, onTap: open,
      color: c.read ? C.bg : C.panel, border: c.read ? C.border : C.panelBorder,
      padding: EdgeInsets.fromLTRB(14.w, 8.h, 6.w, 4.h),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Pill(c.catLabel, tone: circularTone(c.cat)), SizedBox(width: 8.w),
          Expanded(child: Text(c.ref, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
          if (!c.read) Container(width: 8.r, height: 8.r, margin: EdgeInsets.only(right: 6.w), decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle)),
          Pill(status, tone: c.ack ? Tone.neutral : c.read ? Tone.success : Tone.warning, icon: c.ack ? Icons.verified_outlined : c.read ? Icons.done_all_rounded : null),
          IconButton(
            tooltip: c.pinned ? 'Unpin circular' : 'Pin circular', constraints: BoxConstraints(minWidth: 44.r, minHeight: 44.r), padding: EdgeInsets.zero,
            onPressed: () {
              context.read<CircularsBloc>().add(CircularPinToggled(c.id));
              toast(context, c.pinned ? 'Unpinned' : 'Pinned to top');
            },
            icon: Icon(c.pinned ? Icons.push_pin_rounded : Icons.push_pin_outlined, size: 18.r, color: c.pinned ? C.primary : C.muted),
          ),
        ]),
        Padding(
          padding: EdgeInsets.only(right: 8.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(c.title, style: T.h3.copyWith(fontWeight: c.read ? FontWeight.w600 : FontWeight.w800)),
            SizedBox(height: 2.h),
            Text('${c.office} • ${fmtKey(c.date, 'MMM d, yyyy')}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
            SizedBox(height: 6.h),
            Text(c.summary, style: T.body.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
            Divider(height: 14.h),
          ]),
        ),
        TextButton(
          onPressed: open,
          style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size(44.w, 40.h)),
          child: Text('Open circular ›', style: T.smallStrong.copyWith(color: C.primary)),
        ),
      ]),
    );
  }
}
