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
