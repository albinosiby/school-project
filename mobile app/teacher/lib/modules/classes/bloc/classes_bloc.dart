import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../tasks/repositories/homework_repository_interface.dart';
import '../models/classes_models.dart';
import '../repositories/behaviour_repository_interface.dart';
import '../repositories/classes_repository_interface.dart';
import '../repositories/resources_repository_interface.dart';
import 'classes_events.dart';
import 'classes_states.dart';

/// Classes tab: per-class pacing, homework progress, behaviour and resource counts.
/// Classes and students themselves come from the global SchoolBloc.
class ClassesBloc extends Bloc<ClassesEvent, ClassesState> {
  ClassesBloc(this._classes, this._homework, this._behaviour, this._resources) : super(const ClassesState()) {
    on<ClassesLoadRequested>(_onLoad);
    on<PacingChanged>(_onPacing);
    _subs = [
      for (final s in [_classes.watch(), _homework.watch(), _behaviour.watch(), _resources.watch()]) s.listen((_) => add(const ClassesLoadRequested())),
    ];
  }

  final IClassesRepository _classes;
  final IHomeworkRepository _homework;
  final IBehaviourRepository _behaviour;
  final IResourcesRepository _resources;
  late final List<StreamSubscription<void>> _subs;

  Future<void> _onLoad(ClassesLoadRequested e, Emitter<ClassesState> emit) async {
    if (state.status == ClassesStatus.initial) emit(state.copyWith(status: ClassesStatus.loading));
    try {
      emit(state.copyWith(
        status: ClassesStatus.loaded,
        pacing: {for (final p in await _classes.getPacing()) p.id: p},
        homework: await _homework.getAll(),
        logs: await _behaviour.getLogs(),
        resources: await _resources.getResources(),
      ));
    } on AppException catch (err) {
      emit(state.copyWith(status: ClassesStatus.failure, error: err.message));
    }
  }

  Future<void> _onPacing(PacingChanged e, Emitter<ClassesState> emit) async {
    final p = state.pacing[e.classId] ?? ClassPacing(id: e.classId, done: 0, total: 1);
    final next = p.copyWith(done: (p.done + e.delta).clamp(0, p.total));
    emit(state.copyWith(pacing: {...state.pacing, e.classId: next}));
    await _classes.savePacing(next);
  }

  @override
  Future<void> close() {
    for (final s in _subs) {
      s.cancel();
    }
    return super.close();
  }
}
