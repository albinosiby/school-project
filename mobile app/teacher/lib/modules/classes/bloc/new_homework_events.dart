import 'package:equatable/equatable.dart';
import '../../tasks/models/homework_models.dart';

sealed class NewHomeworkEvent extends Equatable {
  const NewHomeworkEvent();
  @override
  List<Object?> get props => [];
}

/// Loads existing homework (used to number the next assignment code per class).
class NewHomeworkLoadRequested extends NewHomeworkEvent {
  const NewHomeworkLoadRequested();
}

/// Creates the homework through IHomeworkRepository. `status` is 'open' (publish) or 'draft'.
class NewHomeworkSubmitted extends NewHomeworkEvent {
  const NewHomeworkSubmitted(this.homework, {required this.enrolled});
  final Homework homework;
  final int enrolled;
  @override
  List<Object?> get props => [homework, enrolled];
}
