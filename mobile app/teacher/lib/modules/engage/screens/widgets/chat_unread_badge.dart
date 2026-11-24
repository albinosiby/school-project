import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../design_system/design_system.dart';
import '../../../../di/injection.dart';
import '../../../../utils/services/data_store.dart';

/// Unread conversations across the inbox (`ms_messages.unread`, the same number the thread rows show).
class ChatUnreadCubit extends Cubit<int> {
  ChatUnreadCubit(this._db) : super(0) {
    _refresh();
    _sub = _db.watch({'ms_messages'}).listen((_) => _refresh());
  }
  final DataStore _db;
  late final StreamSubscription<void> _sub;

  void _refresh() {
    var n = 0;
    for (final t in _db.list('ms_messages')) {
      n += ((t['unread'] as num?)?.toInt() ?? 0) > 0 ? 1 : 0;
    }
    if (!isClosed) emit(n);
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}

/// Red count badge over the Chat tab icon; hidden at zero. Creates its own cubit so it works in any host.
class ChatUnreadBadge extends StatefulWidget {
  const ChatUnreadBadge({super.key, required this.child});
  final Widget child;
  @override
  State<ChatUnreadBadge> createState() => _ChatUnreadBadgeState();
}

class _ChatUnreadBadgeState extends State<ChatUnreadBadge> {
  late final ChatUnreadCubit _cubit = ChatUnreadCubit(getIt<DataStore>());
  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => BlocBuilder<ChatUnreadCubit, int>(
        bloc: _cubit,
        builder: (_, n) => Badge(
          isLabelVisible: n > 0,
          backgroundColor: C.danger,
          textColor: Colors.white,
          label: Text(n > 99 ? '99+' : '$n', style: T.small.copyWith(color: Colors.white, fontSize: 10.sp, fontWeight: FontWeight.w800)),
          offset: Offset(8.w, -6.h),
          child: widget.child,
        ),
      );
}
