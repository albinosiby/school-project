import 'package:equatable/equatable.dart';
import '../../../utils/helpers/date_helper.dart';

enum HomeworkStatus { pending, submitted, reviewed, overdue }

extension HomeworkStatusX on HomeworkStatus {
  String get label => switch (this) {
    HomeworkStatus.pending => 'Pending',
    HomeworkStatus.submitted => 'Submitted',
    HomeworkStatus.reviewed => 'Reviewed',
    HomeworkStatus.overdue => 'Overdue',
  };
}

class Homework extends Equatable {
  const Homework({
    required this.id,
    required this.subject,
    required this.title,
    required this.description,
    required this.assignedOn,
    required this.due,
    required this.teacher,
    this.submitted = false,
    this.reviewed = false,
    this.attachments = const [],
    this.remark,
    this.score,
  });
  final String id, subject, title, description, teacher;
  final DateTime assignedOn, due;
  final bool submitted, reviewed;
  final List<String> attachments;
  final String? remark, score;

  /// Derived from the clock: not submitted and past due -> overdue.
  HomeworkStatus statusAt(DateTime now) {
    if (reviewed) return HomeworkStatus.reviewed;
    if (submitted) return HomeworkStatus.submitted;
    return dateOnly(due).isBefore(dateOnly(now))
        ? HomeworkStatus.overdue
        : HomeworkStatus.pending;
  }

  @override
  List<Object?> get props => [
    id,
    subject,
    title,
    description,
    teacher,
    assignedOn,
    due,
    submitted,
    reviewed,
    attachments,
    remark,
    score,
  ];
}
