import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../attendance/models/attendance_models.dart';
import '../../attendance/repositories/attendance_repository_interface.dart';
import '../../attendance/repositories/marks_repository_interface.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../../tasks/repositories/homework_repository_interface.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../repositories/behaviour_repository_interface.dart';
import '../repositories/class_management_repository_interface.dart';
import '../repositories/student_details_repository_interface.dart';
import 'student_profile_events.dart';
import 'student_profile_states.dart';

/// A student's profile from real records: attendance registers, marks the teacher can see, homework, behaviour logs,
/// leave requests, and (class teacher) the admission record with contacts, address and medical notes.
class StudentProfileBloc extends Bloc<StudentProfileEvent, StudentProfileState> {
  StudentProfileBloc(this._attendance, this._marks, this._homework, this._behaviour, this._details, this._school, [this._class]) : super(const StudentProfileState()) {
    on<StudentProfileLoadRequested>(_onLoad);
    on<StudentProfileRefreshed>((e, emit) => _loadRecords(emit));
    on<StudentDetailsRetried>((e, emit) => _loadDetails(emit));
    on<StudentDetailsSaved>(_onSaved);
    _subs = [
      for (final s in [_attendance.watch(), _marks.watch(), _homework.watch(), _behaviour.watch(), ?_class?.watch()])
        s.listen((_) {
          if (state.studentId.isNotEmpty) add(const StudentProfileRefreshed());
        }),
    ];
  }

  final IAttendanceRepository _attendance;
  final IMarksRepository _marks;
  final IHomeworkRepository _homework;
  final IBehaviourRepository _behaviour;
  final IStudentDetailsRepository _details;
  final ISchoolRepository _school;
  final IClassManagementRepository? _class;
  late final List<StreamSubscription<void>> _subs;

  Future<void> _onLoad(StudentProfileLoadRequested e, Emitter<StudentProfileState> emit) async {
    emit(state.copyWith(status: ProfileStatus.loading, studentId: e.studentId, classId: e.classId));
    await _loadRecords(emit);
    if (e.details) await _loadDetails(emit);
  }

  Future<void> _loadRecords(Emitter<StudentProfileState> emit) async {
    final id = state.studentId, cls = state.classId;
    final student = (await _school.getStudents(classId: cls)).where((s) => s.id == id).firstOrNull;
    final from = student?.admissionDate ?? '';
    final all = await _attendance.getRecords(classId: cls);
    final exams = [for (final x in await _marks.getExams()) if (x.classId == cls) x];
    final marks = {for (final m in await _marks.getMarks()) if (m.studentId == id) m.examId: m};
    emit(state.copyWith(
      status: ProfileStatus.loaded,
      records: [for (final r in dailyRecords(all, cls)) if (from.isEmpty || r.date.compareTo(from) >= 0) r],
      periods: [for (final r in all) if (r.submitted && r.classId == cls && (from.isEmpty || r.date.compareTo(from) >= 0)) r]
        ..sort((a, b) => a.date != b.date ? a.date.compareTo(b.date) : a.period.compareTo(b.period)),
      timetable: await _class?.getTimetable(cls) ?? const [],
      homework: [for (final h in await _homework.getAll(classId: cls)) if (h.submissions.containsKey(id)) h]..sort((a, b) => b.due.compareTo(a.due)),
      exams: [for (final x in exams) (exam: x, mark: marks[x.id])],
      logs: (await _behaviour.getLogs(studentId: id))..sort((a, b) => b.at.compareTo(a.at)),
      leaves: [for (final l in await _attendance.getLeaveSlips()) if (l.studentId == id) l]..sort((a, b) => b.from.compareTo(a.from)),
    ));
  }

  Future<void> _loadDetails(Emitter<StudentProfileState> emit) async {
    emit(state.copyWith(detailsLoading: true, detailsError: () => null));
    try {
      await emit.forEach(
        _details.watch(state.studentId),
        onData: (d) => state.copyWith(details: () => d, detailsError: () => null),
      );
      emit(state.copyWith(detailsLoading: false));
    } on AppException catch (err) {
      emit(state.copyWith(detailsLoading: false, detailsError: () => err.message));
    } catch (_) {
      emit(state.copyWith(detailsLoading: false, detailsError: () => 'Could not load the student details.'));
    }
  }

  Future<void> _onSaved(StudentDetailsSaved e, Emitter<StudentProfileState> emit) async {
    if (state.saving) return;
    emit(state.copyWith(saving: true, saveError: () => null));
    try {
      final d = await _details.update(state.studentId, e.patch);
      emit(state.copyWith(saving: false, details: () => d, savedSeq: state.savedSeq + 1));
    } on AppException catch (err) {
      emit(state.copyWith(saving: false, saveError: () => err.message));
    } catch (_) {
      emit(state.copyWith(saving: false, saveError: () => 'Could not save the changes.'));
    }
  }

  @override
  Future<void> close() {
    for (final s in _subs) {
      s.cancel();
    }
    return super.close();
  }
}
