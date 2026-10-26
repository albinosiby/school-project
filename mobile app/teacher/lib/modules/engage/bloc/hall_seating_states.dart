import 'package:equatable/equatable.dart';
import '../models/exam_duty_models.dart';
import 'engage_notice.dart';

class HallSeatingState extends Equatable implements NoticeState {
  const HallSeatingState({this.status = EngageStatus.initial, this.dutyId = '', this.duty, this.candidates = const [], this.notice, this.error});
  final EngageStatus status;
  final String dutyId;
  final ExamDuty? duty;
  final List<Candidate> candidates;
  @override
  final Notice? notice;
  final String? error;

  int get present => candidates.where((c) => !c.absent).length;
  int get absent => candidates.length - present;
  Candidate? byId(String id) => candidates.where((c) => c.id == id).firstOrNull;

  HallSeatingState copyWith({EngageStatus? status, String? dutyId, ExamDuty? duty, List<Candidate>? candidates, Notice? notice, String? error}) => HallSeatingState(
        status: status ?? this.status, dutyId: dutyId ?? this.dutyId, duty: duty ?? this.duty, candidates: candidates ?? this.candidates,
        notice: notice ?? this.notice, error: error,
      );

  @override
  List<Object?> get props => [status, dutyId, duty, candidates, notice, error];
}
