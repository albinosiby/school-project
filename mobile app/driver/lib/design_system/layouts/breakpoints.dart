enum ScreenType { mobile, tablet, desktop }

abstract final class Breakpoints {
  static ScreenType at(double width) => width < 600
      ? ScreenType.mobile
      : width < 1200
      ? ScreenType.tablet
      : ScreenType.desktop;
}
