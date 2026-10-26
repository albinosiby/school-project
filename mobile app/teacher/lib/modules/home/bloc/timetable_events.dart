import 'package:equatable/equatable.dart';

sealed class TimetableEvent extends Equatable {
  const TimetableEvent();
  @override
  List<Object?> get props => [];
}

class TimetableLoadRequested extends TimetableEvent {
  const TimetableLoadRequested();
}

/// "Sync Calendar" / pull-to-refresh.
class TimetableSyncRequested extends TimetableEvent {
  const TimetableSyncRequested();
}
