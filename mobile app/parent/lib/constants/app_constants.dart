class AppConstants {
  AppConstants._();

  static const String appName = 'Parent Portal';
  static const String schoolName = 'Greenfield International School';

  // Storage keys
  static const String sessionKey = 'parent_session_guardian';
  static const String themeKey = 'app_theme';
  static const String onboardingKey = 'onboarding_complete';
  static const String selectedChildKey = 'selected_child';

  // Responsive design frame (Figma "Parent App ( 402 * 874)")
  static const double designWidth = 402;
  static const double designHeight = 874;

  /// Live-class join window (docs/DATA_CONTRACT.md section 6): Join opens this long before the start.
  static const Duration joinLeadTime = Duration(minutes: 10);
}
