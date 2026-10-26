import 'package:equatable/equatable.dart';
import '../models/home_models.dart';

enum SettingsStatus { initial, loaded }

class SettingsState extends Equatable {
  const SettingsState({this.status = SettingsStatus.initial, this.settings = const AppSettings()});
  final SettingsStatus status;
  final AppSettings settings;

  @override
  List<Object?> get props => [status, settings];
}
