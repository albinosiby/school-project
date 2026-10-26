import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'config/app_config.dart';
import 'firebase_options.dart';
import 'modules/auth/bloc/auth_bloc.dart';
import 'modules/auth/bloc/auth_events.dart';
import 'modules/auth/bloc/auth_states.dart';
import 'config/routes/routes_config.dart';
import 'constants/app_constants.dart';
import 'design_system/design_system.dart';
import 'di/global_blocs.dart';
import 'di/injection.dart';
import 'utils/services/firebase/push_notification_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  usePathUrlStrategy();
  if (AppConfig.isFirebase) {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    // offline cache (default on mobile, opt-in on web) so cached data shows instantly and works offline
    FirebaseFirestore.instance.settings = const Settings(persistenceEnabled: true);
  }
  await configureDependencies();
  // Restore the saved session before the first frame so the router guard starts on the right screen.
  final auth = getIt<AuthBloc>()..add(const AuthStarted());
  await auth.stream.firstWhere((s) => s.status != AuthStatus.unknown);
  runApp(const TeacherApp());
  if (AppConfig.isFirebase) _listenForPush();
}

/// Shows snack bars for messages that arrive while the app is open, and opens the screen of a tapped notification.
final rootMessengerKey = GlobalKey<ScaffoldMessengerState>();

void _listenForPush() {
  final push = getIt<PushNotificationService>();
  push.openedRoutes.listen(router.go);
  push.foregroundMessages.listen((m) {
    rootMessengerKey.currentState?.showSnackBar(SnackBar(
      behavior: SnackBarBehavior.floating,
      // snack bars with an action persist by default; a push banner should go away on its own
      duration: const Duration(seconds: 6),
      persist: false,
      content: Text(m.body.isEmpty ? m.title : '${m.title}\n${m.body}', maxLines: 3, overflow: TextOverflow.ellipsis),
      action: m.route == null ? null : SnackBarAction(label: 'Open', onPressed: () => router.go(m.route!)),
    ));
  });
}

class TeacherApp extends StatelessWidget {
  const TeacherApp({super.key});

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, box) {
          // Phones in portrait use the 390x844 Figma frame. A phone held sideways keeps 1:1 sizes (scaling up would
          // waste its short height). Tablets and desktops scale like the phone column (kContentMaxWidth).
          final mobile = box.maxWidth < Breakpoints.mobile;
          const k = kContentMaxWidth / AppConstants.designWidth;
          final design = mobile
              ? const Size(AppConstants.designWidth, AppConstants.designHeight)
              : isPhoneLandscape(box.biggest)
                  ? box.biggest
                  : Size(box.maxWidth / k, box.maxHeight / k);
          return ScreenUtilInit(
            designSize: design,
            minTextAdapt: true,
            splitScreenMode: true,
            builder: (_, _) => MultiBlocProvider(
              providers: globalBlocProviders(),
              child: MaterialApp.router(
                title: AppConstants.appName,
                debugShowCheckedModeBanner: false,
                theme: AppTheme.light,
                darkTheme: AppTheme.dark,
                themeMode: ThemeMode.light, // designs are light-only
                routerConfig: router,
                scaffoldMessengerKey: rootMessengerKey,
              ),
            ),
          );
        },
      );
}
