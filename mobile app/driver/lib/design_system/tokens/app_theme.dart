import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'light_theme.dart';
import 'dark_theme.dart';

abstract final class AppTheme {
  static ThemeData get light => lightTheme();
  static ThemeData get dark => darkTheme();
  static double get borderRadius => 12.r;
  static EdgeInsets get pagePadding => EdgeInsets.all(16.w);
}
