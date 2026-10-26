import 'package:equatable/equatable.dart';

/// What the screen should do after an action finished.
enum NoticeAction { none, pop, popTwice, openPreview }

/// One-shot feedback emitted by the lessons BLoCs. [id] increases so equal messages still fire listeners.
class Notice extends Equatable {
  const Notice(this.id, this.message, {this.action = NoticeAction.none});
  final int id;
  final String message;
  final NoticeAction action;

  @override
  List<Object?> get props => [id, message, action];
}
