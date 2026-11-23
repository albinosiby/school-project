import 'package:flutter/material.dart';

class SkeletonShimmer extends StatefulWidget {
  const SkeletonShimmer({super.key, required this.child});
  final Widget child;
  @override
  State<SkeletonShimmer> createState() => _SkeletonShimmerState();
}

class _SkeletonShimmerState extends State<SkeletonShimmer> with SingleTickerProviderStateMixin {
  late final _animation = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500));
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _animation.stop();
    } else {
      _animation.repeat();
    }
  }

  @override
  void dispose() {
    _animation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Loading',
    liveRegion: true,
    child: ExcludeSemantics(
      child: AnimatedBuilder(
        animation: _animation,
        child: widget.child,
        builder: (context, child) => ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) => LinearGradient(
            begin: Alignment(-3 + 6 * _animation.value, 0),
            end: Alignment(-1 + 6 * _animation.value, 0),
            colors: [
              Colors.transparent,
              Colors.white.withValues(alpha: Theme.of(context).brightness == Brightness.dark ? .12 : .55),
              Colors.transparent,
            ],
          ).createShader(bounds),
          child: child,
        ),
      ),
    ),
  );
}

class SchoolSkeletonList extends StatelessWidget {
  const SchoolSkeletonList({super.key});
  @override
  Widget build(BuildContext context) => SkeletonShimmer(
    child: ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.all(20),
      children: [
        for (var i = 0; i < 4; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Container(
              height: 88,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
      ],
    ),
  );
}
