import 'package:equatable/equatable.dart';

sealed class HallSeatingEvent extends Equatable {
  const HallSeatingEvent();
  @override
  List<Object?> get props => [];
}

/// Loads (and on later calls reloads) duty [dutyId] and its seated candidates.
class HallSeatingLoadRequested extends HallSeatingEvent {
  const HallSeatingLoadRequested(this.dutyId);
  final String dutyId;
  @override
  List<Object?> get props => [dutyId];
}

class CandidateMarked extends HallSeatingEvent {
  const CandidateMarked(this.candidateId, {required this.present});
  final String candidateId;
  final bool present;
  @override
  List<Object?> get props => [candidateId, present];
}

class SupplementaryChanged extends HallSeatingEvent {
  const SupplementaryChanged(this.candidateId, this.count);
  final String candidateId;
  final int count;
  @override
  List<Object?> get props => [candidateId, count];
}

class IncidentNoteSaved extends HallSeatingEvent {
  const IncidentNoteSaved(this.candidateId, this.note);
  final String candidateId, note;
  @override
  List<Object?> get props => [candidateId, note];
}

class FinalListSubmitted extends HallSeatingEvent {
  const FinalListSubmitted();
}
