class ApiPaths {
  ApiPaths._();

  static const String baseUrl = 'https://api.example.com/v1';

  // Auth
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String refreshToken = '/auth/refresh';

  // Dashboard
  static const String dashboard = '/dashboard';

  // Add new module endpoints below:
  // static const String profile = '/profile';
}
