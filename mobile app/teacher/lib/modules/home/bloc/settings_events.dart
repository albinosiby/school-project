import 'package:equatable/equatable.dart';
import '../models/home_models.dart';

sealed class SettingsEvent extends Equatable {
  const SettingsEvent();
  @override
  List<Object?> get props => [];
}

class SettingsLoadRequested extends SettingsEvent {
  const SettingsLoadRequested();
}

/// Persists the whole preferences document (switches, default class, quiet hours, sync frequency).
class SettingsChanged extends SettingsEvent {
  const SettingsChanged(this.settings);
  final AppSettings settings;
  @override
  List<Object?> get props => [settings];
}
