import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../attendance/repositories/attendance_repository_interface.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../repositories/class_management_repository_interface.dart';
import 'class_management_events.dart';
import 'class_management_states.dart';

/// The class teacher's management page: roster, registers, leave requests, timetable and marks of her division.
class ClassManagementBloc extends Bloc<ClassManagementEvent, ClassManagementState> {
  ClassManagementBloc(this._school, this._attendance, this._repo) : super(ClassManagementState()) {
    on<ClassManagementLoadRequested>((e, emit) async {
      emit(state.copyWith(status: ClassManagementStatus.loading, classId: e.classId));
      await _load(emit);
    });
    on<ClassManagementRefreshed>((e, emit) => _load(emit));
    on<ClassLeaveDecided>((e, emit) async {
      await _attendance.setLeaveSlipStatus(e.id, e.approve ? 'Approved' : 'Rejected', note: e.note.trim().isEmpty ? null : e.note.trim());
      emit(state.copyWith(notice: e.approve ? 'Leave approved' : 'Leave rejected', noticeSeq: state.noticeSeq + 1));
    });
    _subs = [
      for (final s in [_attendance.watch(), _repo.watch(), _school.watch()])
        s.listen((_) {
          if (state.classId.isNotEmpty) add(const ClassManagementRefreshed());
        }),
    ];
  }

  final ISchoolRepository _school;
  final IAttendanceRepository _attendance;
  final IClassManagementRepository _repo;
  late final List<StreamSubscription<void>> _subs;

  Future<void> _load(Emitter<ClassManagementState> emit) async {
    final id = state.classId;
    final roster = (await _school.getStudents(classId: id))..sort((a, b) => (a.roll <= 0 ? 9999 : a.roll).compareTo(b.roll <= 0 ? 9999 : b.roll));
    final ids = {for (final s in roster) s.id};
    final records = [for (final r in await _attendance.getRecords(classId: id)) if (r.submitted) r]..sort((a, b) => a.date != b.date ? a.date.compareTo(b.date) : a.period.compareTo(b.period));
    emit(state.copyWith(
      status: ClassManagementStatus.loaded,
      roster: roster,
      records: records,
      leaves: [for (final l in await _attendance.getLeaveSlips()) if (ids.contains(l.studentId)) l],
      timetable: await _repo.getTimetable(id),
      marks: [for (final m in await _repo.getMarks(id)) if (ids.contains(m.studentId)) m],
    ));
  }

  @override
  Future<void> close() {
    for (final s in _subs) {
      s.cancel();
    }
    return super.close();
  }
}
