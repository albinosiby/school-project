import 'package:equatable/equatable.dart';
import '../../tasks/models/homework_models.dart';

enum NewHomeworkStatus { initial, ready, saving, saved, failure }

class NewHomeworkState extends Equatable {
  const NewHomeworkState({this.status = NewHomeworkStatus.initial, this.existing = const [], this.message, this.saved});
  final NewHomeworkStatus status;
  final List<Homework> existing;
  final String? message;
  final Homework? saved;

  /// Number of homework already created for [classId] (drafts included).
  int countFor(String classId) => existing.where((h) => h.classId == classId).length;

  NewHomeworkState copyWith({NewHomeworkStatus? status, List<Homework>? existing, String? message, Homework? saved}) =>
      NewHomeworkState(status: status ?? this.status, existing: existing ?? this.existing, message: message, saved: saved ?? this.saved);

  @override
  List<Object?> get props => [status, existing, message, saved];
}
