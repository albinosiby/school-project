class AppConstants {
  AppConstants._();

  static const String appName = 'Shift Sync';

  // Storage keys (local backend session)
  static const String sessionKey = 'driver_session_crew';

  // Responsive design frame (Figma "Driver App" 402 x 874)
  static const double designWidth = 402;
  static const double designHeight = 874;

  /// Default crew check-in deadline when `tr_settings/policy.checkInBy` is missing (contract 14.5).
  static const String defaultCheckInBy = '06:30';
}
