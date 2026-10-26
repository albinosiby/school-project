import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../repositories/attendance_repository_interface.dart';
import '../repositories/marks_repository_interface.dart';
import '../models/marks_models.dart';
import 'load_status.dart';
import 'marks_events.dart';
import 'marks_states.dart';

/// Marks entry (1.3 list, 1.3.2 Enter Marks, 1.3.1 Edit Marks).
class MarksBloc extends Bloc<MarksEvent, MarksState> {
  String? _classId;

  static String _pick(List<Exam> exams, String? examId, String? classId) {
    if (exams.any((x) => x.id == examId)) return examId!;
    return (classId == null ? null : exams.where((x) => x.classId == classId).firstOrNull?.id) ?? exams.firstOrNull?.id ?? '';
  }

  MarksBloc(this._repo, this._attendance, this._school) : super(const MarksState()) {
    on<MarksLoadRequested>((e, emit) async {
      emit(state.copyWith(status: LoadStatus.loading));
      final exams = await _repo.getExams();
      emit(state.copyWith(
        status: LoadStatus.loaded, exams: exams, marks: await _repo.getMarks(), classes: await _school.getClasses(),
        students: await _school.getStudents(), records: await _attendance.getRecords(), teacherName: (await _school.getTeacher()).name,
        examId: _pick(exams, e.examId, e.classId),
      ));
      _classId = e.classId;
    });
    // exams can arrive after the screen opened (Firestore): keep the selection valid
    on<MarksRefreshed>((e, emit) async {
      final exams = await _repo.getExams();
      emit(state.copyWith(exams: exams, marks: await _repo.getMarks(), examId: _pick(exams, state.examId, _classId)));
    });
    on<MarksExamSelected>((e, emit) => emit(state.copyWith(examId: e.examId, filter: 'All', query: '')));
    on<MarksFilterChanged>((e, emit) => emit(state.copyWith(filter: e.filter)));
    on<MarksQueryChanged>((e, emit) => emit(state.copyWith(query: e.query)));
    on<MarkSaved>((e, emit) async {
      // optimistic update so text fields don't flicker
      emit(state.copyWith(marks: [for (final m in state.marks) if (m.id != e.mark.id) m, e.mark]));
      await _repo.saveMark(e.mark);
    });
    on<MarksExamSubmitted>((e, _) => _repo.submitExam(e.examId));
    _sub = _repo.watch().listen((_) => add(const MarksRefreshed()));
  }

  final IMarksRepository _repo;
  final IAttendanceRepository _attendance;
  final ISchoolRepository _school;
  late final StreamSubscription<void> _sub;

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
