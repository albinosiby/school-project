import 'package:flutter/rendering.dart' show ScrollCacheExtent;

enum ScreenType { mobile, tablet, desktop }

class Breakpoints {
  Breakpoints._();

  static const double mobile = 600;
  static const double tablet = 900;
  static const double desktop = 1200;

  static ScreenType getScreenType(double width) {
    if (width < mobile) return ScreenType.mobile;
    if (width < desktop) return ScreenType.tablet;
    return ScreenType.desktop;
  }
}

/// Cache extent for scrolling forms: large enough that every field of a long form stays built, so
/// `Form.validate()` checks all of them (a lazily built list disposes fields scrolled out of view).
const ScrollCacheExtent kFormScrollCache = ScrollCacheExtent.pixels(100000);
