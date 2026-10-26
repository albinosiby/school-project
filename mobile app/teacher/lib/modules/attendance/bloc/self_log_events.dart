import 'package:equatable/equatable.dart';
import '../models/attendance_models.dart';

sealed class SelfLogEvent extends Equatable {
  const SelfLogEvent();
  @override
  List<Object?> get props => [];
}

class SelfLogLoadRequested extends SelfLogEvent {
  const SelfLogLoadRequested();
}

/// Punch in now at [time] (HH:mm).
class SelfLogPunchedIn extends SelfLogEvent {
  const SelfLogPunchedIn(this.time);
  final String time;
  @override
  List<Object?> get props => [time];
}

class SelfLogPunchedOut extends SelfLogEvent {
  const SelfLogPunchedOut(this.time);
  final String time;
  @override
  List<Object?> get props => [time];
}

class SelfLogRegularizationSubmitted extends SelfLogEvent {
  const SelfLogRegularizationSubmitted(this.request);
  final Regularization request;
  @override
  List<Object?> get props => [request];
}
