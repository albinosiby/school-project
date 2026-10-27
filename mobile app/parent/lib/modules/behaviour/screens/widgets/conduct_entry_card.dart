import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../models/behaviour_models.dart';

IconData conductIcon(ConductCategory c) => switch (c) {
  ConductCategory.academic => Icons.school_outlined,
  ConductCategory.diligence => Icons.task_alt_rounded,
  ConductCategory.civic => Icons.volunteer_activism_outlined,
  ConductCategory.punctuality => Icons.alarm_on_rounded,
  ConductCategory.sports => Icons.sports_soccer_rounded,
  ConductCategory.conduct => Icons.flag_outlined,
};

Tone conductTone(ConductEntry e) => !e.isPraise
    ? (e.needsAck ? Tone.warning : Tone.neutral)
    : (e.commendation ? Tone.purple : Tone.brand);

String conductWhen(DateTime at, {DateTime? now}) {
  final n = now ?? DateTime.now();
  final d = n.difference(dateOnly(at)).inDays;
  final day = sameDay(at, n) ? 'Today' : (d == 1 ? 'Yesterday' : fmtShort(at));
  return '$day, ${fmtClock(at)}';
}

/// One entry of the "Conduct Activity Log" (Figma timeline card) with its acknowledge action.
class ConductEntryCard extends StatelessWidget {
  const ConductEntryCard({
    super.key,
    required this.entry,
    required this.onTap,
    required this.onAcknowledge,
  });
  final ConductEntry entry;
  final VoidCallback onTap, onAcknowledge;

  @override
  Widget build(BuildContext context) {
    final e = entry;
    final tone = conductTone(e);
    final c = toneColors(tone);
    final fg = tone == Tone.brand ? C.primary : c.fg;
    return AppEntryCard(
      icon: conductIcon(e.category),
      title: e.title,
      tone: tone,
      onTap: onTap,
      badge: Container(
        padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
        decoration: BoxDecoration(
          color: (tone == Tone.brand ? C.indigoSoft : c.bg).withValues(
            alpha: .6,
          ),
          borderRadius: BorderRadius.circular(R.sm),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              e.isPraise ? Icons.star_rounded : Icons.info_outline_rounded,
              size: 12.r,
              color: e.isPraise ? C.amber : fg,
            ),
            SizedBox(width: 4.w),
            Text(
              e.badge,
              style: T.small.copyWith(fontSize: 11.sp, color: fg),
            ),
          ],
        ),
      ),
      meta: '${e.teacher} • ${conductWhen(e.at)}',
      trailing: Container(
        padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
        decoration: BoxDecoration(
          color: (tone == Tone.brand ? C.indigoSoft : c.bg).withValues(
            alpha: .7,
          ),
          borderRadius: BorderRadius.circular(R.pill),
          border: Border.all(color: fg.withValues(alpha: .25)),
        ),
        child: Text(e.meritLabel, style: T.smallStrong.copyWith(color: fg)),
      ),
      body: e.note,
      footer: [
        for (final t in e.tags)
          AppMetaChip(
            t,
            icon: Icons.folder_open_outlined,
            color: C.onSurfaceVariant,
          ),
        if (e.verified != null)
          AppMetaChip(
            e.verified!,
            icon: Icons.verified_outlined,
            color: C.primary,
          ),
        if (e.needsAck)
          Semantics(
            button: true,
            label: 'Acknowledge ${e.title}',
            child: InkWell(
              key: ValueKey('ack-${e.id}'),
              borderRadius: BorderRadius.circular(R.pill),
              onTap: onAcknowledge,
              child: Container(
                constraints: BoxConstraints(minHeight: 32.h),
                padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
                decoration: BoxDecoration(
                  color: C.primary,
                  borderRadius: BorderRadius.circular(R.pill),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.done_all_rounded,
                      size: 14.r,
                      color: Colors.white,
                    ),
                    SizedBox(width: 5.w),
                    Text(
                      'Acknowledge',
                      style: T.smallStrong.copyWith(color: Colors.white),
                    ),
                  ],
                ),
              ),
            ),
          )
        else if (e.requiresAck)
          AppMetaChip(
            'Acknowledged',
            icon: Icons.check_circle_outline_rounded,
            color: C.emerald,
          ),
      ],
    );
  }
}
