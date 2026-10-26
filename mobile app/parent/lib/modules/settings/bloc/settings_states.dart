import 'package:equatable/equatable.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../models/app_settings.dart';

class SettingsState extends Equatable {
  const SettingsState({
    this.status = LoadStatus.loading,
    this.settings = const AppSettings(),
    this.error,
  });
  final LoadStatus status;
  final AppSettings settings;
  final String? error;

  @override
  List<Object?> get props => [status, settings, error];
}
