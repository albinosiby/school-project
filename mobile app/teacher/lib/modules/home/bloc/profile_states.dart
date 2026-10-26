import 'package:equatable/equatable.dart';
import '../models/home_models.dart';

enum ProfileStatus { initial, loaded, failure }

class ProfileState extends Equatable {
  const ProfileState({this.status = ProfileStatus.initial, this.profile = const FacultyProfile(), this.error});
  final ProfileStatus status;
  final FacultyProfile profile;
  final String? error;

  @override
  List<Object?> get props => [status, profile, error];
}
