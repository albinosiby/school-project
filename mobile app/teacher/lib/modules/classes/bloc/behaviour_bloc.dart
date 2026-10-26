import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../repositories/behaviour_repository_interface.dart';
import 'behaviour_events.dart';
import 'behaviour_states.dart';

/// Behaviour log screen, New Log form and Custom Badge sheet.
class BehaviourBloc extends Bloc<BehaviourEvent, BehaviourState> {
  BehaviourBloc(this._repo) : super(const BehaviourState()) {
    on<BehaviourLoadRequested>(_onLoad);
    on<BehaviourLogAdded>(_onAdd);
    on<BehaviourParentNotified>(_onNotify);
    on<BehaviourLogDeleted>(_onDelete);
    on<BehaviourBadgeCreated>(_onBadge);
    _sub = _repo.watch().listen((_) => add(const BehaviourLoadRequested()));
  }

  final IBehaviourRepository _repo;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(BehaviourLoadRequested e, Emitter<BehaviourState> emit) async {
    if (state.status == BehaviourStatus.initial) emit(state.copyWith(status: BehaviourStatus.loading));
    try {
      emit(state.copyWith(status: BehaviourStatus.loaded, logs: await _repo.getLogs(), badges: await _repo.getBadges()));
    } on AppException catch (err) {
      emit(state.copyWith(status: BehaviourStatus.failure, error: err.message));
    }
  }

  Future<void> _onAdd(BehaviourLogAdded e, Emitter<BehaviourState> emit) async {
    final log = await _repo.addLog(e.log);
    emit(state.copyWith(logs: [log, ...state.logs], notice: 'Log published for ${e.studentName}', bumpNotice: true, saved: true));
  }

  Future<void> _onNotify(BehaviourParentNotified e, Emitter<BehaviourState> emit) async {
    await _repo.updateLog(e.log.copyWith(status: 'Parent notified'));
    emit(state.copyWith(notice: 'Parent notified', bumpNotice: true));
  }

  Future<void> _onDelete(BehaviourLogDeleted e, Emitter<BehaviourState> emit) async {
    await _repo.deleteLog(e.id);
    emit(state.copyWith(logs: state.logs.where((l) => l.id != e.id).toList(), notice: 'Log deleted', bumpNotice: true));
  }

  Future<void> _onBadge(BehaviourBadgeCreated e, Emitter<BehaviourState> emit) async {
    final b = await _repo.addBadge(e.badge);
    emit(state.copyWith(badges: [...state.badges, b], notice: 'Badge created', bumpNotice: true));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
