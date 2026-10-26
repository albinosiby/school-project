import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../family/screens/widgets/child_switcher.dart';
import '../bloc/leave_bloc.dart';
import '../models/leave_models.dart';

Tone leaveTone(LeaveStatus s) => switch (s) {
  LeaveStatus.pending => Tone.warning,
  LeaveStatus.approved => Tone.success,
  LeaveStatus.rejected => Tone.danger,
};

class LeaveScreen extends StatelessWidget {
  const LeaveScreen({super.key});

  @override
  Widget build(BuildContext context) => DetailScaffold(
    title: 'Leave',
    subtitle: 'Applications and history',
    fallbackRoute: RoutePaths.more,
    bottom: AppButton(
      'Apply for leave',
      icon: Icons.add_rounded,
      onPressed: () => context.push(RoutePaths.leaveApply),
    ),
    body: Column(
      children: [
        const ChildSwitcher(),
        Expanded(
          child: ChildDataView<LeaveBloc, List<LeaveRequest>>(
            create: () => getIt<LeaveBloc>(),
            isEmpty: (d) => d.isEmpty,
            emptyTitle: 'No leave applications',
            emptyHint:
                'Tap "Apply for leave" to send one to the class teacher.',
            emptyIcon: Icons.beach_access_outlined,
            builder: (context, data, child) => ListView(
              padding: EdgeInsets.fromLTRB(S.page, 8.h, S.page, 24.h),
              children: [
                for (final r in data)
                  Padding(
                    padding: EdgeInsets.only(bottom: 10.h),
                    child: AppCard(
                      padding: EdgeInsets.all(14.w),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  r.from == r.to
                                      ? fmtDate(r.from, year: true)
                                      : '${fmtShort(r.from)} - ${fmtDate(r.to, year: true)}',
                                  style: T.h3,
                                ),
                              ),
                              Pill(
                                r.status.label,
                                tone: leaveTone(r.status),
                                dot: true,
                              ),
                            ],
                          ),
                          SizedBox(height: 2.h),
                          Text(
                            '${r.days} day${r.days == 1 ? '' : 's'} - applied ${fmtShort(r.appliedOn)}',
                            style: T.small,
                          ),
                          SizedBox(height: 8.h),
                          Text(r.reason, style: T.body.copyWith(color: C.ink)),
                          if (r.reviewerNote != null) ...[
                            SizedBox(height: 8.h),
                            AppInfoTile(
                              icon: Icons.comment_outlined,
                              label: 'TEACHER NOTE',
                              value: r.reviewerNote!,
                              compact: true,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}
