import 'package:equatable/equatable.dart';
import '../models/classes_models.dart';

enum ResourcesStatus { initial, loading, loaded, failure }

class ResourcesState extends Equatable {
  const ResourcesState({this.status = ResourcesStatus.initial, this.resources = const [], this.saving = false, this.notice, this.noticeSeq = 0, this.savedSeq = 0, this.error});
  final ResourcesStatus status;
  final List<SharedResource> resources;
  final bool saving;
  final String? notice;
  final int noticeSeq;

  /// Bumped after a resource is added or edited (the form closes on it).
  final int savedSeq;
  final String? error;

  /// The class's resources: pinned first, then newest.
  List<SharedResource> of(String classId) => [for (final r in resources) if (r.classId == classId) r]
    ..sort((a, b) => a.pinned != b.pinned ? (a.pinned ? -1 : 1) : b.createdAt.compareTo(a.createdAt));

  ResourcesState copyWith({ResourcesStatus? status, List<SharedResource>? resources, bool? saving, String? notice, bool bumpNotice = false, bool bumpSaved = false, String? error}) =>
      ResourcesState(
        status: status ?? this.status,
        resources: resources ?? this.resources,
        saving: saving ?? this.saving,
        notice: bumpNotice ? notice : this.notice,
        noticeSeq: bumpNotice ? noticeSeq + 1 : noticeSeq,
        savedSeq: bumpSaved ? savedSeq + 1 : savedSeq,
        error: error,
      );

  @override
  List<Object?> get props => [status, resources, saving, notice, noticeSeq, savedSeq, error];
}
