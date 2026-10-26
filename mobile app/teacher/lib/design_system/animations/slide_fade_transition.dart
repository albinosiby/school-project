import 'package:flutter/material.dart';

class SlideFadeTransition extends StatefulWidget {
  final Widget child;
  final Duration duration;
  final Offset offset;
  final Curve curve;

  const SlideFadeTransition({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 300),
    this.offset = const Offset(0, 0.3),
    this.curve = Curves.easeOut,
  });

  @override
  State<SlideFadeTransition> createState() => _SlideFadeTransitionState();
}

class _SlideFadeTransitionState extends State<SlideFadeTransition>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<Offset> _slideAnimation;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _slideAnimation = Tween<Offset>(begin: widget.offset, end: Offset.zero)
        .animate(CurvedAnimation(parent: _controller, curve: widget.curve));
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0)
        .animate(CurvedAnimation(parent: _controller, curve: widget.curve));
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SlideTransition(
      position: _slideAnimation,
      child: FadeTransition(opacity: _fadeAnimation, child: widget.child),
    );
  }
}
