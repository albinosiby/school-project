import 'package:equatable/equatable.dart';
import '../models/more_models.dart';

enum MoreStatus { initial, loading, loaded, failure }

class MoreState extends Equatable {
  const MoreState({this.status = MoreStatus.initial, this.summary = const MoreSummary(), this.error});
  final MoreStatus status;
  final MoreSummary summary;
  final String? error;

  MoreState copyWith({MoreStatus? status, MoreSummary? summary, String? error}) =>
      MoreState(status: status ?? this.status, summary: summary ?? this.summary, error: error);

  @override
  List<Object?> get props => [status, summary, error];
}
