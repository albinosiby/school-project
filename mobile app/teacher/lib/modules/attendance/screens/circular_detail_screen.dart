import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/services/cached_image_service.dart';
import '../../school/bloc/school_bloc.dart';
import '../models/circular_models.dart';
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
          _Letter(
            school: context.watch<SchoolBloc>().state.teacher?.school ?? '',
            logo: context.watch<SchoolBloc>().state.teacher?.logo ?? '',
            c: c,
            tone: tone,
          ),
          if (att != null) ...[
            SizedBox(height: 12.h),
            AppFileChip(name: att.name, size: att.size, sub: 'Attachment • ask the office for a copy'),
          ],
          SizedBox(height: 12.h),
          Row(
            children: [
              Icon(
                c.ack ? Icons.verified_outlined : Icons.mark_email_read_outlined,
                size: 16.r,
                color: c.ack ? C.successDark : C.slate,
              ),
              SizedBox(width: 6.w),
              Expanded(
                child: Text(
                  c.ack ? 'You acknowledged this circular' : 'Read • please acknowledge below',
                  style: T.small.copyWith(color: c.ack ? C.successDark : C.slate),
                ),
              ),
              Pill(c.catLabel, tone: circularTone(c.cat)),
            ],
          ),
        ],
      ),
    );
  }
}

/// The circular as a letter: letterhead, ref and date, To / Subject, the message, key points and the sign-off.
class _Letter extends StatelessWidget {
  const _Letter({required this.school, required this.logo, required this.c, required this.tone});
  final String school, logo;
  final Circular c;
  final ({Color bg, Color fg}) tone;

  @override
  Widget build(BuildContext context) {
    final label = T.small.copyWith(color: C.slate, fontSize: 12.sp);
    final strong = T.bodyStrong.copyWith(fontSize: 13.5.sp);
    return Container(
      decoration: BoxDecoration(
        color: C.bg,
        borderRadius: BorderRadius.circular(R.xl),
        border: Border.all(color: C.border),
        boxShadow: [BoxShadow(color: C.ink.withValues(alpha: .05), blurRadius: 14, offset: const Offset(0, 4))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(height: 5.h, color: c.urgent ? C.danger : C.primary),
          Padding(
            padding: EdgeInsets.fromLTRB(16.w, 14.h, 16.w, 18.h),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // letterhead
                Row(
                  children: [
                    _Logo(logo),
                    SizedBox(width: 10.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            school.isEmpty ? 'School Office' : school,
                            style: T.h3.copyWith(fontSize: 15.sp),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            c.office.isEmpty ? 'Office circular' : c.office,
                            style: label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    if (c.urgent) const Pill('URGENT', tone: Tone.danger, icon: Icons.priority_high_rounded),
                  ],
                ),
                SizedBox(height: 12.h),
                Container(height: 1, color: C.border),
                SizedBox(height: 10.h),
                Row(
                  children: [
                    Expanded(
                      child: Text('Ref: ${c.ref}', style: label, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                    Text('Date: ${fmtKey(c.date, 'd MMM yyyy')}', style: label),
                  ],
                ),
                SizedBox(height: 16.h),
                Center(
                  child: Text(
                    'CIRCULAR',
                    style: T.caps.copyWith(color: tone.fg, letterSpacing: 4, fontSize: 13.sp),
                  ),
                ),
                SizedBox(height: 16.h),
                if (c.audience.isNotEmpty) ...[
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: 'To: ', style: label),
                        TextSpan(text: c.audience, style: strong),
                      ],
                    ),
                  ),
                  SizedBox(height: 6.h),
                ],
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(text: 'Subject: ', style: label),
                      TextSpan(
                        text: c.title,
                        style: strong.copyWith(fontSize: 15.sp, height: 1.35),
                      ),
                    ],
                  ),
                ),
                SizedBox(height: 14.h),
                SelectableText(
                  c.summary.isEmpty ? 'No message.' : c.summary,
                  style: T.body.copyWith(color: C.ink, fontSize: 14.5.sp, height: 1.65),
                ),
                if (c.points.isNotEmpty) ...[
                  SizedBox(height: 12.h),
                  for (var i = 0; i < c.points.length; i++)
                    Padding(
                      padding: EdgeInsets.only(bottom: 8.h),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 22.w,
                            child: Text('${i + 1}.', style: strong.copyWith(color: C.primary)),
                          ),
                          Expanded(
                            child: Text(c.points[i], style: T.body.copyWith(color: C.ink, height: 1.5)),
                          ),
                        ],
                      ),
                    ),
                ],
                SizedBox(height: 22.h),
                Align(
                  alignment: Alignment.centerRight,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('Issued by', style: label),
                      SizedBox(height: 2.h),
                      Text(c.author.isEmpty ? 'School Office' : c.author, style: strong, textAlign: TextAlign.end),
                      if (c.office.isNotEmpty && c.office != c.author)
                        Text(c.office, style: label, textAlign: TextAlign.end),
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

/// School logo from the settings (cached), or a building icon.
class _Logo extends StatelessWidget {
  const _Logo(this.url);
  final String url;
  @override
  Widget build(BuildContext context) {
    Widget tile(Widget child) => Container(
      width: 44.r,
      height: 44.r,
      padding: EdgeInsets.all(4.r),
      decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.md)),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
    final icon = Icon(Icons.account_balance_rounded, color: C.primary, size: 22.r);
    if (url.isEmpty) return tile(icon);
    final cached = CachedImageService.peek(url);
    if (cached != null) return tile(Image.memory(cached, fit: BoxFit.contain, gaplessPlayback: true));
    return FutureBuilder<Uint8List?>(
      future: CachedImageService.bytes(url),
      builder: (_, snap) =>
          tile(snap.data == null ? icon : Image.memory(snap.data!, fit: BoxFit.contain, gaplessPlayback: true)),
    );
  }
}
