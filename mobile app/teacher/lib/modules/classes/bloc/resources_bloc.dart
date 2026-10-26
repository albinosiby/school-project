import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../models/classes_models.dart';
import '../repositories/resources_repository_interface.dart';
import 'resources_events.dart';
import 'resources_states.dart';

/// Shared Resources screen.
class ResourcesBloc extends Bloc<ResourcesEvent, ResourcesState> {
  ResourcesBloc(this._repo) : super(const ResourcesState()) {
    on<ResourcesLoadRequested>(_onLoad);
    on<ResourceUploaded>(_onUpload);
    on<ResourceShared>((e, emit) => _patch(emit, e.resource.copyWith(shares: e.resource.shares + 1), 'Shared with class portal'));
    on<ResourceDownloaded>((e, emit) => _patch(emit, e.resource.copyWith(downloaded: e.resource.downloaded + 1), 'Download started'));
    on<ResourcePinToggled>((e, emit) => _patch(emit, e.resource.copyWith(pinned: !e.resource.pinned), e.resource.pinned ? 'Unpinned' : 'Pinned to top'));
    on<ResourceDeleted>(_onDelete);
    on<PortalVisibilityChanged>(_onPortal);
    _sub = _repo.watch().listen((_) => add(const ResourcesLoadRequested()));
  }

  final IResourcesRepository _repo;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(ResourcesLoadRequested e, Emitter<ResourcesState> emit) async {
    if (state.status == ResourcesStatus.initial) emit(state.copyWith(status: ResourcesStatus.loading));
    try {
      emit(state.copyWith(status: ResourcesStatus.loaded, resources: await _repo.getResources(), portalVisible: await _repo.isPortalVisible()));
    } on AppException catch (err) {
      emit(state.copyWith(status: ResourcesStatus.failure, error: err.message));
    }
  }

  Future<void> _onUpload(ResourceUploaded e, Emitter<ResourcesState> emit) async {
    final n = e.fileName.trim();
    final dot = n.lastIndexOf('.');
    final hasExt = dot > 0 && n.length - dot <= 5;
    final ext = hasExt ? n.substring(dot + 1).toLowerCase() : 'pdf';
    final title = hasExt ? n.substring(0, dot) : n;
    final r = await _repo.addResource(SharedResource(
      classId: e.classId, title: '$title.$ext', category: e.category, subtitle: 'Uploaded just now', sizeKb: 400 + (n.length * 53) % 1600,
      tag: 'New Upload', uploadedAt: DateTime.now().toIso8601String(), isNew: true, ext: ext,
    ));
    emit(state.copyWith(resources: [r, ...state.resources.where((x) => x.id != r.id)], notice: 'Resource uploaded', bumpNotice: true));
  }

  Future<void> _patch(Emitter<ResourcesState> emit, SharedResource r, String notice) async {
    await _repo.updateResource(r);
    emit(state.copyWith(resources: [for (final x in state.resources) x.id == r.id ? r : x], notice: notice, bumpNotice: true));
  }

  Future<void> _onDelete(ResourceDeleted e, Emitter<ResourcesState> emit) async {
    await _repo.deleteResource(e.resource.id);
    emit(state.copyWith(resources: state.resources.where((x) => x.id != e.resource.id).toList(), notice: 'Resource deleted', bumpNotice: true));
  }

  Future<void> _onPortal(PortalVisibilityChanged e, Emitter<ResourcesState> emit) async {
    await _repo.setPortalVisible(e.visible);
    emit(state.copyWith(portalVisible: e.visible, notice: e.visible ? 'Resources visible to students' : 'Resources hidden from students', bumpNotice: true));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
