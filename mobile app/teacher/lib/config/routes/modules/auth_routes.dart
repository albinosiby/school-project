import 'package:go_router/go_router.dart';
import '../../../modules/auth/screens/forgot_password_screen.dart';
import '../../../modules/auth/screens/login_screen.dart';
import '../routes.dart';

final List<RouteBase> authRoutes = [
  GoRoute(path: RoutePaths.login, builder: (_, _) => const LoginScreen()),
  GoRoute(path: RoutePaths.forgotPassword, builder: (_, _) => const ForgotPasswordScreen()),
];
