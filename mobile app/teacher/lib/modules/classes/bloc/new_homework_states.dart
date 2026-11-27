import 'package:equatable/equatable.dart';
import '../../tasks/models/homework_models.dart';

enum NewHomeworkStatus { initial, ready, saving, saved, failure }

class NewHomeworkState extends Equatable {
  const NewHomeworkState({this.status = NewHomeworkStatus.initial, this.existing = const [], this.message, this.saved, this.editing});
  final NewHomeworkStatus status;
  final List<Homework> existing;
  final String? message;
  final Homework? saved;

  /// The homework being edited (null when setting a new one).
  final Homework? editing;

  int countFor(String classId) => existing.where((h) => h.classId == classId).length;

  NewHomeworkState copyWith({NewHomeworkStatus? status, List<Homework>? existing, String? message, Homework? saved, Homework? editing}) => NewHomeworkState(
    status: status ?? this.status,
    existing: existing ?? this.existing,
    message: message,
    saved: saved ?? this.saved,
    editing: editing ?? this.editing,
  );

  @override
  List<Object?> get props => [status, existing, message, saved, editing];
}
