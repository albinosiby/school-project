import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/circulars_bloc.dart';
import '../bloc/circulars_events.dart';
import '../bloc/load_status.dart';
import '../models/attendance_models.dart';
import 'circulars_screen.dart' show circularTone;
import 'widgets/att_widgets.dart';

/// 1.5.1 Open Circular (Figma 1153:17998). Opening marks the circular read.
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
    if (s.status != LoadStatus.loaded) return DetailScaffold(title: 'Circular Details', fallbackRoute: RoutePaths.circulars, body: attLoading());
    final c = s.byId(id);
    if (c == null) {
      return const DetailScaffold(title: 'Circular', fallbackRoute: RoutePaths.circulars, body: Center(child: AppEmptyState('Circular not found', icon: Icons.search_off_rounded)));
    }
    final att = c.attachment;
    return DetailScaffold(
      title: 'Circular Details',
      subtitle: c.ref,
      fallbackRoute: RoutePaths.circulars,
      actions: [
        IconButton(
          tooltip: c.pinned ? 'Unpin' : 'Pin', onPressed: () => bloc.add(CircularPinToggled(id)),
          icon: Icon(c.pinned ? Icons.push_pin_rounded : Icons.push_pin_outlined, color: c.pinned ? C.primary : C.ink, size: 22.r),
        ),
        IconButton(tooltip: 'Share', onPressed: () => toast(context, 'Share link copied (simulated)'), icon: Icon(Icons.share_outlined, color: C.ink, size: 22.r)),
      ],
      bottom: c.ack
          ? Row(children: [
              Icon(Icons.verified_rounded, color: C.successDark, size: 22.r), SizedBox(width: 8.w),
              Expanded(child: Text('You acknowledged this circular', style: T.bodyStrong.copyWith(color: C.successDark))),
            ])
          : AppButton('Acknowledge Circular', icon: Icons.check_circle_outline_rounded, onPressed: () {
              bloc.add(CircularAcknowledged(id));
              toast(context, 'Circular acknowledged');
            }),
      body: AttBody(children: [
        AppCard(radius: R.xl, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Pill(c.ref, tone: Tone.brand, dot: true),
            const Spacer(),
            Flexible(child: Text('${c.cat.toUpperCase()} DIRECTIVE', style: T.capsMuted, maxLines: 1, overflow: TextOverflow.ellipsis)),
          ]),
          SizedBox(height: 12.h),
          Text(c.title, style: T.h1),
          SizedBox(height: 10.h),
          Row(children: [
            IconTile(Icons.shield_outlined, size: 30), SizedBox(width: 8.w),
            Expanded(child: Text(c.office, style: T.body.copyWith(color: C.ink), maxLines: 2, overflow: TextOverflow.ellipsis)),
            SizedBox(width: 6.w),
            Flexible(child: Text('• ${c.author}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
          ]),
          Divider(height: 24.h),
          Row(children: [
            Expanded(child: Text(fmtKey(c.date, 'MMM d, yyyy'), style: T.bodyStrong)),
            Pill(c.ack ? 'Acknowledged' : 'Action needed', tone: c.ack ? Tone.success : Tone.warning),
            SizedBox(width: 6.w),
            Text('PUBLISHED', style: T.capsMuted),
          ]),
        ])),
        SizedBox(height: 12.h),
        AppCard(radius: R.xl, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('PURPOSE & SCOPE', style: T.capsMuted),
          SizedBox(height: 6.h),
          Text(c.summary, style: T.body.copyWith(color: C.ink, height: 1.5)),
          Divider(height: 24.h),
          Text('KEY INSTRUCTIONS', style: T.capsMuted),
          SizedBox(height: 8.h),
          for (final p in c.points)
            Padding(
              padding: EdgeInsets.only(bottom: 8.h),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: EdgeInsets.only(top: 2.h), child: Icon(Icons.check_circle_rounded, size: 18.r, color: C.primary)), SizedBox(width: 8.w),
                Expanded(child: Text(p, style: T.body.copyWith(color: C.ink))),
              ]),
            ),
        ])),
        if (att != null) ...[
          SizedBox(height: 12.h),
          AppCard(radius: R.xl, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.attach_file_rounded, size: 16.r, color: C.slate), SizedBox(width: 6.w),
              Expanded(child: Text('ATTACHED DOCUMENT', style: T.capsMuted)),
              Text('PDF • ${att.size}', style: T.small),
            ]),
            SizedBox(height: 10.h),
            Container(
              padding: EdgeInsets.all(12.r),
              decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
              child: Column(children: [
                Row(children: [
                  IconTile(Icons.picture_as_pdf_outlined, tone: Tone.danger), SizedBox(width: 10.w),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(att.name, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                    Text('PDF • ${att.size} • Official Template', style: T.small),
                  ])),
                ]),
                SizedBox(height: 10.h),
                AppButton('Download PDF', icon: Icons.download_rounded, onPressed: () => toast(context, 'Downloading ${att.name} (simulated)')),
              ]),
            ),
          ])),
        ],
        SizedBox(height: 12.h),
        Container(
          padding: EdgeInsets.all(12.r), decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
          child: Row(children: [
            Icon(Icons.groups_outlined, size: 18.r, color: C.slate), SizedBox(width: 8.w),
            Expanded(child: Text('Addressed to: ${c.audience}', style: T.small)),
            Pill(c.catLabel, tone: circularTone(c.cat)),
          ]),
        ),
      ]),
    );
  }
}
