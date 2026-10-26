import 'package:equatable/equatable.dart';
import '../models/classes_models.dart';

enum ResourcesStatus { initial, loading, loaded, failure }

class ResourcesState extends Equatable {
  const ResourcesState({this.status = ResourcesStatus.initial, this.resources = const [], this.portalVisible = true, this.notice, this.noticeSeq = 0, this.error});
  final ResourcesStatus status;
  final List<SharedResource> resources;
  final bool portalVisible;
  final String? notice;
  final int noticeSeq;
  final String? error;

  List<SharedResource> of(String classId) => resources.where((r) => r.classId == classId).toList();

  ResourcesState copyWith({ResourcesStatus? status, List<SharedResource>? resources, bool? portalVisible, String? notice, bool bumpNotice = false, String? error}) => ResourcesState(
        status: status ?? this.status, resources: resources ?? this.resources, portalVisible: portalVisible ?? this.portalVisible,
        notice: bumpNotice ? notice : this.notice, noticeSeq: bumpNotice ? noticeSeq + 1 : noticeSeq, error: error,
      );

  @override
  List<Object?> get props => [status, resources, portalVisible, notice, noticeSeq, error];
}
