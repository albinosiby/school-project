import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../repositories/settings_repository_interface.dart';
import 'settings_events.dart';
import 'settings_states.dart';

/// Notification & account settings (core/settings/application_setting.dart).
class SettingsBloc extends Bloc<SettingsEvent, SettingsState> {
  SettingsBloc(this._repo) : super(const SettingsState()) {
    on<SettingsLoadRequested>((e, emit) async => emit(SettingsState(status: SettingsStatus.loaded, settings: await _repo.get())));
    on<SettingsChanged>((e, emit) async {
      emit(SettingsState(status: SettingsStatus.loaded, settings: e.settings)); // optimistic
      await _repo.save(e.settings);
    });
    _sub = _repo.watch().listen((_) => add(const SettingsLoadRequested()));
  }

  final ISettingsRepository _repo;
  late final StreamSubscription<void> _sub;

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
