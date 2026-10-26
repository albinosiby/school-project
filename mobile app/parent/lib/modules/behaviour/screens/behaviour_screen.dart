import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../family/models/family_models.dart';
import '../../home/screens/widgets/parent_page_scaffold.dart';
import '../bloc/behaviour_bloc.dart';
import '../models/behaviour_models.dart';
import 'widgets/conduct_entry_card.dart';

/// Figma "1.2 Behaviour": conduct pulse, merit stats, filtered activity log (acknowledge guidance
/// notes), teacher remarks, message the class teacher and the conduct transcript.
class BehaviourScreen extends StatelessWidget {
  const BehaviourScreen({super.key});

  @override
  Widget build(BuildContext context) => ParentPageScaffold(
    title: 'Behaviour',
    body: ChildDataView<BehaviourBloc, BehaviourReport>(
      create: () => getIt<BehaviourBloc>(),
      builder: (context, report, child) =>
          _BehaviourBody(report: report, child: child),
    ),
  );
}

class _BehaviourBody extends StatefulWidget {
  const _BehaviourBody({required this.report, required this.child});
  final BehaviourReport report;
  final Child child;

  @override
  State<_BehaviourBody> createState() => _BehaviourBodyState();
}

class _BehaviourBodyState extends State<_BehaviourBody> {
  ConductFilter _filter = ConductFilter.all;

  Future<void> _acknowledge(ConductEntry e) async {
    final reply = await showAppSheet<String>(
      context,
      title: 'Acknowledge note',
      subtitle: '${e.title} • ${e.teacher}',
      builder: (_) => _AckSheet(entry: e),
    );
    if (reply == null || !mounted) return;
    context.read<BehaviourBloc>().add(AcknowledgeConduct(e.id, note: reply));
    AppDialogs.showSnackBar(
      context,
      message: 'Acknowledged. ${e.teacher} has been notified.',
    );
  }

