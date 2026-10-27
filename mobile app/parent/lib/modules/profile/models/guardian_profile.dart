import 'package:equatable/equatable.dart';
import '../../family/models/family_models.dart';

/// Relationship choices of "6.1 Edit Profile".
const guardianRelations = ['Mother', 'Father', 'Legal Guardian'];
const emergencyRelations = ['Spouse', 'Grandparent', 'Relative', 'Friend', 'Neighbour'];

/// Number of simulated profile-photo styles (rendered as coloured initials avatars).
const photoStyleCount = 5;

/// The guardian record behind "6. Profile" (the [Guardian] shown app-wide plus contact details).
class GuardianProfile extends Equatable {
  const GuardianProfile({
    required this.guardian,
    required this.parentId,
    required this.address,
    required this.emergencyName,
    required this.emergencyRelation,
    required this.emergencyPhone,
    this.phoneVerified = true,
    this.photoStyle,
  });
  final Guardian guardian;
  final String parentId, address, emergencyName, emergencyRelation, emergencyPhone;
  final bool phoneVerified;

  /// Simulated photo: index 0..[photoStyleCount)-1, or null when there is no photo (plain initials).
  final int? photoStyle;

  GuardianProfile copyWith({
    Guardian? guardian,
    String? address,
    String? emergencyName,
    String? emergencyRelation,
    String? emergencyPhone,
    bool? phoneVerified,
    int? Function()? photoStyle,
  }) => GuardianProfile(
    guardian: guardian ?? this.guardian,
    parentId: parentId,
    address: address ?? this.address,
    emergencyName: emergencyName ?? this.emergencyName,
    emergencyRelation: emergencyRelation ?? this.emergencyRelation,
    emergencyPhone: emergencyPhone ?? this.emergencyPhone,
    phoneVerified: phoneVerified ?? this.phoneVerified,
    photoStyle: photoStyle != null ? photoStyle() : this.photoStyle,
  );

  @override
  List<Object?> get props => [
    guardian,
    parentId,
    address,
    emergencyName,
    emergencyRelation,
    emergencyPhone,
    phoneVerified,
    photoStyle,
  ];
}
