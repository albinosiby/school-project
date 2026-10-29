import 'package:flutter/material.dart';
import 'breakpoints.dart';

class ResponsiveBuilder extends StatelessWidget {
  const ResponsiveBuilder({super.key, required this.builder});
  final Widget Function(BuildContext, ScreenType, BoxConstraints) builder;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) =>
        builder(context, Breakpoints.at(box.maxWidth), box),
  );
}
