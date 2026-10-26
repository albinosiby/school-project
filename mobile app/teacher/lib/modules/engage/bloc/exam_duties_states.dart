import 'package:equatable/equatable.dart';
import '../models/exam_duty_models.dart';
import 'engage_notice.dart';

class ExamDutiesState extends Equatable implements NoticeState {
  const ExamDutiesState({this.status = EngageStatus.initial, this.duties = const [], this.notice, this.error});
  final EngageStatus status;
  final List<ExamDuty> duties;
  @override
  final Notice? notice;
  final String? error;

  /// All duties, soonest first.
  List<ExamDuty> get all => [...duties]..sort((a, b) => a.sortKey.compareTo(b.sortKey));
  List<ExamDuty> get upcoming => all.where((e) => e.upcoming).toList();

  /// Completed duties, most recent first.
  List<ExamDuty> get completed => all.where((e) => e.completed).toList().reversed.toList();
  List<ExamDuty> get swaps => all.where((e) => e.swapRequested).toList();
  ExamDuty? get next => upcoming.firstOrNull;

  ExamDuty? byId(String id) => duties.where((e) => e.id == id).firstOrNull;

  ExamDutiesState copyWith({EngageStatus? status, List<ExamDuty>? duties, Notice? notice, String? error}) =>
      ExamDutiesState(status: status ?? this.status, duties: duties ?? this.duties, notice: notice ?? this.notice, error: error);

  @override
  List<Object?> get props => [status, duties, notice, error];
}
