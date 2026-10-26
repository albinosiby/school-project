import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../../school/models/school_models.dart';
import '../../models/timetable_models.dart';

/// Hero card of the Home tab: live period with progress and quick actions (or the break / free state).
class NowCard extends StatelessWidget {
  const NowCard({super.key, required this.now, required this.today, required this.classOf});
  final SchoolNow now;
  final List<Period> today;
  final SchoolClass? Function(String? id) classOf;

  @override
  Widget build(BuildContext context) {
    final info = nowInfo(today, now);
    final live = info.live;
    final next = info.next;
    if (live == null) {
      final b = info.brk;
      return PanelCard(
        padding: EdgeInsets.all(18.r),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Pill(b != null ? b.label!.toUpperCase() : (now.minute < kSlots.first.startMin ? 'SCHOOL DAY NOT STARTED' : 'NO CLASS RIGHT NOW'), tone: Tone.warning, dot: true),
          SizedBox(height: 12.h),
          Text(b != null ? 'Break until ${t12(b.end)}' : 'No class in progress', style: T.h1),
          SizedBox(height: 4.h),
          Text(next == null ? 'You have no more periods today.' : 'Your next class starts at ${t12(slotOf(next.slot).start)}.', style: T.body),
          if (next != null) _NextRow(next, classOf(next.classId)),
        ]),
      );
    }
    final cls = classOf(live.classId);
    final slot = slotOf(live.slot);
    final done = (now.minute - slot.startMin).clamp(0, slot.length);
    final pct = done / slot.length;
    return PanelCard(
      padding: EdgeInsets.all(18.r),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(spacing: 8.w, runSpacing: 8.h, children: [
          Pill('NOW HAPPENING • PERIOD ${live.no}', tone: Tone.brand, dot: true),
          _OutlinePill('${t12(slot.start, suffix: false)} – ${t12(slot.end)}'),
        ]),
        SizedBox(height: 14.h),
        Row(children: [
          Expanded(child: Text(cls != null ? 'Grade ${cls.grade} – Section ${cls.section}' : live.label, style: T.title.copyWith(fontSize: 19.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
          SizedBox(width: 8.w),
          _OutlinePill(live.room),
        ]),
        SizedBox(height: 4.h),
        Text('${cls?.subject ?? live.subject} • ${live.topic.isNotEmpty ? live.topic : cls?.topic ?? ''}', style: T.body.copyWith(fontSize: 15.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
        SizedBox(height: 14.h),
        Container(
          padding: EdgeInsets.all(14.r),
          decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.panelBorder)),
          child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('Period Progress', style: T.small),
              SizedBox(width: 8.w),
              Flexible(
                child: Text.rich(
                  TextSpan(children: [
                    TextSpan(text: '$done of ${slot.length} mins ', style: T.smallStrong),
                    TextSpan(text: '(${(pct * 100).round()}%)', style: T.smallStrong.copyWith(color: C.primary)),
                  ]),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                ),
              ),
            ]),
            SizedBox(height: 10.h),
            AppProgress(pct),
          ]),
        ),
        SizedBox(height: 14.h),
        AppButton('Mark Attendance', icon: Icons.how_to_reg_outlined, onPressed: () => context.push(RoutePaths.attendanceMark)),
        SizedBox(height: 10.h),
        AppButton('View Lesson Plan', icon: Icons.menu_book_outlined, kind: BtnKind.outline, onPressed: () => context.push(RoutePaths.lessonPlans)),
        if (next != null) _NextRow(next, classOf(next.classId)),
      ]),
    );
  }
}

class _OutlinePill extends StatelessWidget {
  const _OutlinePill(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
        decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: C.panelBorder)),
        child: Text(text, style: T.smallStrong.copyWith(color: C.primary), maxLines: 1, overflow: TextOverflow.ellipsis),
      );
}

class _NextRow extends StatelessWidget {
  const _NextRow(this.next, this.cls);
  final Period next;
  final SchoolClass? cls;
  @override
  Widget build(BuildContext context) {
    final what = cls != null ? 'Grade ${cls!.grade}–${cls!.section} ${cls!.subject}' : '${next.label} ${next.subject}';
    return Container(
      margin: EdgeInsets.only(top: 12.h),
      padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
      decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.panelBorder)),
      child: Row(children: [
        Icon(Icons.arrow_forward_rounded, size: 16.r, color: C.primary),
        SizedBox(width: 8.w),
        Expanded(
          child: Text.rich(
            TextSpan(children: [TextSpan(text: 'Next: ', style: T.smallStrong), TextSpan(text: 'Period ${next.no} • $what (${next.room})', style: T.small)]),
            maxLines: 1, overflow: TextOverflow.ellipsis,
          ),
        ),
        SizedBox(width: 8.w),
        Text(t12(slotOf(next.slot).start), style: T.smallStrong.copyWith(color: C.primary)),
      ]),
    );
  }
}

/// Horizontal "Today's Schedule" cards (done / in progress / upcoming / breaks).
class ScheduleStrip extends StatelessWidget {
  const ScheduleStrip({super.key, required this.now, required this.today, this.onTap});
  final SchoolNow now;
  final List<Period> today;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final bySlot = {for (final p in today) p.slot: p};
    final items = <Widget>[];
    for (final sl in kSlots) {
      final st = statusOf(sl, now.day, now);
      if (sl.isBreak) {
        items.add(_card(sl.id == 'LNC' ? 'Lunch' : 'Break', sl.id == 'LNC' ? 'Lunch' : 'Recess', t12(sl.start), st, brk: true));
        continue;
      }
      final p = bySlot[sl.id];
      if (p == null) continue;
      items.add(_card('Period ${p.no}', '${p.label} ${p.short}', '${t12(sl.start)} • ${p.room}', st));
    }
    return SizedBox(
      height: 112.h,
      child: ListView.separated(
        scrollDirection: Axis.horizontal, padding: EdgeInsets.only(right: 4.w), itemCount: items.length,
        separatorBuilder: (_, _) => SizedBox(width: 10.w), itemBuilder: (_, i) => items[i],
      ),
    );
  }

  Widget _card(String top, String title, String sub, PStatus st, {bool brk = false}) {
    final live = st == PStatus.live;
    final fg = live ? Colors.white : C.ink;
    return SizedBox(
      width: 148.w,
      child: AppCard(
        onTap: onTap, radius: R.lg, padding: EdgeInsets.all(12.r),
        color: live ? C.primaryDark : (brk ? C.warningSoft : C.bg), border: live ? C.primaryDark : (brk ? C.warningSoft : C.border),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Row(children: [
            Expanded(
              child: Text(live ? 'IN PROGRESS' : top,
                  style: T.small.copyWith(color: live ? Colors.white : (brk ? C.warningDark : C.slate), fontWeight: live ? FontWeight.w800 : FontWeight.w600),
                  maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            if (st == PStatus.done) Icon(Icons.check_circle_outline_rounded, size: 20.r, color: C.success),
          ]),
          Text(title, style: T.h3.copyWith(color: fg), maxLines: 1, overflow: TextOverflow.ellipsis),
          Text(sub, style: T.small.copyWith(color: live ? Colors.white70 : C.slate), maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
      ),
    );
  }
}
