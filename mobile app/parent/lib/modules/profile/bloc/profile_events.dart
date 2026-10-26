import 'package:equatable/equatable.dart';
import '../models/guardian_profile.dart';

sealed class ProfileEvent extends Equatable {
  const ProfileEvent();
  @override
  List<Object?> get props => [];
}

class LoadProfile extends ProfileEvent {
  const LoadProfile();
}

/// Attendance % of each linked child ("94.2% Attendance").
class LoadChildAttendance extends ProfileEvent {
  const LoadChildAttendance(this.childIds);
  final List<String> childIds;
  @override
  List<Object?> get props => [childIds];
}

class SaveProfile extends ProfileEvent {
  const SaveProfile(this.profile);
  final GuardianProfile profile;
  @override
  List<Object?> get props => [profile];
}

/// Simulated photo change: style index, or null to remove.
class ChangePhoto extends ProfileEvent {
  const ChangePhoto(this.style);
  final int? style;
  @override
  List<Object?> get props => [style];
}
