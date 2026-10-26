import 'package:equatable/equatable.dart';
import '../models/classes_models.dart';

sealed class ResourcesEvent extends Equatable {
  const ResourcesEvent();
  @override
  List<Object?> get props => [];
}

class ResourcesLoadRequested extends ResourcesEvent {
  const ResourcesLoadRequested();
}

/// Uploads [fileName] (extension parsed from the name, pdf by default) to [classId].
class ResourceUploaded extends ResourcesEvent {
  const ResourceUploaded({required this.classId, required this.fileName, required this.category});
  final String classId, fileName, category;
  @override
  List<Object?> get props => [classId, fileName, category];
}

class ResourceShared extends ResourcesEvent {
  const ResourceShared(this.resource);
  final SharedResource resource;
  @override
  List<Object?> get props => [resource];
}

class ResourceDownloaded extends ResourcesEvent {
  const ResourceDownloaded(this.resource);
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

class PortalVisibilityChanged extends ResourcesEvent {
  const PortalVisibilityChanged(this.visible);
  final bool visible;
  @override
  List<Object?> get props => [visible];
}
