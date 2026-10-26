import 'package:equatable/equatable.dart';
import '../models/app_settings.dart';

sealed class SettingsEvent extends Equatable {
  const SettingsEvent();
  @override
  List<Object?> get props => [];
}

class LoadSettings extends SettingsEvent {
  const LoadSettings();
}

/// Any change (toggle, language) — the new settings are saved and persisted.
class UpdateSettings extends SettingsEvent {
  const UpdateSettings(this.settings);
  final AppSettings settings;
  @override
  List<Object?> get props => [settings];
}
