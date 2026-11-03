import 'package:equatable/equatable.dart';

/// The guardian's consent (data contract 13.3: `consents/{uid}`), recorded at first sign-in and changeable in Settings.
class ConsentRecord extends Equatable {
  const ConsentRecord({
    this.photos = false,
    this.notifications = true,
    this.version = ConsentRecord.currentVersion,
    this.acceptedAt,
    this.withdrawn = false,
  });

  /// Bump when the consent text changes; a record of an older version asks again.
  static const currentVersion = '2026-10';

  /// Processing the child's school records is required to use the app, so it is always true in a saved record.
  bool get dataProcessing => true;
  final bool photos, notifications, withdrawn;
  final String version;
  final DateTime? acceptedAt;

  /// Counts as given (admin web: "Given") and is the current text.
  bool get isCurrent => !withdrawn && version == currentVersion;

  ConsentRecord copyWith({
    bool? photos,
    bool? notifications,
    bool? withdrawn,
  }) => ConsentRecord(
    photos: photos ?? this.photos,
    notifications: notifications ?? this.notifications,
    version: version,
    acceptedAt: acceptedAt,
    withdrawn: withdrawn ?? this.withdrawn,
  );

  @override
  List<Object?> get props => [
    photos,
    notifications,
    version,
    acceptedAt,
    withdrawn,
  ];
}
