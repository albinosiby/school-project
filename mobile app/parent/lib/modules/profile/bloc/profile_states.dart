import 'package:equatable/equatable.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../models/guardian_profile.dart';

enum SaveStatus { idle, saving, saved, failed }

class ProfileState extends Equatable {
  const ProfileState({
    this.status = LoadStatus.loading,
    this.profile,
    this.attendance = const {},
    this.save = SaveStatus.idle,
    this.error,
  });
  final LoadStatus status;
  final GuardianProfile? profile;

  /// childId -> attendance percentage.
  final Map<String, double> attendance;
  final SaveStatus save;

  /// Load error (status error) or save error (save failed).
  final String? error;

  ProfileState copyWith({
    LoadStatus? status,
    GuardianProfile? profile,
    Map<String, double>? attendance,
    SaveStatus? save,
    String? error,
  }) => ProfileState(
    status: status ?? this.status,
    profile: profile ?? this.profile,
    attendance: attendance ?? this.attendance,
    save: save ?? this.save,
    error: error,
  );

  @override
  List<Object?> get props => [status, profile, attendance, save, error];
}
