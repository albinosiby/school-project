import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_tone.dart';

/// Rounded tinted square holding an icon. [size] is in design pixels.
class IconTile extends StatelessWidget {
  const IconTile(this.icon, {super.key, this.tone = Tone.brand, this.size = 40});
  final IconData icon;
  final Tone tone;
  final double size;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return Container(width: size.r, height: size.r, decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(R.md)), child: Icon(icon, size: (size * .5).r, color: c.fg));
  }
}
