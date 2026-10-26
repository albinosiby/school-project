import 'package:equatable/equatable.dart';
import '../models/classes_models.dart';

sealed class BehaviourEvent extends Equatable {
  const BehaviourEvent();
  @override
  List<Object?> get props => [];
}

class BehaviourLoadRequested extends BehaviourEvent {
  const BehaviourLoadRequested();
}

/// Publishes a new conduct record.
class BehaviourLogAdded extends BehaviourEvent {
  const BehaviourLogAdded(this.log, {required this.studentName});
  final BehaviourLog log;
  final String studentName;
  @override
  List<Object?> get props => [log, studentName];
}

class BehaviourParentNotified extends BehaviourEvent {
  const BehaviourParentNotified(this.log);
  final BehaviourLog log;
  @override
  List<Object?> get props => [log];
}

class BehaviourLogDeleted extends BehaviourEvent {
  const BehaviourLogDeleted(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// Adds a custom badge to the catalogue.
class BehaviourBadgeCreated extends BehaviourEvent {
  const BehaviourBadgeCreated(this.badge);
  final BehaviourBadge badge;
  @override
  List<Object?> get props => [badge];
}
