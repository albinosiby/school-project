import 'package:flutter/material.dart';
import 'breakpoints.dart';

class ResponsiveBuilder extends StatelessWidget {
  final Widget Function(BuildContext context, ScreenType screenType) builder;

  const ResponsiveBuilder({super.key, required this.builder});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final screenType = Breakpoints.getScreenType(constraints.maxWidth);
        return builder(context, screenType);
      },
    );
  }
}
