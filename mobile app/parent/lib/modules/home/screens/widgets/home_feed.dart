import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../../homework/models/homework_models.dart';
import '../../../notices/models/notice_models.dart';

/// Title row of a Home section with an optional trailing widget / link.
class HomeSectionTitle extends StatelessWidget {
  const HomeSectionTitle(
    this.title, {
    super.key,
    this.sub,
    this.trailing,
    this.action,
    this.onAction,
  });
  final String title;
  final String? sub, action;
  final Widget? trailing;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(top: 20.h, bottom: 10.h),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.h2.copyWith(color: C.ink),
                    ),
                  ),
                  if (trailing != null) ...[SizedBox(width: 8.w), trailing!],
                ],
              ),
              if (sub != null)
                Text(sub!, style: T.small.copyWith(color: C.muted)),
            ],
          ),
        ),
        if (action != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              minimumSize: Size(44.w, 44.h),
              padding: EdgeInsets.symmetric(horizontal: 6.w),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  action!,
                  style: T.smallStrong.copyWith(
                    color: C.primary,
                    fontSize: 13.sp,
                  ),
                ),
                SizedBox(width: 2.w),
                Icon(Icons.arrow_forward_rounded, size: 16.r, color: C.primary),
              ],
            ),
          ),
      ],
    ),
  );
}

/// Homework row: subject • teacher, title, status pill and due line.
class HomeTaskRow extends StatelessWidget {
  const HomeTaskRow({super.key, required this.homework, required this.now});
  final Homework homework;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final h = homework;
    final status = h.statusAt(now);
    final (label, tone) = switch (status) {
      HomeworkStatus.submitted => ('Under Review', Tone.success),
      HomeworkStatus.reviewed => ('Reviewed', Tone.success),
      HomeworkStatus.overdue => ('Overdue', Tone.danger),
      HomeworkStatus.pending => ('Pending', Tone.warning),
    };
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppElevatedCard(
        padding: EdgeInsets.all(14.w),
        onTap: () => context.push(RoutePaths.homework(h.id)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      text: h.subject,
                      style: T.smallStrong.copyWith(color: C.primary),
                      children: [
                        TextSpan(
                          text: '  •  ',
                          style: T.small.copyWith(color: C.border),
                        ),
                        TextSpan(text: h.teacher, style: T.small),
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Pill(label, tone: tone),
              ],
            ),
            SizedBox(height: 6.h),
            Text(
              h.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: T.bodyStrong.copyWith(color: C.ink),
            ),
            SizedBox(height: 6.h),
            Row(
              children: [
                Icon(Icons.schedule_rounded, size: 13.r, color: C.muted),
                SizedBox(width: 4.w),
                Expanded(
                  child: Text(
                    'Due ${fmtDay(h.due, now: now)}',
                    style: T.small.copyWith(color: C.muted),
                  ),
                ),
                if (h.submitted)
                  Text(
                    'Turned in',
                    style: T.smallStrong.copyWith(color: C.emerald),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Announcement / event card (first notice large, others compact).
class HomeNoticeCard extends StatelessWidget {
  const HomeNoticeCard({super.key, required this.notice, this.hero = false});
  final Notice notice;
  final bool hero;

  @override
  Widget build(BuildContext context) {
    final n = notice;
    final tone = switch (n.category) {
      NoticeCategory.urgent => Tone.danger,
      NoticeCategory.event => Tone.purple,
      NoticeCategory.exam => Tone.warning,
      NoticeCategory.holiday => Tone.success,
      NoticeCategory.general => Tone.brand,
    };
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppElevatedCard(
        padding: EdgeInsets.all(14.w),
        onTap: () => context.push(RoutePaths.notification(n.id)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            IconTile(
              n.category == NoticeCategory.event
                  ? Icons.event_rounded
                  : Icons.campaign_outlined,
              tone: tone,
              size: hero ? 44 : 38,
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Pill(n.category.label, tone: tone),
                      const Spacer(),
                      if (n.needsAction)
                        const Pill('Action', tone: Tone.warning, dot: true),
                    ],
                  ),
                  SizedBox(height: 6.h),
                  Text(
                    n.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: (hero ? T.h3 : T.bodyStrong).copyWith(color: C.ink),
                  ),
                  SizedBox(height: 2.h),
                  Text(
                    fmtDay(n.date),
                    style: T.smallStrong.copyWith(color: C.onSurfaceVariant),
                  ),
                  Text(
                    'From: ${n.from}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.small.copyWith(color: C.muted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "Need Help or Support?" card: opens the helpdesk sheet (calls and email are simulated).
class HomeSupportCard extends StatelessWidget {
  const HomeSupportCard({super.key});

  static const _desks = [
    ('Accounts Office', 'Fees, receipts and refunds', '+91 11 4055 1200'),
    ('Transport Desk', 'Bus routes, timings and passes', '+91 11 4055 1210'),
    ('Portal Helpdesk', 'Login and app issues', 'helpdesk@greenfield.edu.in'),
  ];

  Future<void> _open(BuildContext context) async {
    final desk = await showPickSheet<(String, String, String)>(
      context,
      title: 'Contact support',
      useRootNavigator: true,
      items: _desks,
      label: (d) => d.$1,
      sub: (d) => '${d.$2} • ${d.$3}',
    );
    if (desk == null || !context.mounted) return;
    AppDialogs.showSnackBar(
      context,
      message: desk.$3.contains('@')
          ? 'Email to ${desk.$1} started (${desk.$3})'
          : 'Calling ${desk.$1} (${desk.$3})…',
    );
  }

  @override
  Widget build(BuildContext context) => AppElevatedCard(
    padding: EdgeInsets.all(14.w),
    child: Row(
      children: [
        IconTile(Icons.support_agent_rounded, size: 40),
        SizedBox(width: 12.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Need Help or Support?',
                style: T.bodyStrong.copyWith(color: C.ink),
              ),
              Text(
                'Accounts, Transport, or Portal Helpdesk',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: T.small.copyWith(color: C.muted),
              ),
            ],
          ),
        ),
        SizedBox(width: 8.w),
        AppButton(
          'Support',
          kind: BtnKind.outline,
          expand: false,
          small: true,
          onPressed: () => _open(context),
        ),
      ],
    ),
  );
}
