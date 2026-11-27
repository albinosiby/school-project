import 'package:equatable/equatable.dart';
import '../../engage/screens/widgets/attachment_sheet.dart' show PickedAttachment;
import '../models/classes_models.dart';

sealed class ResourcesEvent extends Equatable {
  const ResourcesEvent();
  @override
  List<Object?> get props => [];
}

class ResourcesLoadRequested extends ResourcesEvent {
  const ResourcesLoadRequested();
}

/// Adds a resource; for a file, [file] is uploaded first and its URL stored.
class ResourceAdded extends ResourcesEvent {
  const ResourceAdded(this.resource, {this.file});
  final SharedResource resource;
  final PickedAttachment? file;
  @override
  List<Object?> get props => [resource, file?.path];
}

/// Saves edits (title, description, subject, visibility, link).
class ResourceUpdated extends ResourcesEvent {
  const ResourceUpdated(this.resource);
  final SharedResource resource;
  @override
  List<Object?> get props => [resource];
}

/// Shares with the class's parents, or keeps to the teacher.
class ResourceVisibilityToggled extends ResourcesEvent {
  const ResourceVisibilityToggled(this.resource);
  final SharedResource resource;
  @override
  List<Object?> get props => [resource];
}

class ResourcePinToggled extends ResourcesEvent {
  const ResourcePinToggled(this.resource);
  final SharedResource resource;
  @override
  List<Object?> get props => [resource];
}

class ResourceDeleted extends ResourcesEvent {
  const ResourceDeleted(this.resource);
  final SharedResource resource;
  @override
  List<Object?> get props => [resource];
}
