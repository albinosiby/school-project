import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'dark_theme.dart';
import 'light_theme.dart';

class AppTheme {
  AppTheme._();

  // Shared design tokens (ScreenUtil based, evaluated lazily)
  static double get borderRadius => 12.r;
  static EdgeInsets get pagePadding => EdgeInsets.all(16.w);
  static EdgeInsets get cardPadding => EdgeInsets.all(12.w);

  static ThemeData get light => lightTheme();
  static ThemeData get dark => darkTheme();
}
