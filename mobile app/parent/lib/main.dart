import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:go_router/go_router.dart';
import 'config/routes/routes_config.dart';
import 'constants/app_constants.dart';
import 'design_system/design_system.dart';
import 'di/global_blocs.dart';
import 'di/injection.dart';
import 'modules/auth/bloc/auth_bloc.dart';
import 'modules/family/bloc/family_bloc.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  usePathUrlStrategy();
  await configureDependencies();
  final auth = getIt<AuthBloc>()..add(const AuthStarted());
  await auth.stream.firstWhere(
    (s) => s.status != AuthStatus.unknown,
  ); // saved session restored
  runApp(ParentApp(router: createRouter(auth)));
}

class ParentApp extends StatefulWidget {
  const ParentApp({super.key, required this.router});
  final GoRouter router;

  @override
  State<ParentApp> createState() => _ParentAppState();
}

class _ParentAppState extends State<ParentApp> {
  @override
  void initState() {
    super.initState();
    if (getIt<AuthBloc>().state.isAuthenticated)
      getIt<FamilyBloc>().add(const LoadFamily());
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      // Phones use the 390x844 frame. Wider screens show the phone layout in a centred column
      // (kContentMaxWidth), so the design size is scaled to that column.
      final mobile = box.maxWidth < Breakpoints.mobile;
      const k = kContentMaxWidth / AppConstants.designWidth;
      final design = mobile
          ? const Size(AppConstants.designWidth, AppConstants.designHeight)
          : Size(box.maxWidth / k, box.maxHeight / k);
      return ScreenUtilInit(
        designSize: design,
        minTextAdapt: true,
        splitScreenMode: true,
        builder: (_, _) => MultiBlocProvider(
          providers: globalBlocProviders(),
          child: BlocListener<AuthBloc, AuthState>(
            listenWhen: (a, b) => a.status != b.status,
            listener: (context, auth) {
              // Load the family when signing in; the sign-out button clears it.
              if (auth.isAuthenticated)
                context.read<FamilyBloc>().add(const LoadFamily());
            },
            child: MaterialApp.router(
              title: AppConstants.appName,
              debugShowCheckedModeBanner: false,
              theme: AppTheme.light,
              darkTheme: AppTheme.dark,
              themeMode: ThemeMode.light, // designs are light-only
              routerConfig: widget.router,
            ),
          ),
        ),
      );
    },
  );
}
