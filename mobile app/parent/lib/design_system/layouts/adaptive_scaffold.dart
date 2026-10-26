import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../components/app_dock.dart';
import '../tokens/app_tokens.dart';
import 'breakpoints.dart';
import 'responsive_builder.dart';

/// Max width of the phone-designed content on tablet/desktop.
const double kContentMaxWidth = 480;

/// Floating dock (mobile), NavigationRail (tablet) or NavigationDrawer (desktop).
class AdaptiveScaffold extends StatelessWidget {
  const AdaptiveScaffold({
    super.key,
    required this.navigationShell,
    required this.destinations,
    this.title = 'Parent Portal',
  });
  final StatefulNavigationShell navigationShell;
  final List<AppNavItem> destinations;
  final String title;

  void _select(int i) => navigationShell.goBranch(
    i,
    initialLocation: i == navigationShell.currentIndex,
  );

  @override
  Widget build(BuildContext context) => ResponsiveBuilder(
    builder: (context, screenType) {
      final selected = navigationShell.currentIndex;
      if (screenType == ScreenType.mobile) {
        return Scaffold(
          extendBody: true,
          body: SafeArea(bottom: false, child: navigationShell),
          bottomNavigationBar: AppDock(
            items: destinations,
            index: selected,
            onTap: _select,
          ),
        );
      }
      final body = ColoredBox(
        color: C.surface,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: kContentMaxWidth),
            child: ColoredBox(
              color: C.bg,
              child: SafeArea(child: navigationShell),
            ),
          ),
        ),
      );
      final nav = screenType == ScreenType.tablet
          ? NavigationRail(
              selectedIndex: selected,
              onDestinationSelected: _select,
              labelType: NavigationRailLabelType.all,
              indicatorColor: C.primarySoft,
              destinations: [
                for (final d in destinations)
                  NavigationRailDestination(
                    icon: Icon(d.icon, size: 22.r),
                    selectedIcon: Icon(
                      d.selectedIcon,
                      color: C.primary,
                      size: 22.r,
                    ),
                    label: Text(d.label, style: T.small),
                  ),
              ],
            )
          : NavigationDrawer(
              selectedIndex: selected,
              onDestinationSelected: _select,
              indicatorColor: C.primarySoft,
              children: [
                Padding(
                  padding: EdgeInsets.fromLTRB(16.w, 28.h, 16.w, 16.h),
                  child: Text(title, style: T.h2),
                ),
                const Divider(indent: 16, endIndent: 16),
                for (final d in destinations)
                  NavigationDrawerDestination(
                    icon: Icon(d.icon),
                    selectedIcon: Icon(d.selectedIcon, color: C.primary),
                    label: Text(d.label, style: T.bodyStrong),
                  ),
              ],
            );
      return Scaffold(
        body: Row(
          children: [
            nav,
            const VerticalDivider(thickness: 1, width: 1),
            Expanded(child: body),
          ],
        ),
      );
    },
  );
}
