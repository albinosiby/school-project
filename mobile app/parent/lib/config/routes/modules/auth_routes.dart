import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../di/injection.dart';
import '../../../modules/auth/bloc/registration_bloc.dart';
import '../../../modules/auth/screens/forgot_password_screen.dart';
import '../../../modules/auth/screens/login_screen.dart';
import '../../../modules/auth/screens/otp_screen.dart';
import '../../../modules/auth/screens/register_screen.dart';
import '../../../modules/auth/screens/welcome_screen.dart';
import '../../../modules/family/screens/select_child_screen.dart';
import '../routes.dart';

/// Public onboarding routes (Onboarding 1, 2, 3, 1.1) + child selection (Onboarding 4, signed in).
/// Fixed "/login/..." paths are separate routes so each step is its own page.
final List<RouteBase> authRoutes = [
  GoRoute(path: RoutePaths.welcome, builder: (_, _) => const WelcomeScreen()),
  GoRoute(path: RoutePaths.login, builder: (_, _) => const LoginScreen()),
  GoRoute(path: RoutePaths.loginOtp, builder: (_, _) => const OtpScreen()),
  GoRoute(
    path: RoutePaths.forgotPassword,
    builder: (_, _) => const ForgotPasswordScreen(),
  ),
  GoRoute(
    path: RoutePaths.register,
    builder: (_, _) => BlocProvider(
      create: (_) => getIt<RegistrationBloc>(),
      child: const RegisterScreen(),
    ),
  ),
  GoRoute(
    path: RoutePaths.selectChild,
    builder: (_, _) => const SelectChildScreen(),
  ),
];
