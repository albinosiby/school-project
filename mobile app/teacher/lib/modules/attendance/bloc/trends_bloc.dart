import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../models/attendance_models.dart';
import '../repositories/attendance_repository_interface.dart';
import 'load_status.dart';
import 'trends_events.dart';
import 'trends_states.dart';

/// Attendance trends of a class (1.1.2) incl. at-risk students and parent notifications.
class TrendsBloc extends Bloc<TrendsEvent, TrendsState> {
  TrendsBloc(this._repo, this._school) : super(const TrendsState()) {
    on<TrendsLoadRequested>((e, emit) async {
      emit(state.copyWith(status: LoadStatus.loading));
      final classes = await _school.getClasses();
      final home = classes.where((c) => c.classTeacher).firstOrNull ?? classes.firstOrNull;
      emit(state.copyWith(classes: classes));
      await _load(emit, classes.any((c) => c.id == e.classId) ? e.classId! : home?.id ?? '');
    });
    on<TrendsClassChanged>((e, emit) => _load(emit, e.classId));
    on<TrendsRangeChanged>((e, emit) => emit(state.copyWith(range: e.range)));
    on<TrendsNoticeSent>((e, _) => _repo.addNotice(e.notice));
    _sub = _repo.watch().listen((_) {
      if (state.classId.isNotEmpty) add(TrendsClassChanged(state.classId));
    });
  }

  final IAttendanceRepository _repo;
  final ISchoolRepository _school;
  late final StreamSubscription<void> _sub;

  Future<void> _load(Emitter<TrendsState> emit, String classId) async {
    final roster = (await _school.getStudents(classId: classId))..sort((a, b) => a.roll.compareTo(b.roll));
    emit(state.copyWith(
      status: LoadStatus.loaded, classId: classId, roster: roster,
      history: dailyRecords(await _repo.getRecords(classId: classId), classId),
      pendingMedical: {for (final m in await _repo.getMedicalSlips()) if (m.status == 'Pending') m.studentId},
    ));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
