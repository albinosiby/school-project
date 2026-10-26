import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../design_system/design_system.dart';
import '../../../../di/injection.dart';
import '../../../family/bloc/family_bloc.dart';
import '../../bloc/messages_bloc.dart';

/// Live count of unread conversations of the selected child, for other screens (home card, dock).
/// [builder] gets the count (0 while loading); it re-renders whenever a thread is read or a reply arrives.
class UnreadMessagesCount extends StatelessWidget {
  const UnreadMessagesCount({super.key, required this.builder});
  final Widget Function(BuildContext context, int count) builder;

  @override
  Widget build(BuildContext context) {
    final childId = context.select<FamilyBloc, String?>(
      (b) => b.state.selected?.id,
    );
    if (childId == null) return builder(context, 0);
    return BlocProvider<UnreadCountBloc>(
      key: ValueKey('unread:$childId'),
      create: (_) => getIt<UnreadCountBloc>()..add(LoadChildData(childId)),
      child: BlocBuilder<UnreadCountBloc, UnreadCountState>(
        builder: (context, s) => builder(context, s.data ?? 0),
      ),
    );
  }
}

/// Red count bubble on top of [child] (hidden at 0).
class UnreadMessagesBadge extends StatelessWidget {
  const UnreadMessagesBadge({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => UnreadMessagesCount(
    builder: (context, n) => Badge(
      isLabelVisible: n > 0,
      label: Text(
        '$n',
        style: T.smallStrong.copyWith(color: Colors.white, fontSize: 10.sp),
      ),
      backgroundColor: C.notificationDot,
      child: child,
    ),
  );
}
