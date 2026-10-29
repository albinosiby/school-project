import 'design_system/tokens/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:google_fonts/google_fonts.dart';
import 'config/app_config.dart';
import 'config/routes/routes_config.dart';
import 'di/injection.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;
  await GoogleFonts.pendingFonts([
    for (final weight in FontWeight.values.where(
      (w) => w.value >= 200 && w.value <= 800,
    ))
      GoogleFonts.plusJakartaSans(fontWeight: weight),
  ]);
  usePathUrlStrategy();
  configureDependencies();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Color(0xFFF7F9FB),
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const DriverApp());
}

class DriverApp extends StatefulWidget {
  const DriverApp({super.key, this.initialLocation});
  final String? initialLocation;
  @override
  State<DriverApp> createState() => _DriverAppState();
}

class _DriverAppState extends State<DriverApp> {
  late final router = createRouter(initialLocation: widget.initialLocation);
  @override
  void dispose() {
    router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ScreenUtilInit(
    designSize: const Size(AppConfig.designWidth, AppConfig.designHeight),
    minTextAdapt: true,
    splitScreenMode: true,
    builder: (context, child) => MaterialApp.router(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.light,
    ),
  );
}
