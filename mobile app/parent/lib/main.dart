import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:go_router/go_router.dart';
import 'config/app_config.dart';
import 'config/routes/routes_config.dart';
import 'constants/app_constants.dart';
import 'design_system/design_system.dart';
import 'di/global_blocs.dart';
import 'di/injection.dart';
import 'firebase_options.dart';
import 'modules/auth/bloc/auth_bloc.dart';
import 'modules/family/bloc/family_bloc.dart';
import 'utils/services/firebase/push_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  usePathUrlStrategy();
  if (AppConfig.isFirebase) {
    final options = DefaultFirebaseOptions.currentPlatform;
    // test builds talk to the emulators' demo project, never the live one
    await Firebase.initializeApp(
      options: AppConfig.useEmulator ? options.copyWith(projectId: AppConfig.emulatorProject) : options,
    );
    // offline cache: reads show cached data at once and refresh from the server (works offline too)
    FirebaseFirestore.instance.settings = const Settings(persistenceEnabled: true);
    // test builds only (--dart-define=EMULATOR=true): local Firebase emulators, reached through `adb reverse` on a phone
    if (AppConfig.useEmulator) {
      await FirebaseAuth.instance.useAuthEmulator('localhost', 9099);
      FirebaseFirestore.instance.useFirestoreEmulator('localhost', 8080);
    }
  }
  await configureDependencies();
  final auth = getIt<AuthBloc>()..add(const AuthStarted());
  await auth.stream.firstWhere(
    (s) => s.status != AuthStatus.unknown,
  ); // saved session restored
  final router = createRouter(auth);
  runApp(ParentApp(router: router));
  if (AppConfig.isFirebase) _listenForPush(router);
}

/// Shows snack bars for messages that arrive while the app is open, and opens the screen of a tapped notification.
final rootMessengerKey = GlobalKey<ScaffoldMessengerState>();

void _listenForPush(GoRouter router) {
  final push = getIt<ParentPushService>();
  push.openedRoutes.listen(router.go);
  push.foregroundMessages.listen((m) {
    rootMessengerKey.currentState?.showSnackBar(SnackBar(
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 6),
      content: Text(m.body.isEmpty ? m.title : '${m.title}\n${m.body}', maxLines: 3, overflow: TextOverflow.ellipsis),
      action: m.route == null ? null : SnackBarAction(label: 'Open', onPressed: () => router.go(m.route!)),
    ));
  });
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
              scaffoldMessengerKey: rootMessengerKey,
            ),
          ),
        ),
      );
    },
  );
}
