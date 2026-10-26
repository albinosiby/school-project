class AppConstants {
  AppConstants._();

  static const String appName = 'Teacher Portal';

  // Timeouts
  static const Duration connectionTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // Storage keys
  static const String tokenKey = 'auth_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String themeKey = 'app_theme';
  static const String onboardingKey = 'onboarding_complete';
  static const String localDbKey = 'teacher_app_db_v2';

  // Responsive design frame (Figma Teacher App frames are 390x844)
  static const double designWidth = 390;
  static const double designHeight = 844;
}
