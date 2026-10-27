import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus, errorMessage;
import '../repositories/settings_repository_interface.dart';
import 'settings_events.dart';
import 'settings_states.dart';

export 'settings_events.dart';
export 'settings_states.dart';

class SettingsBloc extends Bloc<SettingsEvent, SettingsState> {
  SettingsBloc(this._repo) : super(const SettingsState()) {
    on<LoadSettings>(
      (event, emit) => emit.forEach(
        _repo.watchSettings(),
        onData: (s) => SettingsState(status: LoadStatus.loaded, settings: s),
        onError: (e, _) => state.status == LoadStatus.loaded
            ? state
            : SettingsState(status: LoadStatus.error, error: errorMessage(e)),
      ),
      transformer: restartable(),
    );
    on<UpdateSettings>((event, emit) async {
      // Optimistic: the switch moves at once; the repository stream confirms.
      emit(SettingsState(status: state.status, settings: event.settings));
      await _repo.save(event.settings);
    });
  }

  final ISettingsRepository _repo;
}
