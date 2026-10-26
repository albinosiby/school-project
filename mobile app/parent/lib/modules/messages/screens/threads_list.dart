import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/threads_bloc.dart';
import '../models/message_models.dart';

class ThreadsList extends StatelessWidget {
  const ThreadsList({super.key});

  @override
  Widget build(BuildContext context) =>
      ChildDataView<ThreadsBloc, List<MessageThread>>(
        create: () => getIt<ThreadsBloc>(),
        isEmpty: (d) => d.isEmpty,
        emptyTitle: 'No conversations',
        emptyHint: 'Messages with your child\'s teachers will appear here.',
        emptyIcon: Icons.chat_bubble_outline_rounded,
        builder: (context, data, child) => AppTabBody(
          children: [
            for (final t in data)
              Padding(
                padding: EdgeInsets.only(bottom: 10.h),
                child: AppCard(
                  key: ValueKey('thread-${t.id}'),
                  padding: EdgeInsets.all(12.w),
                  onTap: () => context.push(
                    RoutePaths.chatWith(t.id, teacher: t.teacher, role: t.role),
                  ),
                  child: Row(
                    children: [
                      Avatar(t.teacher, size: 46, tone: Tone.purple),
                      SizedBox(width: 12.w),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    t.teacher,
                                    style: T.bodyStrong,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Text(relTime(t.lastAt), style: T.small),
                              ],
                            ),
                            Text(
                              t.role,
                              style: T.small.copyWith(
                                color: C.primary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            SizedBox(height: 2.h),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    t.lastMessage,
                                    style: T.body,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                if (t.unread > 0)
                                  Container(
                                    margin: EdgeInsets.only(left: 8.w),
                                    padding: EdgeInsets.symmetric(
                                      horizontal: 7.w,
                                      vertical: 2.h,
                                    ),
                                    decoration: BoxDecoration(
                                      color: C.primary,
                                      borderRadius: BorderRadius.circular(
                                        R.pill,
                                      ),
                                    ),
                                    child: Text(
                                      '${t.unread}',
                                      style: T.small.copyWith(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ],
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
