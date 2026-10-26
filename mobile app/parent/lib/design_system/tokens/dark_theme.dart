import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'app_tokens.dart';

/// Dark Material 3 theme. The Figma designs are light-only, so the app runs in
/// light mode by default (see core/settings/application_setting.dart); this theme
/// is provided for the blueprint's theme switch.
ThemeData darkTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: C.primary,
    brightness: Brightness.dark,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    inputDecorationTheme: InputDecorationTheme(
      isDense: true,
      contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 14.h),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(R.md)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.md)),
    ),
  );
}
