import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../components/app_dock.dart';
import '../tokens/app_tokens.dart';
import 'breakpoints.dart';
import 'responsive_builder.dart';

/// Phone column width the design is scaled to on tablet/desktop (see main.dart).
const double kContentMaxWidth = 480;

/// Max width of the tab screens' content on wide screens (two columns fit).
const double kWideContentMaxWidth = 1100;

/// From this content width the tab screens show two columns (AppTabBody `side`).
const double kTwoPaneMinWidth = 700;

/// Max width of a single column on wide screens.
const double kReadableMaxWidth = 640;

/// A phone held sideways: the short side is phone-sized.
bool isPhoneLandscape(Size s) => s.width > s.height && s.height < Breakpoints.mobile;

/// Tells the tab screens whether the floating bottom dock is showing (it covers the end of their lists).
class AppNavScope extends InheritedWidget {
  const AppNavScope({super.key, required this.dock, required super.child});
  final bool dock;
  static bool hasDock(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppNavScope>()?.dock ?? true;
  @override
  bool updateShouldNotify(AppNavScope old) => old.dock != dock;
}

/// Floating dock (mobile), NavigationRail (tablet) or NavigationDrawer (desktop).
class AdaptiveScaffold extends StatelessWidget {
  const AdaptiveScaffold({super.key, required this.navigationShell, required this.destinations, this.title = 'Teacher Portal'});
  final StatefulNavigationShell navigationShell;
  final List<AppNavItem> destinations;
  final String title;

  void _select(int i) => navigationShell.goBranch(i, initialLocation: i == navigationShell.currentIndex);

  @override
  Widget build(BuildContext context) => ResponsiveBuilder(
        builder: (context, screenType) {
          final selected = navigationShell.currentIndex;
          if (screenType == ScreenType.mobile) {
            return AppNavScope(
              dock: true,
              child: Scaffold(
                extendBody: true,
                body: SafeArea(bottom: false, child: navigationShell),
                bottomNavigationBar: AppDock(items: destinations, index: selected, onTap: _select),
              ),
            );
          }
          // landscape phones and tablets: side navigation, content across the width (two columns where the screen has them)
          final phoneLandscape = isPhoneLandscape(MediaQuery.sizeOf(context));
          final body = ColoredBox(
            color: C.surface,
            child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: kWideContentMaxWidth), child: ColoredBox(color: C.bg, child: SafeArea(left: false, child: navigationShell)))),
          );
          final nav = screenType == ScreenType.tablet
              ? NavigationRail(
                  selectedIndex: selected, onDestinationSelected: _select,
                  // a sideways phone is short: label only the selected tab so all five fit
                  labelType: phoneLandscape ? NavigationRailLabelType.selected : NavigationRailLabelType.all,
                  groupAlignment: phoneLandscape ? 0 : -1,
                  indicatorColor: C.primarySoft,
                  destinations: [
                    for (final d in destinations)
                      NavigationRailDestination(icon: Icon(d.icon, size: 22.r), selectedIcon: Icon(d.selectedIcon, color: C.primary, size: 22.r), label: Text(d.label, style: T.small)),
                  ],
                )
              : NavigationDrawer(
                  selectedIndex: selected, onDestinationSelected: _select, indicatorColor: C.primarySoft,
                  children: [
                    Padding(padding: EdgeInsets.fromLTRB(16.w, 28.h, 16.w, 16.h), child: Text(title, style: T.h2)),
                    const Divider(indent: 16, endIndent: 16),
                    for (final d in destinations)
                      NavigationDrawerDestination(icon: Icon(d.icon), selectedIcon: Icon(d.selectedIcon, color: C.primary), label: Text(d.label, style: T.bodyStrong)),
                  ],
                );
          return AppNavScope(
            dock: false,
            child: Scaffold(body: Row(children: [SafeArea(right: false, child: nav), const VerticalDivider(thickness: 1, width: 1), Expanded(child: body)])),
          );
        },
      );
}