  void _details(ConductEntry e) => showAppSheet<void>(
    context,
    title: e.title,
    subtitle: '${e.badge} • ${e.meritLabel}',
    builder: (ctx) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppInfoTile(
          icon: Icons.person_outline_rounded,
          label: 'LOGGED BY',
          value: '${e.teacher} • ${conductWhen(e.at)}',
          compact: true,
        ),
        SizedBox(height: 10.h),
        Text(e.note, style: T.body.copyWith(color: C.onSurface)),
        if (e.parentNote != null) ...[
          SizedBox(height: 10.h),
          AppInfoTile(
            icon: Icons.reply_rounded,
            label: 'YOUR REPLY',
            value: e.parentNote!,
            compact: true,
          ),
        ],
        SizedBox(height: 16.h),
        if (e.needsAck)
          AppButton(
            'Acknowledge',
            icon: Icons.done_all_rounded,
            onPressed: () {
              Navigator.of(ctx).pop();
              _acknowledge(e);
            },
          )
        else
          AppButton(
            'Close',
            kind: BtnKind.outline,
            onPressed: () => Navigator.of(ctx).pop(),
          ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final r = widget.report;
    final child = widget.child;
    final now = DateTime.now();
    final entries = r.filtered(_filter);
    final newPraise = r.newPraise(now);
    final updated = r.lastUpdated;
    return ListView(
      padding: EdgeInsets.fromLTRB(S.page, 8.h, S.page, 32.h),
      children: [
        AppSurfaceCard(
          hero: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const AppEyebrow('Overall Conduct Pulse'),
                        SizedBox(height: 8.h),
                        Text.rich(
                          TextSpan(
                            text: '${r.positiveIndex}%',
                            style: T.title.copyWith(
                              fontSize: 32.sp,
                              color: C.onSurface,
                            ),
                            children: [
                              TextSpan(
                                text: '  Positive Index',
                                style: T.h3.copyWith(color: C.primary),
                              ),
                            ],
                          ),
                        ),
                        SizedBox(height: 4.h),
                        Text(
                          r.percentile,
                          style: T.small.copyWith(color: C.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: 48.r,
                    height: 48.r,
                    decoration: BoxDecoration(
                      color: C.primary,
                      borderRadius: BorderRadius.circular(R.md),
                    ),
                    child: Icon(
                      Icons.sentiment_satisfied_alt_rounded,
                      color: Colors.white,
                      size: 26.r,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 14.h),
              Row(
                children: [
                  Expanded(
                    child: AppMetricBox(
                      icon: Icons.star_rounded,
                      badge: newPraise > 0 ? '+$newPraise new' : null,
                      value: '${r.praiseStars}',
                      label: 'Praise Stars',
                    ),
                  ),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: AppMetricBox(
                      icon: Icons.shield_outlined,
                      badge: r.activeFlags == 0 ? 'Clean' : 'Review',
                      tone: r.activeFlags == 0 ? Tone.success : Tone.warning,
                      value: '${r.activeFlags}',
                      label: 'Active Flags',
                    ),
                  ),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: AppMetricBox(
                      icon: Icons.emoji_events_outlined,
                      badge: 'Rank #${r.rank}',
                      value:
                          '${r.meritsLogged >= 0 ? '+' : ''}${r.meritsLogged}',
                      label: 'Merits Logged',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        SizedBox(height: 16.h),
        AppSolidChips(
          items: [for (final f in ConductFilter.values) f.label],
          value: _filter.label,
          labelOf: (l) {
            final f = ConductFilter.values.firstWhere((f) => f.label == l);
            return '$l (${r.count(f)})';
          },
          onChanged: (l) => setState(
            () =>
                _filter = ConductFilter.values.firstWhere((f) => f.label == l),
          ),
        ),
        SizedBox(height: 16.h),
        Row(
          children: [
            Icon(Icons.history_edu_rounded, size: 18.r, color: C.primary),
            SizedBox(width: 8.w),
            Expanded(
              child: Text(
                'Conduct Activity Log',
                style: T.h3.copyWith(color: C.onSurface),
              ),
            ),
            if (updated != null)
              Text(
                'Updated ${sameDay(updated, now) ? 'today' : fmtShort(updated)} at ${fmtClock(updated)}',
                style: T.small.copyWith(
                  color: C.onSurfaceVariant,
                  fontSize: 11.sp,
                ),
              ),
          ],
        ),
        SizedBox(height: 12.h),
        if (entries.isEmpty)
          AppSurfaceCard(
            child: Center(
              child: AppEmptyState(
                'No ${_filter.label.toLowerCase()} yet',
                icon: Icons.inbox_outlined,
              ),
            ),
          )
        else
          for (final e in entries)
            ConductEntryCard(
              key: ValueKey('conduct-${e.id}'),
              entry: e,
              onTap: () => _details(e),
              onAcknowledge: () => _acknowledge(e),
            ),
        if (r.remarks.isNotEmpty) ...[
          SizedBox(height: 4.h),
          Text('Teacher Remarks', style: T.h3.copyWith(color: C.onSurface)),
          SizedBox(height: 10.h),
          for (final m in r.remarks)
            AppSurfaceCard(
              margin: EdgeInsets.only(bottom: 10.h),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Avatar(m.teacher, size: 36, tone: Tone.purple),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          m.teacher,
                          style: T.bodyStrong.copyWith(color: C.onSurface),
                        ),
                        Text(
                          '${m.subject} • ${fmtShort(m.at)}',
                          style: T.small,
                        ),
                        SizedBox(height: 6.h),
                        Text(
                          '"${m.text}"',
                          style: T.body.copyWith(color: C.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
        SizedBox(height: 6.h),
        AppSurfaceCard(
          color: C.panel,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Have questions on ${child.firstName}'s conduct?",
                style: T.h3.copyWith(color: C.onSurface),
              ),
              SizedBox(height: 2.h),
              Text(
                'Connect directly with ${child.classTeacher}',
                style: T.small.copyWith(color: C.onSurfaceVariant),
              ),
              SizedBox(height: 12.h),
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      'Message Teacher',
                      icon: Icons.chat_bubble_outline_rounded,
                      small: true,
                      onPressed: () => context.push(
                        RoutePaths.chatWith(
                          'th_${child.id}_ct',
                          teacher: child.classTeacher,
                          role: 'Class teacher',
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: AppButton(
                      'Transcript (PDF)',
                      icon: Icons.picture_as_pdf_outlined,
                      kind: BtnKind.outline,
                      small: true,
                      onPressed: () => AppDialogs.showSnackBar(
                        context,
                        message:
                            'Conduct transcript for ${child.firstName} saved as PDF (demo)',
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Acknowledge sheet body: the teacher's note and an optional reply. Pops with the reply text.
class _AckSheet extends StatefulWidget {
  const _AckSheet({required this.entry});
  final ConductEntry entry;

  @override
  State<_AckSheet> createState() => _AckSheetState();
}

class _AckSheetState extends State<_AckSheet> {
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(widget.entry.note, style: T.body.copyWith(color: C.onSurface)),
      SizedBox(height: 14.h),
      AppTextField(
        label: 'Reply to the teacher (optional)',
        hint: 'e.g. We have spoken to him about it.',
        controller: _note,
        maxLines: 3,
        maxLength: 200,
      ),
      AppButton(
        'Acknowledge',
        icon: Icons.done_all_rounded,
        onPressed: () => Navigator.of(context).pop(_note.text),
      ),
    ],
  );
}
