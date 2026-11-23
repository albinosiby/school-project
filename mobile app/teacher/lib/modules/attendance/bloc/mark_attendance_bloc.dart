import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../../../utils/services/app_messenger.dart';
import '../models/attendance_models.dart';
import '../repositories/attendance_repository_interface.dart';
import 'load_status.dart';
import 'mark_attendance_events.dart';
import 'mark_attendance_states.dart';

/// Marks a class/period's attendance (1.1.1 Mark Attendance).
class MarkAttendanceBloc extends Bloc<MarkAttendanceEvent, MarkAttendanceState> {
  MarkAttendanceBloc(this._repo, this._school) : super(const MarkAttendanceState()) {
    on<MarkAttendanceLoadRequested>(_onLoad);
    on<MarkAttendanceClassChanged>((e, emit) => _select(emit, classId: e.classId));
    on<MarkAttendanceDateChanged>((e, emit) => _select(emit, date: e.date));
    on<MarkAttendancePeriodChanged>((e, emit) => _select(emit, period: e.period));
    on<MarkAttendanceCodeSet>((e, emit) => emit(state.copyWith(marks: {...state.marks, e.studentId: e.code})));
    on<MarkAttendanceAllSet>((e, emit) => emit(state.copyWith(marks: {for (final k in state.marks.keys) k: e.code})));
    on<MarkAttendanceSaved>(_onSaved);
    on<MarkAttendanceWelfareSmsSent>(_onWelfare);
    on<MarkAttendanceRefreshed>(_onRefreshed);
    _sub = _repo.watch().listen((_) => add(const MarkAttendanceRefreshed()));
  }

  final IAttendanceRepository _repo;
  final ISchoolRepository _school;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(MarkAttendanceLoadRequested e, Emitter<MarkAttendanceState> emit) async {
    emit(state.copyWith(status: LoadStatus.loading));
    final classes = await _school.getClasses();
    final teacher = await _school.getTeacher();
    final home = classes.where((c) => c.classTeacher).firstOrNull ?? classes.firstOrNull;
    final classId = classes.any((c) => c.id == e.classId) ? e.classId! : home?.id ?? '';
    if (periodTimes.isEmpty || classId.isEmpty) {
      emit(state.copyWith(status: LoadStatus.loaded, classes: classes, classId: '', roster: const [], marks: const {}, history: const [], existing: () => null));
      return;
    }
    final period = periodTimes.containsKey(e.period) ? e.period! : periodTimes.keys.first;
    emit(state.copyWith(classes: classes, empId: teacher.empId));
    await _select(emit, classId: classId, period: period, date: dkey(todayDate()));
  }

  /// Changes the selection and reloads the sheet (unsaved marks are replaced).
  Future<void> _select(Emitter<MarkAttendanceState> emit, {String? classId, int? period, String? date}) async {
    final c = classId ?? state.classId, p = period ?? state.period, d = date ?? (state.date.isEmpty ? dkey(todayDate()) : state.date);
    final roster = (await _school.getStudents(classId: c))..sort((a, b) => a.roll.compareTo(b.roll));
    final ex = await _repo.findRecord(c, d, p);
    final marks = <String, AttCode>{};
    for (final s in roster) {
      marks[s.id] = ex != null ? ex.codeOf(s.id) : (await _repo.isExcused(s.id, d) ? AttCode.excused : AttCode.present);
    }
    final aux = await _aux(c);
    emit(
      state.copyWith(
        status: LoadStatus.loaded,
        classId: c,
        period: p,
        date: d,
        roster: roster,
        marks: marks,
        existing: () => ex,
        history: aux.history,
        staffToday: () => aux.staff,
        notified: aux.notified,
      ),
    );
  }

  Future<({List<AttendanceRecord> history, StaffLog? staff, Set<String> notified})> _aux(String classId) async {
    final today = dkey(todayDate());
    return (
      history: dailyRecords(await _repo.getRecords(classId: classId), classId),
      staff: (await _repo.getStaffLogs()).where((r) => r.date == today).firstOrNull,
      notified: {
        for (final n in await _repo.getNotices())
          if (n.auto) n.studentId,
      },
    );
  }

  Future<void> _onRefreshed(MarkAttendanceRefreshed e, Emitter<MarkAttendanceState> emit) async {
    final classes = await _school.getClasses();
    if (state.classId.isEmpty || !classes.any((c) => c.id == state.classId) || !periodTimes.containsKey(state.period)) {
      add(MarkAttendanceLoadRequested(classId: state.classId, period: state.period));
      return;
    }
    final aux = await _aux(state.classId);
    final ex = await _repo.findRecord(state.classId, state.date, state.period);
    emit(state.copyWith(existing: () => ex, history: aux.history, staffToday: () => aux.staff, notified: aux.notified));
  }

  Future<void> _onSaved(MarkAttendanceSaved e, Emitter<MarkAttendanceState> emit) async {
    if (state.classId.isEmpty) return;
    // say why nothing was saved instead of dropping the tap silently
    if (state.existing?.readOnly == true) {
      emit(state.copyWith(saveError: () => 'This attendance was recorded by another teacher. Contact the school office for corrections.'));
      return;
    }
    if (!periodTimes.containsKey(state.period)) {
      emit(state.copyWith(saveError: () => 'Period ${state.period} is not in the school\'s bell schedule. Ask the office to set the school timings, then try again.'));
      return;
    }
    final rec = AttendanceRecord(
      id: state.existing?.id ?? '',
      classId: state.classId,
      date: state.date,
      period: state.period,
      total: state.marks.length,
      submitted: e.submit,
      marks: {
        for (final m in state.marks.entries)
          if (m.value != AttCode.present) m.key: m.value.code,
      },
      updatedAt: DateTime.now().toIso8601String(),
    );
    final AttendanceRecord saved;
    try {
      saved = await _repo.saveRecord(rec);
    } catch (error) {
      emit(state.copyWith(saveError: () => syncErrorMessage(error)));
      return;
    }
    emit(state.copyWith(existing: () => saved, saveError: () => null));
  }

  Future<void> _onWelfare(MarkAttendanceWelfareSmsSent e, Emitter<MarkAttendanceState> emit) async {
    await _repo.addNotice(
      ParentNotice(
        studentId: e.student.id,
        classId: state.classId,
        auto: true,
        channels: const ['SMS Alert'],
        message: 'Welfare check: ${e.student.name} has missed 3 consecutive school days.',
        at: DateTime.now().toIso8601String(),
      ),
    );
    emit(state.copyWith(notified: {...state.notified, e.student.id}));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
