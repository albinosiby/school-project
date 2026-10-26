import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/duties_bloc.dart';
import '../bloc/duties_events.dart';
import '../bloc/duties_states.dart';
import '../models/duty_models.dart';
import '../models/tasks_format.dart';
import 'widgets/duty_card.dart';
import 'widgets/duty_sheets.dart';

/// Duty detail (Figma 1153:20789) with agenda (1153:18116) and swap (1153:18362) sheets.
class DutyDetailScreen extends StatelessWidget {
  const DutyDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) =>
      BlocProvider(create: (_) => getIt<DutiesBloc>()..add(const DutiesLoadRequested()), child: _DutyDetailView(id));
}

class _DutyDetailView extends StatelessWidget {
  const _DutyDetailView(this.id);
  final String id;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<DutiesBloc>().state;
    if (s.status != DutiesStatus.loaded) {
      return DetailScaffold(title: 'Duties & Reminders', fallbackRoute: RoutePaths.duties, body: const Center(child: CircularProgressIndicator()));
    }
    final d = s.dutyById(id);
    if (d == null) {
      return DetailScaffold(
        title: 'Duty', fallbackRoute: RoutePaths.duties,
        body: const Center(child: AppEmptyState('Duty not found', hint: 'It may have been removed.', icon: Icons.event_busy_outlined)),
      );
    }
    final a = d.startAt;
    final swap = s.pendingSwap(id);
    final meeting = d.type == 'meeting';

    return DetailScaffold(
      title: 'Duties & Reminders',
      fallbackRoute: RoutePaths.duties,
      bottom: Row(children: [
        if (!meeting && !d.isDone) ...[
          Expanded(
            child: AppButton(swap == null ? 'Request Swap' : 'Swap Pending', icon: Icons.swap_horiz_rounded, kind: BtnKind.outline,
                onPressed: swap == null ? () => showSwapSheet(context, d) : null),
          ),
          SizedBox(width: 12.w),
        ],
        if (meeting && !d.isDone) ...[
          Expanded(child: AppButton('Agenda', icon: Icons.description_outlined, kind: BtnKind.outline, onPressed: () => showAgendaSheet(context, d))),
          SizedBox(width: 12.w),
        ],
        Expanded(
          child: AppButton(d.isDone ? 'Reopen Duty' : 'Mark Completed', icon: d.isDone ? Icons.undo_rounded : Icons.check_rounded, onPressed: () => toggleDutyDone(context, d)),
        ),
      ]),
      body: ListView(padding: EdgeInsets.fromLTRB(S.page, S.page, S.page, 32.h), children: [
        Row(children: [
          Flexible(child: Pill(d.typeLabel, tone: Tone.brand, dot: true)),
          if (a != null) ...[SizedBox(width: 8.w), Pill(relDay(a), tone: Tone.neutral)],
          if (d.isDone) ...[SizedBox(width: 8.w), const Pill('Done', tone: Tone.success)],
          const Spacer(),
          if (d.code != null) Flexible(child: Text('ID: ${d.code}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
        ]),
        SizedBox(height: 12.h),
        Text(d.title, style: T.h1),
        if (d.subtitle.isNotEmpty) Padding(padding: EdgeInsets.only(top: 4.h), child: Text(d.subtitle, style: T.body)),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.lg, padding: EdgeInsets.all(14.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.schedule_rounded, size: 18.r, color: C.primary), SizedBox(width: 8.w),
              Expanded(child: Text(d.reportNote ?? d.pick ?? 'Be at the venue 10 minutes early', style: T.smallStrong, maxLines: 2, overflow: TextOverflow.ellipsis)),
              if (!d.isDone)
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
                  decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(R.pill)),
                  child: Text(d.startsIn, style: T.small.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
                ),
            ]),
            Divider(height: 24.h),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: _Cell('Date & Time', a == null ? '' : fmtDayFull(a), d.timeRange)),
              SizedBox(width: 8.w),
              Expanded(child: _Cell('Venue & Location', d.venue, d.venue2)),
            ]),
            SizedBox(height: 16.h),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: _Cell('Role', d.role ?? '', d.role2)),
              SizedBox(width: 8.w),
              Expanded(
                child: d.type == 'exam'
                    ? _Cell('Candidates', d.candidates, d.candidates2)
                    : meeting
                        ? _Cell('Chair', d.chair ?? '—', d.tag ?? '')
                        : _Cell('Status', d.isDone ? 'Completed' : 'Upcoming', d.untilLabel),
              ),
            ]),
          ]),
        ),
        if (swap != null) ...[
          SizedBox(height: 12.h),
          PanelCard(
            padding: EdgeInsets.all(14.w),
            child: Row(children: [
              const IconTile(Icons.hourglass_top_rounded, tone: Tone.warning),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Swap request pending', style: T.h3),
                  Text('With ${swap.swapWith} • return ${swap.returnDate} ${swap.returnFrom} – ${swap.returnTo}', style: T.small),
                ]),
              ),
              TextButton(
                onPressed: () {
                  context.read<DutiesBloc>().add(DutySwapCancelled(swap.id));
                  AppDialogs.showSnackBar(context, message: 'Swap request cancelled');
                },
                child: const Text('Cancel'),
              ),
            ]),
          ),
        ],
        if (d.staff.isNotEmpty)
          _Block(title: 'Assigned Staff', trailing: '${d.staff.length} Members', children: [
            for (final m in d.staff) _StaffRow(m),
          ]),
        if (d.docs.isNotEmpty || d.desk != null)
          _Block(title: 'Documents & Support', trailing: 'Offline Ready', children: [
            if (d.docs.isNotEmpty)
              LayoutBuilder(builder: (_, c) {
                final w = (c.maxWidth - 10.w) / 2;
                return Wrap(spacing: 10.w, runSpacing: 10.h, children: [for (final f in d.docs) SizedBox(width: w, child: _DocTile(f))]);
              }),
            if (d.desk != null) ...[
              Divider(height: 24.h),
              Row(children: [
                Icon(Icons.headset_mic_outlined, color: C.primary, size: 22.r), SizedBox(width: 10.w),
                Expanded(child: Text(d.desk!, style: T.body, maxLines: 2, overflow: TextOverflow.ellipsis)),
                AppButton('Dial', icon: Icons.call_rounded, kind: BtnKind.soft, small: true, expand: false,
                    onPressed: () => AppDialogs.showSnackBar(context, message: 'Dialing ${d.desk}… (simulated)')),
              ]),
            ],
          ]),
      ]),
    );
  }
}

