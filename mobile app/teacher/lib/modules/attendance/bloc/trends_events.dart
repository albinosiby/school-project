import 'package:equatable/equatable.dart';
import '../models/attendance_models.dart';

sealed class TrendsEvent extends Equatable {
  const TrendsEvent();
  @override
  List<Object?> get props => [];
}

class TrendsLoadRequested extends TrendsEvent {
  const TrendsLoadRequested({this.classId});
  final String? classId;
  @override
  List<Object?> get props => [classId];
}

class TrendsClassChanged extends TrendsEvent {
  const TrendsClassChanged(this.classId);
  final String classId;
  @override
  List<Object?> get props => [classId];
}

class TrendsRangeChanged extends TrendsEvent {
  const TrendsRangeChanged(this.range);
  final String range;
  @override
  List<Object?> get props => [range];
}

/// A parent notification or call was made (Notify Parent sheet / Call Parent). [chat] also posts the message in the
/// guardian's chat thread.
class TrendsNoticeSent extends TrendsEvent {
  const TrendsNoticeSent(this.notice, {this.chat = false});
  final ParentNotice notice;
  final bool chat;
  @override
  List<Object?> get props => [notice, chat];
}
