import 'package:equatable/equatable.dart';
import '../../crew/models/crew_models.dart';

/// The signed-in login: `users/{uid}` of role driver / attendant (contract 14.1).
class CrewUser extends Equatable {
  const CrewUser({required this.uid, required this.email, required this.name, required this.schoolId, required this.crewId, required this.role});
  final String uid, email, name, schoolId, crewId;
  final CrewRole role;

  @override
  List<Object?> get props => [uid, email, name, schoolId, crewId, role];
}
