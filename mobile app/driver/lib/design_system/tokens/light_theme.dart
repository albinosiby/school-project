import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'app_tokens.dart';

ThemeData lightTheme() {
  final scheme =
      ColorScheme.fromSeed(
        seedColor: C.primary,
        brightness: Brightness.light,
      ).copyWith(
        primary: C.primary,
        onPrimary: Colors.white,
        surface: C.bg,
        error: C.danger,
      );
  OutlineInputBorder border(Color c) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(R.md),
    borderSide: BorderSide(color: c),
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: C.bg,
    textTheme: Typography.blackMountainView.apply(
      bodyColor: C.ink,
      displayColor: C.ink,
    ),
    splashFactory: InkRipple.splashFactory,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: C.bg,
      isDense: true,
      contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 14.h),
      hintStyle: T.body.copyWith(color: C.muted),
      border: border(C.border),
      enabledBorder: border(C.border),
      focusedBorder: border(C.primary),
      errorBorder: border(C.danger),
      focusedErrorBorder: border(C.danger),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: C.ink,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.md)),
    ),
    dividerTheme: const DividerThemeData(
      color: C.border,
      space: 1,
      thickness: 1,
    ),
  );
}
