import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../components/app_bottom_nav_bar.dart';
import 'responsive_builder.dart';
import 'breakpoints.dart';

class AdaptiveScaffold extends StatelessWidget {
  const AdaptiveScaffold({
    super.key,
    required this.shell,
    required this.assistant,
  });
  final StatefulNavigationShell shell;
  final bool assistant;
  @override
  Widget build(BuildContext context) => ResponsiveBuilder(
    builder: (context, type, box) {
      final width = switch (type) {
        ScreenType.mobile => box.maxWidth,
        ScreenType.tablet => 480.0,
        ScreenType.desktop => 520.0,
      };
      return Scaffold(
        extendBody: true,
        body: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: width),
            child: shell,
          ),
        ),
        bottomNavigationBar: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: width),
            child: AppBottomNavBar(
              index: shell.currentIndex,
              assistant: assistant,
              onTap: (i) =>
                  shell.goBranch(i, initialLocation: i == shell.currentIndex),
            ),
          ),
        ),
      );
    },
  );
}
