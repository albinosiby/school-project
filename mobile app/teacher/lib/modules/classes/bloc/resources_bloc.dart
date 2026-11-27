import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../engage/repositories/chat_media_repository.dart';
import '../models/classes_models.dart';
import '../repositories/resources_repository_interface.dart';
import 'resources_events.dart';
import 'resources_states.dart';

/// Class resources: files (uploaded to the teacher's class-resources folder), YouTube videos and links, each shared
/// with the class's parents or kept to the teacher.
class ResourcesBloc extends Bloc<ResourcesEvent, ResourcesState> {
  ResourcesBloc(this._repo, [this._media]) : super(const ResourcesState()) {
    on<ResourcesLoadRequested>(_onLoad);
    on<ResourceAdded>(_onAdded);
    on<ResourceUpdated>((e, emit) async {
      await _repo.updateResource(e.resource);
      emit(state.copyWith(notice: 'Saved', bumpNotice: true, bumpSaved: true));
    });
    on<ResourceVisibilityToggled>((e, emit) async {
      final next = e.resource.forParents ? 'private' : 'parents';
      await _repo.updateResource(e.resource.copyWith(visibility: next));
      emit(state.copyWith(notice: next == 'parents' ? 'Shared with parents' : 'Now visible only to you', bumpNotice: true));
    });
    on<ResourcePinToggled>((e, emit) => _repo.updateResource(e.resource.copyWith(pinned: !e.resource.pinned)));
    on<ResourceDeleted>((e, emit) async {
      await _repo.deleteResource(e.resource.id);
      emit(state.copyWith(notice: 'Deleted', bumpNotice: true));
    });
    _sub = _repo.watch().listen((_) => add(const ResourcesLoadRequested()));
  }

  final IResourcesRepository _repo;
  final IChatMediaRepository? _media;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(ResourcesLoadRequested e, Emitter<ResourcesState> emit) async {
    if (state.status == ResourcesStatus.initial) emit(state.copyWith(status: ResourcesStatus.loading));
    emit(state.copyWith(status: ResourcesStatus.loaded, resources: await _repo.getResources()));
  }

  Future<void> _onAdded(ResourceAdded e, Emitter<ResourcesState> emit) async {
    emit(state.copyWith(saving: true));
    try {
      var r = e.resource;
      final f = e.file;
      if (f != null) {
        final media = _media;
        if (media == null) throw StateError('Uploads are not available here.');
        final up = await media.uploadMaterial(path: f.path, name: f.name, folder: 'class-resources');
        r = SharedResource.fromJson({
          ...r.toJson(),
          'url': up.url.isEmpty ? f.path : up.url,
          'path': up.path,
          'fileName': f.name,
          'mime': up.contentType.isEmpty ? (f.mimeType ?? '') : up.contentType,
          'sizeBytes': f.bytes,
        });
      }
      await _repo.addResource(r);
      emit(state.copyWith(saving: false, notice: r.forParents ? 'Shared with the class\'s parents' : 'Added — visible only to you', bumpNotice: true, bumpSaved: true));
    } catch (err) {
      emit(state.copyWith(saving: false, notice: 'Could not add the resource. ${err is StateError ? err.message : 'Check your connection.'}', bumpNotice: true));
    }
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