class _StaffRow extends StatelessWidget {
  const _StaffRow(this.m);
  final DutyStaff m;
  @override
  Widget build(BuildContext context) {
    Widget action(IconData icon, String tip, String msg) => IconButton.filledTonal(
          tooltip: tip, onPressed: () => AppDialogs.showSnackBar(context, message: msg), icon: Icon(icon, size: 18.r),
          style: IconButton.styleFrom(backgroundColor: C.surface, foregroundColor: C.ink, minimumSize: Size(44.r, 44.r)),
        );
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 6.h),
      child: Row(children: [
        Avatar(m.name, size: 44), SizedBox(width: 12.w),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(m.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(m.role, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
          ]),
        ),
        if (m.relief)
          const Pill('Relief', tone: Tone.neutral)
        else ...[
          action(Icons.call_rounded, 'Call ${m.name}', 'Calling ${m.name}… (simulated)'),
          action(Icons.chat_bubble_outline_rounded, 'Message ${m.name}', 'Message sent to ${m.name} (simulated)'),
        ],
      ]),
    );
  }
}

class _DocTile extends StatelessWidget {
  const _DocTile(this.f);
  final DutyDoc f;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true, label: 'Download ${f.name}',
        child: InkWell(
          borderRadius: BorderRadius.circular(R.md), onTap: () => AppDialogs.showSnackBar(context, message: 'Downloaded ${f.name} (simulated)'),
          child: Container(
            constraints: BoxConstraints(minHeight: 52.h), padding: EdgeInsets.all(10.w),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
            child: Row(children: [
              Icon(f.kind == 'pdf' ? Icons.picture_as_pdf_outlined : Icons.description_outlined, color: C.primary, size: 22.r),
              SizedBox(width: 8.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(f.name, style: T.smallStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(f.size, style: T.small),
                ]),
              ),
              Icon(Icons.file_download_outlined, size: 18.r, color: C.primary),
            ]),
          ),
        ),
      );
}

class _Cell extends StatelessWidget {
  const _Cell(this.label, this.value, this.sub);
  final String label, value, sub;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: T.small), SizedBox(height: 4.h),
        Text(value, style: T.smallStrong.copyWith(fontSize: 13.sp), maxLines: 2, overflow: TextOverflow.ellipsis), SizedBox(height: 4.h),
        Text(sub, style: T.small.copyWith(fontSize: 13.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
      ]);
}

class _Block extends StatelessWidget {
  const _Block({required this.title, required this.trailing, required this.children});
  final String title, trailing;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(top: 14.h),
        child: AppCard(
          radius: R.lg, padding: EdgeInsets.all(14.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Expanded(child: Text(title, style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis)), Text(trailing, style: T.small)]),
            SizedBox(height: 10.h),
            ...children,
          ]),
        ),
      );
}
