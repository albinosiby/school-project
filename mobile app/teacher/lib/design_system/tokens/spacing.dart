import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

class Spacing {
  Spacing._();

  // Vertical
  static Widget get verticalXS => SizedBox(height: 4.h);
  static Widget get verticalSM => SizedBox(height: 8.h);
  static Widget get verticalMD => SizedBox(height: 16.h);
  static Widget get verticalLG => SizedBox(height: 24.h);
  static Widget get verticalXL => SizedBox(height: 32.h);

  // Horizontal
  static Widget get horizontalXS => SizedBox(width: 4.w);
  static Widget get horizontalSM => SizedBox(width: 8.w);
  static Widget get horizontalMD => SizedBox(width: 16.w);
  static Widget get horizontalLG => SizedBox(width: 24.w);
  static Widget get horizontalXL => SizedBox(width: 32.w);

  static Widget v(double h) => SizedBox(height: h.h);
  static Widget h(double w) => SizedBox(width: w.w);
}

extension BuildContextExtension on BuildContext {
  double get screenWidth => MediaQuery.sizeOf(this).width;
  double get screenHeight => MediaQuery.sizeOf(this).height;
  bool get isMobile => screenWidth < 600;
  bool get isTablet => screenWidth >= 600 && screenWidth < 1200;
  bool get isDesktop => screenWidth >= 1200;
}
