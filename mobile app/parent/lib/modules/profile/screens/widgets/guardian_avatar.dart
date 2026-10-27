import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';

/// Simulated profile photos: each style is a coloured initials avatar.
const photoTones = [Tone.brand, Tone.success, Tone.purple, Tone.warning, Tone.danger];

Tone photoTone(int? style) =>
    style == null ? Tone.neutral : photoTones[style % photoTones.length];

/// Guardian avatar with a ring and an optional corner badge (verified tick / camera button).
class GuardianAvatar extends StatelessWidget {
  const GuardianAvatar({
    super.key,
    required this.name,
    required this.style,
    this.size = 84,
    this.badge,
  });
  final String name;
  final int? style;
  final double size;
  final Widget? badge;

  @override
  Widget build(BuildContext context) => Stack(
    clipBehavior: Clip.none,
    children: [
      Container(
        padding: EdgeInsets.all(3.r),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: toneColors(photoTone(style)).fg.withValues(alpha: .35), width: 1.5),
        ),
        child: Avatar(name, size: size, tone: photoTone(style)),
      ),
      if (badge != null) Positioned(right: 0, bottom: 0, child: badge!),
    ],
  );
}
