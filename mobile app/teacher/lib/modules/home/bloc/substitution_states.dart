import 'package:equatable/equatable.dart';
import '../models/timetable_models.dart';

enum SubstitutionLoadStatus { initial, loaded, notFound }

class SubstitutionState extends Equatable {
  const SubstitutionState({this.status = SubstitutionLoadStatus.initial, this.id = '', this.sub});
  final SubstitutionLoadStatus status;
  final String id;
  final Substitution? sub;

  @override
  List<Object?> get props => [status, id, sub];
}
