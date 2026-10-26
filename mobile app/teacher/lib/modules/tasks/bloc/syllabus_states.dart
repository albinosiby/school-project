import 'package:equatable/equatable.dart';
import '../models/syllabus_models.dart';

enum SyllabusStatus { initial, loading, loaded, failure }

class SyllabusState extends Equatable {
  const SyllabusState({this.status = SyllabusStatus.initial, this.divisions = const [], this.meta = const SyllabusMeta(), this.error});
  final SyllabusStatus status;
  final List<SyllabusDivision> divisions;
  final SyllabusMeta meta;
  final String? error;

  int get done => divisions.fold(0, (a, d) => a + d.topics.fold(0, (b, t) => b + t.done));
  int get total => divisions.fold(0, (a, d) => a + d.topics.fold(0, (b, t) => b + t.total));
  int get hours => divisions.fold(0, (a, d) => a + d.hours);
  int get labs => divisions.fold(0, (a, d) => a + d.labs);
  int get pct => total == 0 ? 0 : (done * 100 / total).round();
  int get diff => pct - meta.target;

  SyllabusState copyWith({SyllabusStatus? status, List<SyllabusDivision>? divisions, SyllabusMeta? meta, String? error}) =>
      SyllabusState(status: status ?? this.status, divisions: divisions ?? this.divisions, meta: meta ?? this.meta, error: error);

  @override
  List<Object?> get props => [status, divisions, meta, error];
}
