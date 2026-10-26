import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'app_avatar.dart';
import 'app_tone.dart';

/// Row of overlapping initials avatars. [size] is in design pixels; each avatar
/// shows ~72% of its width so two-letter initials stay readable.
class AvatarStack extends StatelessWidget {
  const AvatarStack({super.key, required this.names, this.tones = const [Tone.brand, Tone.purple, Tone.success, Tone.warning], this.size = 36});
  final List<String> names;
  final List<Tone> tones;
  final double size;

  /// Width reserved for the stack (pass to siblings that need to align).
  double get width => (size + (names.length - 1) * size * .72).r;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: width, height: size.r,
        child: Stack(children: [
          for (var i = 0; i < names.length; i++)
            Positioned(left: i * size * .72.r, child: Avatar(names[i], size: size, tone: tones[i % tones.length])),
        ]),
      );
}
