import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'config/app_config.dart';
import 'config/routes/routes_config.dart';
import 'constants/app_constants.dart';
import 'design_system/design_system.dart';
import 'di/injection.dart';
import 'firebase_options.dart';
import 'modules/auth/bloc/auth_bloc.dart';
import 'modules/crew/bloc/crew_bloc.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Plus Jakarta Sans ships in assets/fonts; never fetch fonts over the network (buses have no data on the road)
  GoogleFonts.config.allowRuntimeFetching = false;
  usePathUrlStrategy();
  if (AppConfig.isFirebase) {
    final options = DefaultFirebaseOptions.currentPlatform;
    // test builds talk to the emulators' demo project, never the live one
    await Firebase.initializeApp(options: AppConfig.useEmulator ? options.copyWith(projectId: AppConfig.emulatorProject) : options);
    // offline cache: reads show cached data at once and refresh from the server (works offline too)
    FirebaseFirestore.instance.settings = const Settings(persistenceEnabled: true);
    if (AppConfig.useEmulator) {
      await FirebaseAuth.instance.useAuthEmulator(AppConfig.emulatorHost, 9099);
      FirebaseFirestore.instance.useFirestoreEmulator(AppConfig.emulatorHost, 8080);
    }
  }
  await configureDependencies();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    systemNavigationBarColor: Color(0xFFF7F9FB),
    systemNavigationBarIconBrightness: Brightness.dark,
  ));
  final auth = getIt<AuthBloc>()..add(const AuthStarted());
  await auth.stream.firstWhere((s) => s.status != AuthStatus.unknown); // saved session restored
  runApp(DriverApp(router: createRouter(auth)));
}

final rootMessengerKey = GlobalKey<ScaffoldMessengerState>();

class DriverApp extends StatefulWidget {
  const DriverApp({super.key, required this.router});
  final GoRouter router;

  @override
  State<DriverApp> createState() => _DriverAppState();
}

class _DriverAppState extends State<DriverApp> {
  @override
  void initState() {
    super.initState();
    if (getIt<AuthBloc>().state.isAuthenticated) getIt<CrewBloc>().add(const LoadData());
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      // Phones use the 402x874 frame. Wider screens show the phone layout in a centred column (kContentMaxWidth).
      final mobile = box.maxWidth < Breakpoints.mobile;
      const k = kContentMaxWidth / AppConstants.designWidth;
      final design = mobile ? const Size(AppConstants.designWidth, AppConstants.designHeight) : Size(box.maxWidth / k, box.maxHeight / k);
      return ScreenUtilInit(
        designSize: design,
        minTextAdapt: true,
        splitScreenMode: true,
        builder: (_, _) => MultiBlocProvider(
          providers: [
            BlocProvider<AuthBloc>.value(value: getIt<AuthBloc>()),
            BlocProvider<CrewBloc>(create: (_) => getIt<CrewBloc>()),
          ],
          child: BlocListener<AuthBloc, AuthState>(
            listenWhen: (a, b) => a.status != b.status,
            listener: (context, auth) {
              // load the crew context when signing in; forget it when signing out
              if (auth.isAuthenticated) {
                context.read<CrewBloc>().add(const LoadData());
              } else if (auth.status == AuthStatus.unauthenticated) {
                clearSessionData();
              }
            },
            child: MaterialApp.router(
              title: AppConstants.appName,
              debugShowCheckedModeBanner: false,
              theme: AppTheme.light,
              darkTheme: AppTheme.dark,
              themeMode: ThemeMode.light, // designs are light-only
              routerConfig: widget.router,
              scaffoldMessengerKey: rootMessengerKey,
            ),
          ),
        ),
      );
    },
  );
}
