import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/circulars_bloc.dart';
import '../bloc/circulars_events.dart';
import '../bloc/load_status.dart';
import '../models/attendance_models.dart';
import 'widgets/att_widgets.dart';
import 'widgets/circular_widgets.dart';

/// One circular. Opening it marks it read; the teacher acknowledges it from the bottom bar.
class CircularDetailScreen extends StatelessWidget {
  const CircularDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<CircularsBloc>()
      ..add(const CircularsLoadRequested())
      ..add(CircularOpened(id)),
    child: _DetailView(id: id),
  );
}

class _DetailView extends StatelessWidget {
  const _DetailView({required this.id});
  final String id;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<CircularsBloc>().state;
    final bloc = context.read<CircularsBloc>();
    if (s.status != LoadStatus.loaded) {
      return DetailScaffold(title: 'Circular', fallbackRoute: RoutePaths.circulars, body: attLoading());
    }
    final c = s.byId(id);
    if (c == null) {
      return const DetailScaffold(
        title: 'Circular',
        fallbackRoute: RoutePaths.circulars,
        body: Center(child: AppEmptyState('Circular not found', icon: Icons.search_off_rounded)),
      );
    }
    final tone = toneColors(c.urgent ? Tone.danger : circularTone(c.cat));
    final att = c.attachment;
    return DetailScaffold(
      title: 'Circular',
      subtitle: c.ref,
      fallbackRoute: RoutePaths.circulars,
      actions: [
        IconButton(
          tooltip: c.pinned ? 'Unpin' : 'Pin',
          onPressed: () => bloc.add(CircularPinToggled(id)),
          icon: Icon(
            c.pinned ? Icons.push_pin_rounded : Icons.push_pin_outlined,
            color: c.pinned ? C.primary : C.ink,
            size: 22.r,
          ),
        ),
      ],
      bottom: c.ack
          ? Container(
              padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
              decoration: BoxDecoration(color: C.successSoft, borderRadius: BorderRadius.circular(R.lg)),
              child: Row(
                children: [
                  Icon(Icons.verified_rounded, color: C.successDark, size: 22.r),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: Text(
                      c.ackAt == null
                          ? 'You acknowledged this circular'
                          : 'Acknowledged ${fmtKey(c.ackAt!, 'MMM d, h:mm a')}',
                      style: T.bodyStrong.copyWith(color: C.successDark),
                    ),
                  ),
                ],
              ),
            )
          : AppButton(
              'Acknowledge Circular',
              icon: Icons.check_circle_outline_rounded,
              onPressed: () {
                bloc.add(CircularAcknowledged(id));
                toast(context, 'Circular acknowledged');
              },
            ),
      body: AttBody(
        children: [
          // ---- header
          Container(
            padding: EdgeInsets.all(16.w),
            decoration: BoxDecoration(
              color: tone.bg,
              borderRadius: BorderRadius.circular(R.xl),
              border: Border.all(color: tone.fg.withValues(alpha: .18)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40.r,
                      height: 40.r,
                      decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.md)),
                      child: Icon(
                        c.urgent ? Icons.priority_high_rounded : circularIcon(c.cat),
                        size: 21.r,
                        color: tone.fg,
                      ),
                    ),
                    SizedBox(width: 10.w),
                    Expanded(
                      child: Text(
                        c.urgent ? 'URGENT • ${c.catLabel.toUpperCase()}' : c.catLabel.toUpperCase(),
                        style: T.caps.copyWith(color: tone.fg, fontSize: 11.sp),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (!c.ack) const Pill('Action needed', tone: Tone.warning),
                  ],
                ),
                SizedBox(height: 14.h),
                Text(c.title, style: T.h1.copyWith(fontSize: 21.sp, height: 1.25)),
                SizedBox(height: 12.h),
                Wrap(
                  spacing: 14.w,
                  runSpacing: 6.h,
                  children: [
                    _Meta(Icons.event_outlined, fmtKey(c.date, 'EEE, MMM d, yyyy')),
                    if (c.author.isNotEmpty) _Meta(Icons.person_outline_rounded, c.author),
                    if (c.office.isNotEmpty && c.office != c.author) _Meta(Icons.apartment_rounded, c.office),
                  ],
                ),
              ],
            ),
          ),
          SizedBox(height: 14.h),

          // ---- message
          AppCard(
            radius: R.xl,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SelectableText(
                  c.summary.isEmpty ? 'No message.' : c.summary,
                  style: T.body.copyWith(color: C.ink, fontSize: 14.5.sp, height: 1.6),
                ),
                if (c.points.isNotEmpty) ...[
                  Divider(height: 26.h),
                  Text('KEY POINTS', style: T.capsMuted),
                  SizedBox(height: 10.h),
                  for (var i = 0; i < c.points.length; i++)
                    Padding(
                      padding: EdgeInsets.only(bottom: 10.h),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 22.r,
                            height: 22.r,
                            alignment: Alignment.center,
                            decoration: const BoxDecoration(color: C.primarySoft, shape: BoxShape.circle),
                            child: Text(
                              '${i + 1}',
                              style: T.small.copyWith(color: C.primary, fontWeight: FontWeight.w800, fontSize: 11.sp),
                            ),
                          ),
                          SizedBox(width: 10.w),
                          Expanded(
                            child: Text(c.points[i], style: T.body.copyWith(color: C.ink, height: 1.45)),
                          ),
                        ],
                      ),
                    ),
                ],
              ],
            ),
          ),

          if (att != null) ...[
            SizedBox(height: 12.h),
            AppFileChip(name: att.name, size: att.size, sub: 'Attachment • ask the office for a copy'),
          ],

          if (c.audience.isNotEmpty) ...[
            SizedBox(height: 12.h),
            Row(
              children: [
                Icon(Icons.groups_outlined, size: 16.r, color: C.slate),
                SizedBox(width: 6.w),
                Expanded(child: Text('Addressed to ${c.audience}', style: T.small)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta(this.icon, this.text);
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 14.r, color: C.slate),
      SizedBox(width: 5.w),
      Flexible(
        child: Text(
          text,
          style: T.small.copyWith(color: C.ink, fontSize: 12.sp),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    ],
  );
}
