import 'package:equatable/equatable.dart';

sealed class ClassManagementEvent extends Equatable {
  const ClassManagementEvent();
  @override
  List<Object?> get props => [];
}

class ClassManagementLoadRequested extends ClassManagementEvent {
  const ClassManagementLoadRequested(this.classId);
  final String classId;
  @override
  List<Object?> get props => [classId];
}

class ClassManagementRefreshed extends ClassManagementEvent {
  const ClassManagementRefreshed();
}

/// The class teacher approved or rejected a leave request ([note] is shown to the parent).
class ClassLeaveDecided extends ClassManagementEvent {
  const ClassLeaveDecided(this.id, {required this.approve, this.note = ''});
  final String id, note;
  final bool approve;
  @override
  List<Object?> get props => [id, approve, note];
}
