import 'package:equatable/equatable.dart';
import '../models/timetable_models.dart';

sealed class SubstitutionEvent extends Equatable {
  const SubstitutionEvent();
  @override
  List<Object?> get props => [];
}

class SubstitutionLoadRequested extends SubstitutionEvent {
  const SubstitutionLoadRequested(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// Accept / decline / undo decline.
class SubstitutionStatusChanged extends SubstitutionEvent {
  const SubstitutionStatusChanged(this.status);
  final SubStatus status;
  @override
  List<Object?> get props => [status];
}

class SubstitutionTaskToggled extends SubstitutionEvent {
  const SubstitutionTaskToggled(this.index);
  final int index;
  @override
  List<Object?> get props => [index];
}
